import { db } from '../index'
import {
  ALL_CATEGORIES,
  CATEGORY_DEFS,
  isNotificationCategory,
  parseCategoriesOff,
  type NotificationCategory,
} from '@/lib/notifications/categories'

/**
 * Per-member notification push preferences.
 *
 * The storage rule, which every function here depends on: **a row is an explicit
 * choice, and `muted` is what it chose**. Absence means the member has never
 * touched that switch, and resolves to `CATEGORY_DEFS[category].defaultOn` -
 * so nothing is ever seeded and a member who has not opened the settings screen
 * still has no rows at all.
 *
 * It was not always this shape. A row used to MEAN muted, with no boolean at
 * all, and un-muting was a DELETE. That could express exactly one default -
 * absence meant on, for every category - and `reminders` and `presence` are now
 * opt-in, which under that shape would have had to be spelled as absence too.
 * The column is what lets the two defaults coexist. It also means an explicit
 * choice SURVIVES a later change to the default instead of silently inverting
 * with it: flip `defaultOn` and only the members with no row move.
 *
 * The consequence for callers is the one thing to get right here: **you cannot
 * answer "is this muted?" from the rows alone any more.** A member with no row
 * is muted for an opt-in category and not muted for the others, so every read
 * below resolves through the catalogue rather than testing for a row's
 * existence. That is why `mutedUserIdsFor()` is gone - a bare set of user ids
 * from this table cannot express the answer for a `defaultOn: false` category,
 * because the members it concerns are precisely the ones it has no rows for.
 *
 * `workspaceId === null` addresses the account-level row, which only the
 * `presence` category uses.
 */

export interface NotificationPref {
  id: string
  user_id: string
  workspace_id: string | null
  category: string
  muted: number
  created_at: string
}

/**
 * Read the `muted` column without trusting its JavaScript type.
 *
 * better-sqlite3 hands back `0`/`1` and libSQL may hand back a boolean for the
 * same INTEGER column, so a bare truthiness test reads `false` correctly and a
 * `!== 0` test does not. `Number()` flattens both.
 */
function toMuted(value: unknown): boolean {
  return Number(value) !== 0
}

/** What a member gets when they have expressed no preference. */
function defaultMuted(category: NotificationCategory): boolean {
  return !CATEGORY_DEFS[category].defaultOn
}

/**
 * The categories whose push this member does NOT receive in this scope.
 *
 * Pass `null` for the account-level scope. Callers get a Set because every use
 * is a membership test, and because it makes "no rows" and "no preferences"
 * the same empty answer.
 *
 * **Resolved, not raw.** The returned set is the effective answer: every
 * member-mutable category in this scope that the member has either muted
 * explicitly or never opted in to. It is what makes `/me/settings` paint an
 * opt-in category's switch off for a member who has never been there, with no
 * knowledge of defaults on the screen itself.
 *
 * Categories are taken from the catalogue and matched against the rows, rather
 * than the other way round: a row left behind by a category that was later
 * removed resolves to nothing, and a category added later needs no backfill.
 */
export async function getMutedCategories(
  userId: string,
  workspaceId: string | null,
): Promise<Set<NotificationCategory>> {
  const rows = workspaceId
    ? await db.query<{ category: string; muted: number }>(
        'SELECT category, muted FROM notification_prefs WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId],
      )
    : await db.query<{ category: string; muted: number }>(
        'SELECT category, muted FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL',
        [userId],
      )

  const explicit = new Map<NotificationCategory, boolean>()
  for (const row of rows) {
    if (isNotificationCategory(row.category)) explicit.set(row.category, toMuted(row.muted))
  }

  const scope = workspaceId ? 'workspace' : 'account'
  const muted = new Set<NotificationCategory>()
  for (const key of ALL_CATEGORIES) {
    const def = CATEGORY_DEFS[key]
    // An immutable category can hold no preference, so it has no resolved
    // answer to give - `notify()` never consults one for it either.
    if (def.scope !== scope || !def.memberMutable) continue
    if (explicit.get(key) ?? defaultMuted(key)) muted.add(key)
  }
  return muted
}

