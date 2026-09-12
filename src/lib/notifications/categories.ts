/**
 * The notification category catalogue.
 *
 * Every notification this product can send belongs to exactly one category, and
 * a category is the unit both settings surfaces operate on: a workspace switches
 * categories on or off for everybody, a member mutes the push for the ones they
 * are allowed to. Nothing in the system may invent a category outside this file.
 *
 * Why categories and not `NotificationType` directly: there are fourteen types
 * and a member does not want fourteen switches. "Leave approved" and "Document
 * verified" are the same thing to a person - the outcome of something they asked
 * for - and the day a twelfth type lands it should inherit an existing switch
 * rather than silently arrive unswitchable.
 *
 * `CATEGORY_OF` is a total `Record` over `NotificationType` on purpose. A new
 * type added to that union without a category here is a **compile error**, which
 * is the same trick `RESOURCE_DEFS` uses in the permission catalogue. A
 * `Partial` here would mean a new notification quietly bypassing every
 * preference the user has set.
 */

import type { NotificationType } from '@/lib/db/queries/notifications'

export type NotificationCategory =
  | 'reminders'
  | 'approvals'
  | 'announcements'
  | 'presence'

/**
 * Which category each notification type belongs to.
 *
 * Note `presence` has no entry here: the 5h / 10h / 12h pushes are the only
 * messages with no `notifications` row and therefore no `NotificationType` at
 * all. They reach their category through `notifyPresence()` instead.
 */
export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  checkin_reminder: 'reminders',
  checkout_reminder: 'reminders',

  // Both halves of an approval - the request landing in an approver's queue and
  // the answer coming back to the person who filed it - are ONE category. They
  // were two (`approvals_inbox` / `approvals_outcome`) and the split did not
  // survive contact with the settings screen: two rows saying almost the same
  // thing, which an admin has to read twice to tell apart. See CATEGORY_DEFS.
  leave_submitted: 'approvals',
  regularization_submitted: 'approvals',
  extension_submitted: 'approvals',

  leave_approved: 'approvals',
  leave_rejected: 'approvals',
  regularization_approved: 'approvals',
  regularization_rejected: 'approvals',
  document_verified: 'approvals',
  document_rejected: 'approvals',
  extension_approved: 'approvals',
  extension_rejected: 'approvals',

  announcement: 'announcements',
}

export interface CategoryDef {
  key: NotificationCategory
  /**
   * `workspace` - the preference is keyed on (workspace, member), because the
   * notification is produced by a workspace and a member may want it from one
   * workspace and not another.
   *
   * `account` - keyed on the member alone. `presence` is the only one, and it
   * has to be: `presence_events` carries no `workspace_id` (deliberately - see
   * CLAUDE.md), so there is no workspace to key a check-in session on.
   */
  scope: 'workspace' | 'account'
  /**
   * May a workspace admin switch this off for everybody?
   *
   * This field decides two things, exactly mirroring `memberMutable` below: what
   * the workspace may configure, and what the admin switchboard RENDERS AT ALL.
   * A category a workspace cannot switch is not shown there disabled - it is not
   * shown. `reminders` and `presence` are the member's to control, and a locked
   * switch on the admin screen would only invite an admin to throw it and be
   * told no. `/ws/[slug]/settings` filters on this field.
   *
   * For a `scope: 'workspace'` category `true` is exact: the workspace produced
   * the notification, so switching it off means nothing is written and nothing
   * is sent. For `scope: 'account'` it would be a VOTE, not a verdict - a
   * check-in session belongs to no workspace, so one workspace cannot silence a
   * member who belongs to two. No category is both today; see
   * `presenceSilencedUserIds()` for the rule that still encodes it.
   *
   * It is NOT what enforces the rule. `serialiseCategoriesOff()` refuses to
   * store a non-switchable key and `parseCategoriesOff()` refuses to honour one
   * already stored; the filter is presentation.
   */
  workspaceSwitchable: boolean
  /**
   * May a member mute the push for this?
   *
   * This field now decides two things, and the second one is newer: it is also
   * what puts a category on the member settings screen AT ALL. A category a
   * member cannot mute is not rendered there disabled - it is not rendered.
   * Showing somebody a switch they may not throw invites them to try, and the
   * answer is always no; the honest presentation of "the organisation decides
   * this one" is to not present it as a setting. `/me/settings` filters on this
   * field, so `false` means "workspace-configured only".
   *
   * It is NOT what enforces the rule. Both member PATCH routes and `setMuted()`
   * in `db/queries/notification-prefs.ts` refuse a non-mutable category on their
   * own; the filter is presentation.
   */
  memberMutable: boolean
  /**
   * Does a member who has never touched the switch receive the push?
   *
   * This is the fallback `notification_prefs` resolves against when a member has
   * no row for the category. `true` is the classic default - the notification
   * arrives until somebody mutes it. `false` makes the category **opt-in**: it
   * sends nothing until the member turns it on.
   *
   * It applies to the PUSH CHANNEL ONLY, exactly like a mute does, so a
   * `defaultOn: false` category with a `NotificationType` behind it still writes
   * its in-app feed row for everybody (invariant 24, step 3). `presence` is the
   * exception, and not because of this field: the ladder has no feed row to
   * write in the first place, so for it alone `defaultOn: false` means total
   * silence.
   *
   * Only meaningful where `memberMutable` is true. A category the member cannot
   * mute has no preference row to be absent, so its default is never consulted -
   * `approvals` and `announcements` are `true` to say what they do, not because
   * anything reads it.
   *
   * Changing this value changes behaviour for every member with NO row, and for
   * them only. A member who has made a choice keeps it, which is the whole
   * reason `notification_prefs.muted` is a column rather than the old
   * row-means-muted convention - under that shape this field could not exist.
   */
  defaultOn: boolean
  /**
   * Shown when a switch is locked, so the reason is visible rather than implied.
   *
   * **Currently unread.** It had one consumer, the member settings screen, which
   * used it to caption a disabled row - and that screen no longer renders
   * disabled rows at all (see `memberMutable` above). The admin switchboard's
   * equivalent path is also unreachable, because no category is workspace-locked.
   * Kept rather than deleted because both screens resolve it from this field
   * instead of hardcoding, so a category locked again in future gets its reason
   * back by setting it here.
   */
  lockedReason?: string
}

