import {
  getWorkspacesWithMemberReminders,
  getMemberReminderTimes,
  getMembersMissingCheckin,
  getMembersStillCheckedIn,
  recordReminderSent,
  type ReminderKind,
  type ReminderMember,
  type WorkspaceReminderConfig,
} from '@/lib/db/queries/reminders'
import { listHolidayDatesInRange } from '@/lib/db/queries/holidays'
import { getLeaveRequestsInRange } from '@/lib/db/queries/leaves'
import { getActiveParentalUserIds } from '@/lib/db/queries/maternity'
import { sendPushToUser } from '@/lib/push'
import { notificationHref } from '@/lib/client/notification-href'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'
import { wsReminders } from '@/locales/en/ws-reminders'

/**
 * Scheduled check-in / check-out reminders - the *wall-clock* pass.
 *
 * The reminders that already existed are event-anchored: they start from an
 * open `presence_events` row and count elapsed hours. That design structurally
 * cannot notice somebody who never checked in, because there is no row to
 * iterate. This pass anchors on workspaces instead: for every workspace where
 * somebody has asked for a reminder, work out whose configured time is now in
 * the workspace's own timezone, then find who still owes a check-in or
 * check-out.
 *
 * **The schedule is the member's, not the workspace's.** It used to be one pair
 * of times on the workspace row, pushed at everybody; it is now one pair per
 * member per workspace in `member_reminder_prefs`, and HAVING A TIME SET IS THE
 * OPT-IN. There is no separate mute, because there is no separate switch: a
 * member who wants no nudge stores no time. `workspaces.checkin_reminder_at` /
 * `checkout_reminder_at` still exist and are still written, but nothing in this
 * file reads them and nothing may start to - a delivery fallback to the
 * workspace time would resurrect the push-at-everybody behaviour this move
 * exists to end.
 *
 * The pass is also **push-only**. It writes no `notifications` row at all, so
 * `checkin_reminder` / `checkout_reminder` are no longer `NotificationType`s
 * and `reminders` is no longer a category. A reminder is a nudge about the next
 * five minutes; a feed row about it, read the following afternoon, is litter.
 *
 * Everything here is about NOT nagging. A reminder that fires on someone's
 * approved leave, on a public holiday or on a Sunday is how a user ends up
 * disabling push permanently - which would also cost them the approval
 * notifications that work today. The gates run in this order:
 *
 *   1. workspace archived            → excluded by the query
 *   2. today not a working day       → skip the whole workspace
 *   3. today is a company holiday    → skip the whole workspace
 *   4. read the members' times and compute who is DUE for each kind
 *                                    → if nobody is, return before any
 *                                       member query runs
 *   5. member on approved leave      → skip the member
 *   6. already reminded today        → skip the member (reminder_log)
 *
 * Gate 4 moved INSIDE the workspace - it used to be one comparison against the
 * workspace's own configured time, and it is now a comparison per member - but
 * the loop still iterates WORKSPACES. That is deliberate: the holiday lookup,
 * the leave lookup and the parental-leave lookup are all keyed on the workspace
 * and answer the question once for every member of it. A member-anchored loop
 * would re-read all three per person, which for a 500-person workspace is
 * ~1500 extra round trips every thirty minutes.
 *
 * Gate 4's early return is load-bearing for COST, not just tidiness. On most of
 * the 48 daily ticks not one member of a given workspace has a time falling in
 * the window, and `getMembersMissingCheckin` is the expensive query in this
 * file - a NOT EXISTS over every member's presence events for the day. Reading
 * the schedules first (one indexed read of a handful of rows) and returning
 * when the due set is empty is what keeps a quiet tick nearly free.
 *
 * This pass does NOT route through `notify()`, and it remains a sanctioned
 * exception to invariant 24 - but for a different reason than before. It is no
 * longer that it filters mutes in bulk: there are no mutes now. It is that
 * there is nothing for `notify()` to do. `notify()`'s entire job is to write
 * the feed row unconditionally and then decide whether the push follows; this
 * pass writes no feed row, carries no category to resolve, and sends a body
 * that differs per recipient (each member's own time). Handing it to `notify()`
 * would mean one call per member inside a loop over every unchecked-in person
 * in every workspace, to re-derive a decision that has already been made by the
 * presence of a row in `member_reminder_prefs`.
 */

