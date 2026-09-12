import { db } from '../index'
import { DEFAULT_PRESENCE_PREFS, type MemberPresencePrefs } from '@/lib/presence-ladder'

/**
 * The read/write path for `member_presence_prefs` - one member's session ladder.
 *
 * ACCOUNT-scoped, keyed on `user_id` alone, and that is structural rather than a
 * preference. `presence_events` carries no `workspace_id` and deliberately never
 * will, so a member of two workspaces has ONE open check-in session and there is
 * no workspace to key a ladder on. Asking "which workspace's rungs apply to this
 * session" has no answer, and inventing one would put two ladders in a race to
 * push about the same row.
 *
 * The shapes and bounds live in `src/lib/presence-ladder.ts`, not here, and are
 * only re-exported below. That module is pure because the `/me/settings` form
 * that edits these values is a CLIENT component: a runtime import from this file
 * would drag `lib/db/index.ts` - and with it better-sqlite3 and libSQL - into the
 * browser bundle, and the build failure that causes is a long `Can't resolve
 * 'fs'` trace naming none of it.
 */

/** Re-exported so a server-side caller needs one import, not two. */
export { DEFAULT_PRESENCE_PREFS }
export type { MemberPresencePrefs }

/** The row as SQLite hands it back: snake_case, and every rung nullable. */
interface PresencePrefsRow {
  user_id: string
  half_day_after_h: number | null
  full_day_after_h: number | null
  repeat_every_h: number | null
  auto_checkout_after_h: number
}

/**
 * Map a row onto the interface, one column at a time.
 *
 * Explicit rather than a spread, for two reasons that are both silent when got
 * wrong. The columns are snake_case and the interface is camelCase, so a spread
 * would produce an object that satisfies nothing and typechecks nowhere useful;
 * and the numeric columns are REAL, which better-sqlite3 and libSQL do not agree
 * on the JavaScript type of - libSQL can hand back a value that is not a
 * `number` for the same column better-sqlite3 gives a plain one. `Number()`
 * flattens both, the same trick `toMuted()` plays on the INTEGER column in
 * `notification-prefs.ts`.
 *
 * The `== null` test is deliberately loose: it catches SQL NULL arriving as
 * either `null` or `undefined`, and `Number(null)` is `0` - which would silently
 * turn "this rung is off" into "this rung fires the instant you check in".
 */
function toPrefs(row: PresencePrefsRow): MemberPresencePrefs {
  return {
    halfDayAfterH: row.half_day_after_h == null ? null : Number(row.half_day_after_h),
    fullDayAfterH: row.full_day_after_h == null ? null : Number(row.full_day_after_h),
    repeatEveryH: row.repeat_every_h == null ? null : Number(row.repeat_every_h),
    autoCheckoutAfterH: Number(row.auto_checkout_after_h),
  }
}

/**
 * Every stored ladder among these members, as a map from user id to their prefs.
 *
 * THE BULK READ, and the shape the push cron needs. That loop runs up to
 * `CRON_EVENT_LIMIT` (500) times every thirty minutes, so a per-event lookup is
 * 500 round trips to answer a question about a handful of rows - the ladder is
 * opt-in, so most of those 500 members have no row at all. Same argument, and
 * the same shape, as the one bulk `getCategoryChoices()` read per workspace in
 * the wall-clock reminder pass.
 *
 * That 500 is also why the `IN (...)` list is NOT chunked. SQLite's default
 * parameter ceiling is in the hundreds of thousands (999 on very old builds, and
 * the de-duplicated id count is well under even that), so the bound the cron
 * already enforces keeps this one statement safe without a batching loop nobody
 * would ever be able to exercise.
 *
 * MEMBERS WITH NO ROW ARE SIMPLY ABSENT, and a caller must resolve every id it
 * asked about against `DEFAULT_PRESENCE_PREFS` rather than iterating the rows it
 * got back. For an opt-in feature the members who matter are precisely the ones
 * this table has no rows for: iterating the result would silently process only
 * the minority who have configured something, which happens to look correct for
 * the ladder (a default member earns no pushes) and is wrong for auto-checkout,
 * which every member has whether they set it or not.
 *
 * Ids are de-duplicated before the placeholders are built: the caller passes one
 * id per open EVENT, and one member can hold several rows in the batch after an
 * outage, which would otherwise repeat the same parameter needlessly.
 */
export async function getPresenceLadderPrefs(
  userIds: string[],
): Promise<Map<string, MemberPresencePrefs>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const placeholders = unique.map(() => '?').join(', ')
  const rows = await db.query<PresencePrefsRow>(
    `SELECT user_id, half_day_after_h, full_day_after_h, repeat_every_h, auto_checkout_after_h
     FROM member_presence_prefs
     WHERE user_id IN (${placeholders})`,
    unique,
  )

  const byUser = new Map<string, MemberPresencePrefs>()
  for (const row of rows) byUser.set(row.user_id, toPrefs(row))
  return byUser
}

/**
 * One member's ladder, resolved - never null.
 *
 * The fallback is here rather than at the call sites because there are two of
 * them with very different stakes: the settings screen, where a default is a
 * pre-filled form, and `/api/checkin`, where it decides when somebody's session
 * closes. A route that had to remember to apply the default itself is a route
 * that can forget, and forgetting means `autoCheckoutAfterH` is `undefined` and
 * the scheduled checkout is `Invalid Date`.
 */
export async function getPresencePrefsForUser(userId: string): Promise<MemberPresencePrefs> {
  const row = await db.queryOne<PresencePrefsRow>(
    `SELECT user_id, half_day_after_h, full_day_after_h, repeat_every_h, auto_checkout_after_h
     FROM member_presence_prefs
     WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  return row ? toPrefs(row) : DEFAULT_PRESENCE_PREFS
}

/**
 * Write this member's whole ladder.
 *
 * Takes the COMPLETE object, not a patch. The rungs constrain each other -
 * a repeat is meaningless without a full-day mark, and no rung may sit at or
 * past auto-checkout - so a partial write at this layer would be a write that
 * cannot check its own result. The merge-then-validate happens one level up, in
 * `/api/me/presence-prefs`, against the member's current stored values.
 *
 * Two statements rather than an `ON CONFLICT` upsert, for the same reason as
 * `setCategoryMuted()`: `INSERT OR IGNORE` then `UPDATE` reaches the same state
 * and is race-safe in the way that matters here. The PRIMARY KEY on `user_id`
 * decides which of two concurrent tabs creates the row, the loser's insert is
 * ignored rather than raising, and the UPDATE then sets the values on whichever
 * row survived. Either tab's save wins whole; neither can half-apply.
 *
 * `updated_at` is set by the UPDATE and never by the INSERT, which is exactly
 * right: the INSERT's column default is `datetime('now')` already, and the row
 * that matters is always the one the UPDATE touches.
 */
export async function setPresencePrefsForUser(
  userId: string,
  prefs: MemberPresencePrefs,
): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO member_presence_prefs
       (user_id, half_day_after_h, full_day_after_h, repeat_every_h, auto_checkout_after_h)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      prefs.halfDayAfterH,
      prefs.fullDayAfterH,
      prefs.repeatEveryH,
      prefs.autoCheckoutAfterH,
    ],
  )

  await db.execute(
    `UPDATE member_presence_prefs
     SET half_day_after_h = ?, full_day_after_h = ?, repeat_every_h = ?,
         auto_checkout_after_h = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
    [
      prefs.halfDayAfterH,
      prefs.fullDayAfterH,
      prefs.repeatEveryH,
      prefs.autoCheckoutAfterH,
      userId,
    ],
  )
}