/**
 * Record this member's choice for one category.
 *
 * Both directions now WRITE a row. Un-muting can no longer be a DELETE: for an
 * opt-in category the absence of a row is what "muted" means, so deleting would
 * store the opposite of what the member just asked for. A row saying
 * `muted = 0` is what "I turned this on" is.
 *
 * Two statements rather than an `ON CONFLICT` upsert. The unique indexes on this
 * table are PARTIAL (`WHERE workspace_id IS NOT NULL` / `IS NULL`), so an upsert
 * would need its conflict target to repeat each index's predicate and would have
 * to be written twice anyway - once per scope. `INSERT OR IGNORE` then `UPDATE`
 * reaches the same state, and is race-safe in the same way the old insert was:
 * the index decides which of two concurrent tabs creates the row, and the update
 * then sets the value on whichever row exists.
 *
 * Muting an immutable category is refused here as well as in the route, because
 * a preference row that nothing will ever honour is worse than an error.
 */
export async function setCategoryMuted(
  userId: string,
  workspaceId: string | null,
  category: NotificationCategory,
  muted: boolean,
): Promise<void> {
  if (!CATEGORY_DEFS[category].memberMutable) {
    throw new Error(`notification category '${category}' is not member-mutable`)
  }

  const flag = muted ? 1 : 0

  await db.execute(
    `INSERT OR IGNORE INTO notification_prefs (user_id, workspace_id, category, muted)
     VALUES (?, ?, ?, ?)`,
    [userId, workspaceId, category, flag],
  )

  if (workspaceId) {
    await db.execute(
      'UPDATE notification_prefs SET muted = ? WHERE user_id = ? AND workspace_id = ? AND category = ?',
      [flag, userId, workspaceId, category],
    )
  } else {
    await db.execute(
      'UPDATE notification_prefs SET muted = ? WHERE user_id = ? AND workspace_id IS NULL AND category = ?',
      [flag, userId, category],
    )
  }
}

/**
 * Every explicit choice held in this workspace for one category, as a map from
 * user id to their `muted` value. Members with no row are simply absent.
 *
 * The bulk read, and the reason `idx_notif_prefs_lookup` exists. The wall-clock
 * reminder pass iterates workspaces, not members, so it reads this once per
 * workspace and resolves each member in memory - the alternative is one
 * preference query per member per tick, which for a 500-person workspace is 500
 * round trips every 30 minutes to answer a question about a handful of rows.
 *
 * It returns the CHOICES rather than a finished set of muted user ids, which is
 * the change the default-off categories forced. A set of muted ids would have to
 * enumerate every member who has never touched the switch - people this table
 * has no rows for and no way to name. Pair it with `isPushMuted()`, which is
 * pure and applies the catalogue default; the category travels inside the map so
 * a call site cannot resolve one category's rows against another's default.
 */
export interface CategoryChoices {
  category: NotificationCategory
  /** user id → the value that member explicitly chose. Absent = never chose. */
  explicit: Map<string, boolean>
}

export async function getCategoryChoices(
  workspaceId: string,
  category: NotificationCategory,
): Promise<CategoryChoices> {
  const rows = await db.query<{ user_id: string; muted: number }>(
    'SELECT user_id, muted FROM notification_prefs WHERE workspace_id = ? AND category = ?',
    [workspaceId, category],
  )
  const explicit = new Map<string, boolean>()
  for (const row of rows) explicit.set(row.user_id, toMuted(row.muted))
  return { category, explicit }
}

/**
 * Resolve one member against a `getCategoryChoices()` read. Pure - no DB, no
 * round trip - so a caller can ask it once per member inside a loop it has
 * already paid one query for.
 */
export function isPushMuted(choices: CategoryChoices, userId: string): boolean {
  return choices.explicit.get(userId) ?? defaultMuted(choices.category)
}

/**
 * The account-level counterpart, for the presence ladder. Same resolution, but
 * keyed on the member alone because a check-in session belongs to no workspace.
 */
export async function isAccountCategoryMuted(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const row = await db.queryOne<{ muted: number }>(
    'SELECT muted FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL AND category = ? LIMIT 1',
    [userId, category],
  )
  return row ? toMuted(row.muted) : defaultMuted(category)
}