/**
 * How late a reminder may still be delivered, in minutes past its configured
 * wall-clock time.
 *
 * The workflow ticks at :00 and :30, so a 30-minute window is exactly one tick
 * wide: every minute-of-day is covered by exactly one tick - no minute is
 * unreachable, and no minute is claimed twice - and the worst-case lateness is
 * 29 minutes.
 *
 * **The accepted cost is stated rather than hidden:** GitHub Actions cron is
 * best-effort, so a skipped or badly-delayed run now DROPS that person's
 * reminder for the day instead of delivering it stale. That is the intended
 * trade. The window was 90 minutes precisely so a missed tick could still be
 * caught up, and catching up is the wrong thing to do here - a reminder to
 * check in that lands an hour and a half after the fact is not a reminder, it
 * is a nag, and a nag is what makes somebody revoke push permission outright.
 * That permission is shared with the approval notifications they actually want,
 * so the cost of one over-late nudge is every notification that matters. A
 * missed nudge costs nothing anybody will notice.
 *
 * `reminder_log` still guarantees at most one delivery per person, per kind,
 * per local day, whatever the window is - it is the dedupe, not this constant.
 */
export const REMINDER_GRACE_MIN = 30

export interface ReminderPassResult {
  workspaces: number
  sent: number
  skipped: {
    nonWorkingDay: number
    holiday: number
    onLeave: number
    alreadySent: number
    /** Kinds where somebody has a time set, but none of those times is due now. */
    outsideWindow: number
    /**
     * Workspaces that cleared the day gates and still had nobody due, for
     * either kind - the gate 4 early return. On a healthy run this is by far
     * the largest number in the object: a workspace is due at most twice a day
     * and this pass looks at it 48 times.
     */
    noneDue: number
  }
  errors: number
}

/** 'HH:MM' → minutes since local midnight. Returns null for anything else. */
export function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** 'YYYY-MM-DD' → the next calendar day. Pure calendar maths, timezone-free. */
function nextLocalDate(localDate: string): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD' → weekday number, 0 = Sunday, matching `workspaces.working_days`. */
function weekdayOf(localDate: string): number {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
}

function parseWorkingDays(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw ?? '[1,2,3,4,5]')
    if (Array.isArray(parsed) && parsed.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return parsed
    }
  } catch { /* fall through to the default */ }
  return [1, 2, 3, 4, 5]
}

function emptyResult(): ReminderPassResult {
  return {
    workspaces: 0,
    sent: 0,
    skipped: {
      nonWorkingDay: 0,
      holiday: 0,
      onLeave: 0,
      alreadySent: 0,
      outsideWindow: 0,
      noneDue: 0,
    },
    errors: 0,
  }
}

/**
 * Run the wall-clock pass over every workspace where a member has configured a
 * reminder. `now` is injectable so the behaviour can be exercised at an
 * arbitrary instant.
 */
export async function runReminderPass(now: Date = new Date()): Promise<ReminderPassResult> {
  const result = emptyResult()

  const workspaces = await getWorkspacesWithMemberReminders()
  result.workspaces = workspaces.length

  for (const ws of workspaces) {
    try {
      await processWorkspaceReminders(ws, now, result)
    } catch (err) {
      // One workspace's bad timezone string or missing member must never abort
      // the run for every other workspace - same containment as the per-event
      // loop in the cron route.
      result.errors++
      console.error(`[cron] failed to process reminders for workspace ${ws.id}:`, err)
    }
  }

  return result
}

/** user id → the 'HH:MM' that member chose, for the members due right now. */
type DueMap = Map<string, string>