/**
 * The two flags partition the catalogue: each category is configured on exactly
 * ONE of the two settings screens, and is rendered on that one alone.
 *
 * | category        | workspaceSwitchable | memberMutable | default | configured on   |
 * |-----------------|---------------------|---------------|---------|-----------------|
 * | `approvals`     | yes                 | no            | on      | `/ws/../settings` |
 * | `announcements` | yes                 | no            | on      | `/ws/../settings` |
 * | `reminders`     | no                  | yes           | **off** | `/me/settings`  |
 * | `presence`      | no                  | yes           | **off** | `/me/settings`  |
 *
 * The default column falls out of the same split. The organisation's two are
 * things a person is entitled to receive, so they arrive by default and cannot
 * be muted. The member's two are nags about that member's own day, so they are
 * opt-in: silent until asked for, and silenceable again afterwards. Both halves
 * of each row point the same way, which is why there is one `defaultOn` field
 * and not a second partition to keep in sync.
 *
 * The split is by WHO the decision belongs to, and the diagonal is the whole
 * point - no category is configurable from both sides, so the two screens can
 * never disagree and no member can be told "your organisation overrode this".
 *
 * The organisation's two are the ones it broadcasts. `approvals` because a
 * person is entitled to be told what happened to a request they filed - a
 * member muting it and then not knowing their leave was rejected is a worse
 * outcome than any amount of noise. `announcements` because it is the one
 * message class that cannot afford to be missed - a policy change, a closure,
 * an office day.
 *
 * The member's two are the ones about their own working day. `reminders` (the
 * daily check-in / checkout nudge) and `presence` (the 5h / 10h / auto-checkout
 * ladder) are nags addressed to one person about their own session, so that
 * person switches them off. They were both workspace-switchable and are no
 * longer: the admin switchboard now shows only what the organisation sends on
 * everybody's behalf.
 *
 * Two consequences of dropping those, stated here because this file is where
 * they are decided rather than where they are felt:
 *
 *   - Gate 1b in `src/lib/reminders.ts` can no longer fire. It is kept, not
 *     deleted, because it reads the stored set rather than a hardcoded list -
 *     setting `workspaceSwitchable: true` here brings it back with no other
 *     edit.
 *   - `presenceSilencedUserIds()` still encodes the every-workspace vote, and
 *     it too can no longer reach a verdict; its account-mute half is unchanged
 *     and is now the only way presence is silenced. Same reasoning: the rule
 *     lives in one place and comes back by flipping this flag.
 *
 * Nothing is rendered locked on either screen. Both used to render their
 * opposite half disabled, captioned with the reason, on the argument that
 * somebody should see the decision was made rather than wonder where the switch
 * went. That was the wrong trade: a switch nobody may throw still reads as a
 * switch. `/me/settings` filters on `memberMutable`; the admin switchboard
 * filters on `workspaceSwitchable`.
 */
