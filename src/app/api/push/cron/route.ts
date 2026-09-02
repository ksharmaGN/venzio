import { NextRequest, NextResponse } from 'next/server'
import { getOpenEventsForCron, updatePushRemindersSent, autoCheckoutEvent } from '@/lib/db/queries/events'
import { sendPushToUser } from '@/lib/push'
import { notificationHref } from '@/lib/client/notification-href'
import { runReminderPass, type ReminderPassResult } from '@/lib/reminders'

const MILESTONES_H = [4, 8, 12, 16, 18, 20, 22]

/**
 * Every push in pass 1 is anchored on an open check-in, so they all want the
 * same destination: the check-in screen. Built through the shared resolver
 * rather than written as a literal so a future move of `/me` cannot leave the
 * service worker opening one URL and the in-app row another.
 */
const CHECKIN_URL = notificationHref(
  { type: 'checkin_reminder', ref_type: null, ref_id: null },
  'me',
)

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  // The same instant decides both the age cutoff and every elapsed-hours
  // calculation below, so a slow query cannot make an event pass the cutoff and
  // then be measured against a later clock.
  const events = await getOpenEventsForCron(new Date(now))

  for (const event of events) {
    try {
      const reminders: string[] = (() => {
        const parsed = JSON.parse(event.push_reminders_sent ?? '[]')
        return Array.isArray(parsed) ? parsed : []
      })()

      /**
       * Persist the dedupe key the moment a push is actually delivered.
       *
       * This used to be one write at the end of the event, after every push for
       * that event had been sent. GitHub Actions calls this endpoint with
       * `curl -m 30`: when the request is cut off mid-flight the pushes are
       * already out on the wire but `push_reminders_sent` was never written, so
       * the next tick sees a virgin row and sends the same notifications again.
       * Writing after each individual push makes the delivered set and the
       * recorded set diverge by at most one.
       */
      const claim = async (key: string) => {
        reminders.push(key)
        await updatePushRemindersSent(event.id, reminders)
      }

      const checkinMs = new Date(
        event.checkin_at.includes('T') ? event.checkin_at : event.checkin_at.replace(' ', 'T') + 'Z'
      ).getTime()
      const hoursElapsed = (now - checkinMs) / 3_600_000

      // 1. Milestone notifications — fire once per milestone hour
      for (const h of MILESTONES_H) {
        const key = `${h}h`
        if (hoursElapsed >= h && !reminders.includes(key)) {
          await sendPushToUser(event.user_id, {
            title: 'Still working?',
            body: `You've been checked in for ${h} hours.`,
            tag: `milestone-${h}h`,
            data: { url: CHECKIN_URL },
          })
          await claim(key)
        }
      }

      if (event.scheduled_checkout_at) {
        const checkoutMs = new Date(event.scheduled_checkout_at).getTime()
        const minsRemaining = (checkoutMs - now) / 60_000
        const warnKey = `warn_${event.scheduled_checkout_at.slice(0, 16)}`

        // 2. Warning push — fires when checkout is within this cron window (≤60 min away)
        if (minsRemaining > 0 && minsRemaining <= 60 && !reminders.includes(warnKey)) {
          const hardLimitMs = checkinMs + 24 * 3_600_000
          const canExtend = checkoutMs + 4 * 3_600_000 <= hardLimitMs
          const minsLabel = Math.round(minsRemaining)

          await sendPushToUser(event.user_id, {
            title: 'Auto-checkout soon',
            body: `Auto-checkout in ~${minsLabel} min. Hours without your location won't count. Checkout with location or extend if still working.`,
            tag: 'auto-checkout-warning',
            requireInteraction: true,
            actions: [
              ...(canExtend ? [{ action: 'extend', title: 'Extend 4h' }] : []),
              { action: 'checkout', title: 'Checkout Now' },
            ],
            data: { url: CHECKIN_URL },
          })
          await claim(warnKey)
        }

        // 3. Auto-checkout — fires when scheduled time has passed
        if (now >= checkoutMs && !reminders.includes('autocheckedout')) {
          await autoCheckoutEvent(event.id, new Date(now).toISOString())
          await sendPushToUser(event.user_id, {
            title: 'Auto-checked out',
            body: "You've been auto-checked out. Hours logged without location data won't count in reports.",
            tag: 'auto-checked-out',
            data: { url: CHECKIN_URL },
          })
          await claim('autocheckedout')
        }
      }
    } catch (err) {
      console.error(`[cron] failed to process event ${event.id}:`, err)
    }
  }

  // 4. Wall-clock check-in / check-out reminders.
  //
  // A second, workspace-anchored pass. The loop above starts from open events,
  // so it can only ever see people who are already checked in - it is
  // structurally incapable of noticing someone who never checked in at all.
  // Wrapped separately so a failure here cannot discard the work above.
  let reminders: ReminderPassResult | null = null
  try {
    reminders = await runReminderPass(new Date(now))
  } catch (err) {
    console.error('[cron] reminder pass failed:', err)
  }

  return NextResponse.json({ processed: events.length, reminders })
}