async function processWorkspaceReminders(
  ws: WorkspaceReminderConfig,
  now: Date,
  result: ReminderPassResult,
): Promise<void> {
  const tz = ws.display_timezone || 'UTC'
  const localDate = todayInTz(tz)

  // ── Gate 2: is today a working day for this workspace? ────────────────────
  // A member chooses WHEN they are reminded; they do not get to be reminded on
  // a day the organisation does not work. Cheapest gate in the file - the
  // column arrived with the workspace row - so it runs first.
  const workingDays = parseWorkingDays(ws.working_days)
  if (!workingDays.includes(weekdayOf(localDate))) {
    result.skipped.nonWorkingDay++
    return
  }

  // ── Gate 3: is today a company holiday? ───────────────────────────────────
  const holidays = await listHolidayDatesInRange(ws.id, localDate, localDate)
  if (holidays.has(localDate)) {
    result.skipped.holiday++
    return
  }

  // The workspace-local day as a UTC window. Derived entirely from
  // localMidnightToUtc so DST and half-hour zones are handled by the one helper
  // that already gets them right - no hand-rolled offset arithmetic here.
  const dayStartUtc = localMidnightToUtc(localDate, tz)
  const dayEndUtc = localMidnightToUtc(nextLocalDate(localDate), tz)

  // Minutes elapsed since local midnight, for the same reason. Every member's
  // stored 'HH:MM' is wall-clock in THIS workspace's timezone, so one
  // conversion serves all of them.
  const minutesNow = (now.getTime() - new Date(dayStartUtc).getTime()) / 60_000

  // ── Gate 4: whose configured time is now? ─────────────────────────────────
  //
  // One indexed read of this workspace's schedules, then a pure comparison per
  // member. Note what is NOT here: no fallback to `ws.checkin_reminder_at`. A
  // member with no row and a member with a NULL column both get nothing, which
  // is the entire point of moving the schedule - silence is the default until
  // somebody asks.
  const due = (target: number | null): boolean =>
    target !== null && minutesNow >= target && minutesNow - target < REMINDER_GRACE_MIN

  const schedules = await getMemberReminderTimes(ws.id)
  const checkinDue: DueMap = new Map()
  const checkoutDue: DueMap = new Map()
  let anyCheckinConfigured = false
  let anyCheckoutConfigured = false

  for (const row of schedules) {
    if (row.checkin_at) {
      anyCheckinConfigured = true
      if (due(parseHhMm(row.checkin_at))) checkinDue.set(row.user_id, row.checkin_at)
    }
    if (row.checkout_at) {
      anyCheckoutConfigured = true
      if (due(parseHhMm(row.checkout_at))) checkoutDue.set(row.user_id, row.checkout_at)
    }
  }

  // Counted per KIND: somebody in this workspace wants this reminder, just not
  // in this half hour. Distinct from `noneDue` below, which is the whole
  // workspace having nothing to do on this tick.
  if (anyCheckinConfigured && checkinDue.size === 0) result.skipped.outsideWindow++
  if (anyCheckoutConfigured && checkoutDue.size === 0) result.skipped.outsideWindow++

  // The early return, and it is about cost rather than tidiness. The two member
  // queries below are the expensive ones in this file - each is a NOT EXISTS /
  // EXISTS over every active member's presence events for the day - and on most
  // of the 48 daily ticks nobody here is due. Returning now means a quiet
  // workspace costs one holiday lookup and one schedule read, and never touches
  // `getMembersMissingCheckin` at all. The leave and parental reads below are
  // skipped for the same reason.
  if (checkinDue.size === 0 && checkoutDue.size === 0) {
    result.skipped.noneDue++
    return
  }

  // ── Gate 5 (gathered once per workspace): members absent today ───────────
  // Two independent sources. `leave_requests` covers ordinary leave;
  // `maternity_cases` is a separate table keyed by employee_id, so the leave
  // query cannot see it. Missing the second one means reminding someone to
  // check in every working day of their parental leave.
  //
  // `getActiveParentalUserIds` covers BOTH case types - maternity and
  // paternity. It takes no case_type argument on purpose; see its doc comment.
  //
  // Read here - after gate 4, not before it - because these are per-workspace
  // reads that only a workspace with somebody due ever needs to pay for.
  const [leaves, onParentalLeave] = await Promise.all([
    getLeaveRequestsInRange(ws.id, localDate, localDate),
    getActiveParentalUserIds(ws.id, localDate),
  ])
  const onLeave = new Set([...leaves.map((l) => l.user_id), ...onParentalLeave])

  if (checkinDue.size > 0) {
    const members = await getMembersMissingCheckin(ws.id, dayStartUtc, dayEndUtc)
    await notifyMembers(ws, members, 'checkin', localDate, onLeave, checkinDue, result)
  }

  if (checkoutDue.size > 0) {
    const members = await getMembersStillCheckedIn(ws.id, dayStartUtc, dayEndUtc)
    await notifyMembers(ws, members, 'checkout', localDate, onLeave, checkoutDue, result)
  }
}