/**
 * Who must NOT receive a presence push - the 5h / 10h / auto-checkout ladder.
 *
 * **The live rule is now the first line alone:** a member is silenced unless
 * they have turned `presence` on for their account. `presence` is no longer
 * `workspaceSwitchable`, so the workspace half below can no longer reach a
 * verdict - `parseCategoriesOff()` filters the category out of every stored
 * set, and the tally always comes back `off === 0`.
 *
 * Note the direction of that first line. `presence` is `defaultOn: false`, so
 * the default answer for a member with no row is SILENCED and the query below
 * looks for the rows that opt IN rather than the rows that mute. This is the one
 * category where that means total silence rather than a quiet feed row: the
 * ladder is push-only, so a member who has not asked for it hears nothing about
 * their own session, auto-checkout confirmation included. The mechanic is
 * untouched - `autoCheckoutEvent()` runs before `notifyPresence()` and
 * unconditionally, so sessions still close whether anybody is told or not.
 *
 * The rest is kept, inert, and documented as it was, because the flag in
 * `CATEGORY_DEFS` is a product decision rather than a structural one and this
 * is the only place the vote is written down. Restoring the workspace switch is
 * that one flag; re-deriving this rule from scratch would not be.
 *
 * The full rule, when the workspace switch exists:
 *
 *   silenced  =  the member muted `presence` on their own account
 *             OR (they have at least one active workspace
 *                 AND every one of those workspaces has switched `presence` off)
 *
 * Presence is `scope: 'account'` because a check-in session belongs to no
 * workspace: `presence_events` carries no `workspace_id` and deliberately never
 * will, so a member of two workspaces has ONE session, not two, and there is no
 * workspace whose switch obviously governs it. Hence "every" rather than "any":
 * one workspace must not silence a member on behalf of another. A person with a
 * Monday-to-Wednesday job that wants no session pushes and a Thursday-to-Friday
 * job that does should still be told their Thursday session was auto-checked-out
 * - the push is about THEIR session, and the second workspace has not asked for
 * it to stop. That unanimity requirement is also why the switch was dropped: a
 * control that only bites when every workspace a member cannot see agrees is a
 * poor use of an admin's attention.
 *
 * A member with NO active workspace is not silenced BY THE WORKSPACE HALF.
 * Nothing has said otherwise, and an empty vote is not a vote to switch off -
 * the workspace tally is about what workspaces have decided, and none have. It
 * says nothing about the member's own preference, which the first half has
 * already answered and which today silences them unless they opted in.
 *
 * Returns the UNION of both reasons rather than two sets, so `notifyPresence()`
 * has one question to ask and this rule lives in exactly one place.
 *
 * Takes a LIST for the same reason `notify()` does. The cron resolves every
 * open event's user in one call before its loop; asking per event would be up
 * to `CRON_EVENT_LIMIT` (500) extra round trips every thirty minutes, which is
 * the exact round-trip explosion `mutedUserIdsFor()` was written to avoid. That
 * bound is also why the `IN` lists below are not chunked - 500 is comfortably
 * under SQLite's parameter limit.
 */
export async function presenceSilencedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()

  const unique = [...new Set(userIds)]
  const placeholders = unique.map(() => '?').join(', ')

  const [choices, memberships] = await Promise.all([
    // The account-level choices. A row is an explicit choice and `muted` is what
    // it says (see the file header); `workspace_id IS NULL` is what makes it
    // account-scoped. Members with no row are absent here and pick up the
    // catalogue default below.
    db.query<{ user_id: string; muted: number }>(
      `SELECT user_id, muted FROM notification_prefs
       WHERE workspace_id IS NULL AND category = 'presence'
         AND user_id IN (${placeholders})`,
      unique,
    ),
    // Every active membership these users hold, with its workspace's disabled
    // set. Archived workspaces are excluded: an archived workspace has no say,
    // and counting one would let a dead workspace cast the deciding vote for a
    // member whose only OTHER workspace still wants the pushes.
    db.query<{ user_id: string; notification_categories_off: string | null }>(
      `SELECT wm.user_id, w.notification_categories_off
       FROM workspace_members wm
       JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.status = 'active'
         AND w.archived_at IS NULL
         AND wm.user_id IN (${placeholders})`,
      unique,
    ),
  ])

  // Resolve every member asked about, not every member with a row: for an
  // opt-in category the people who matter are exactly the ones with no row.
  const explicit = new Map<string, boolean>()
  for (const row of choices) explicit.set(row.user_id, toMuted(row.muted))

  const silenced = new Set<string>(
    unique.filter((id) => explicit.get(id) ?? defaultMuted('presence')),
  )

  // Tally each member's workspaces: total, and how many switched presence off.
  const tally = new Map<string, { total: number; off: number }>()
  for (const row of memberships) {
    const entry = tally.get(row.user_id) ?? { total: 0, off: 0 }
    entry.total++
    if (parseCategoriesOff(row.notification_categories_off).has('presence')) entry.off++
    tally.set(row.user_id, entry)
  }

  for (const [userId, { total, off }] of tally) {
    if (total > 0 && off === total) silenced.add(userId)
  }

  return silenced
}