export const CATEGORY_DEFS: Record<NotificationCategory, CategoryDef> = {
  /**
   * The daily check-in / checkout nudge.
   *
   * `scope: 'workspace'` because the workspace produces it - the times, the
   * timezone, the working days and the holiday calendar the pass gates on are
   * all the workspace's. But it is not workspace-SWITCHABLE: a reminder is
   * addressed to one person about their own day, so the person it nags is the
   * one who gets to stop it. The mute stays per-workspace, which is what
   * `scope` buys - a member of two workspaces can silence one and keep the
   * other.
   *
   * `defaultOn: false` - opt-in. A daily nudge nobody asked for is the push a
   * person disables the whole browser permission over, and that permission is
   * shared: losing it also costs them the approval notifications that matter.
   * So the nudge starts silent and a member turns it on per workspace. The
   * in-app feed row is still written for everybody either way, so the reminder
   * is visible in the notification list from day one - it just does not buzz.
   */
  reminders: {
    key: 'reminders',
    scope: 'workspace',
    workspaceSwitchable: false,
    memberMutable: true,
    defaultOn: false,
  },
  /**
   * Both halves of an approval, in one switch.
   *
   * This was two categories - `approvals_inbox` (a request reaching an
   * approver) and `approvals_outcome` (the answer reaching the person who
   * filed it). They are merged because they are one subject to the admin
   * configuring them, and two near-identical rows are harder to tell apart
   * than one row is to understand.
   *
   * `memberMutable: false` is the merge's one real cost, and it is the
   * deliberate half: the inbox side used to be mutable and no longer is, so an
   * approver can no longer silence "a request is waiting for you". The outcome
   * side could not be made mutable in exchange - a person not learning their
   * leave was rejected is the failure this whole field exists to prevent - and
   * one category can only hold one answer.
   *
   * The consequence for the workspace switch is worth stating where it is set:
   * switching `approvals` off silences BOTH audiences at once, so a workspace
   * quieting its approvers also stops every employee being told the outcome of
   * their own request. The admin-side copy says this outright.
   */
  approvals: {
    key: 'approvals',
    scope: 'workspace',
    workspaceSwitchable: true,
    memberMutable: false,
    // Declarative only: `memberMutable: false` means no member ever holds a
    // preference row for this, so nothing consults the default. It says what the
    // category does rather than deciding it.
    defaultOn: true,
    lockedReason: 'always_on_approvals',
  },
  announcements: {
    key: 'announcements',
    scope: 'workspace',
    workspaceSwitchable: true,
    memberMutable: false,
    defaultOn: true,
    lockedReason: 'always_on_announcement',
  },
  /**
   * The 5h / 10h / auto-checkout ladder.
   *
   * `scope: 'account'` is forced: `presence_events` carries no `workspace_id`
   * and deliberately never will, so a member of two workspaces has ONE session
   * and there is no workspace to key a preference on.
   *
   * It was also workspace-switchable, resolved by the every-workspace vote in
   * `presenceSilencedUserIds()` - a switch that only bit when EVERY workspace a
   * member belonged to had thrown it. That is now `false`: an account-scoped
   * nudge about somebody's own session is theirs to silence, and a vote that
   * needed unanimity across workspaces that cannot see each other was a
   * confusing way to spend an admin's attention. The vote itself is kept in
   * that function, inert, so restoring it is this one flag.
   *
   * `defaultOn: false` - opt-in, and this is the one category where that means
   * TOTAL silence rather than a quiet feed row. The ladder is the only push-only
   * path in the product (`notifyPresence()` writes no `notifications` row), so a
   * member who has not opted in is told nothing about their own session,
   * auto-checkout confirmation included. That was already the accepted cost of
   * muting presence; it is now the cost of not asking for it. The MECHANIC is
   * untouched - `autoCheckoutEvent()` runs before `notifyPresence()` and
   * unconditionally, so sessions still close on time for everybody.
   */
  presence: {
    key: 'presence',
    scope: 'account',
    workspaceSwitchable: false,
    memberMutable: true,
    defaultOn: false,
  },
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_DEFS) as NotificationCategory[]

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && value in CATEGORY_DEFS
}

/**
 * Parse `workspaces.notification_categories_off`.
 *
 * Stores the **disabled** set, not the enabled one, so an empty array means
 * everything is on and a category added to this file later is on everywhere
 * with no migration and no backfill. Defensive in the same way `working_days`
 * is: a malformed column must not take the notification system down with it.
 *
 * It filters on `workspaceSwitchable` as well as on the catalogue, and that
 * second filter is what made revoking a workspace switch a one-line change
 * instead of a migration. `serialiseCategoriesOff()` has always refused to
 * WRITE a non-switchable key, but workspaces that switched `reminders` or
 * `presence` off while they still could have those words sitting in the column
 * today. Honouring them would leave exactly the bug this pair of filters
 * exists to prevent: a category nobody can see a switch for, silenced forever,
 * with no screen in the product able to explain why. Reading through the
 * catalogue means the stored rows go quiet the moment the flag flips, and come
 * back if it flips again - nothing is rewritten either way.
 *
 * Every consumer of the column goes through here (`notify()`, the announcement
 * fan-out, gate 1b, `presenceSilencedUserIds()`, both settings screens), so
 * this is the single place that has to be right.
 */
export function parseCategoriesOff(raw: string | null | undefined): Set<NotificationCategory> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter(
        (c): c is NotificationCategory =>
          isNotificationCategory(c) && CATEGORY_DEFS[c].workspaceSwitchable,
      ),
    )
  } catch {
    return new Set()
  }
}

/**
 * Serialise back, keeping only categories a workspace is actually allowed to
 * switch off. The route validates too; doing it here as well means a stored
 * value can never claim `reminders` or `presence` is disabled, whatever wrote
 * it - a client posting the old four-key payload gets the two it may set and
 * silent removal of the two it may not, rather than a 500 or a honoured write.
 */
export function serialiseCategoriesOff(categories: Iterable<NotificationCategory>): string {
  const kept = ALL_CATEGORIES.filter(
    (c) => CATEGORY_DEFS[c].workspaceSwitchable && [...categories].includes(c),
  )
  return JSON.stringify(kept)
}