async function notifyMembers(
  ws: WorkspaceReminderConfig,
  members: ReminderMember[],
  kind: ReminderKind,
  localDate: string,
  onLeave: Set<string>,
  dueTimes: DueMap,
  result: ReminderPassResult,
): Promise<void> {
  const title = kind === 'checkin' ? wsReminders.push.checkinTitle : wsReminders.push.checkoutTitle
  const tag = kind === 'checkin' ? wsReminders.push.checkinTag : wsReminders.push.checkoutTag

  // The destination still resolves through the one resolver rather than a
  // literal here, even though this is now the only channel. `notificationHref`
  // keys on the type STRING and is deliberately not typed against
  // `NotificationType`, so these two names still resolve there after leaving
  // that union - and they have to, because historical `notifications` rows in
  // the database still carry them and still have to open somewhere sensible.
  // Writing '/me' inline here is exactly how the announcement fan-out drifted.
  const notifType = kind === 'checkin' ? 'checkin_reminder' : 'checkout_reminder'
  const url = notificationHref(
    { type: notifType, ref_type: 'reminder', ref_id: localDate, workspace_slug: ws.slug },
    'me',
  )

  for (const member of members) {
    // Not due for this member. The member query answers "who owes us a
    // check-in", which is a superset of "who asked to be reminded about it".
    const configured = dueTimes.get(member.user_id)
    if (!configured) continue

    try {
      // ── Gate 5: approved leave covering today ────────────────────────────
      if (onLeave.has(member.user_id)) {
        result.skipped.onLeave++
        continue
      }

      // ── Gate 6: already reminded for this local date ─────────────────────
      // The insert IS the check, and claiming the slot BEFORE the send is what
      // makes two overlapping cron runs silent rather than a second push. That
      // ordering mattered before; it is now the only dedupe there is, because
      // nothing else records that this reminder happened - there is no feed row
      // to notice and the push itself leaves no trace on our side. A
      // read-then-write here would let both runs past the line.
      const claimed = await recordReminderSent(ws.id, member.user_id, kind, localDate)
      if (!claimed) {
        result.skipped.alreadySent++
        continue
      }

      // The body carries THIS member's own time, not a workspace policy - each
      // recipient chose their own, so the string is built per member rather
      // than once per kind. The workspace NAME stays in it: a push lands on a
      // phone with no workspace pill above it and no surrounding screen, so if
      // the text does not say which workspace it is about, nothing does - and a
      // member of two workspaces can get two different reminders in one morning.
      const body =
        kind === 'checkin'
          ? wsReminders.push.checkinBody(ws.name, configured)
          : wsReminders.push.checkoutBody(ws.name, configured)

      await sendPushToUser(member.user_id, {
        title,
        body,
        tag: `${tag}-${localDate}`,
        data: { url },
      })
      result.sent++
    } catch (err) {
      result.errors++
      console.error(`[cron] failed to send ${kind} reminder to ${member.user_id} in ${ws.id}:`, err)
    }
  }
}
