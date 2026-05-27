import { LocalNotifications } from '@capacitor/local-notifications'
import { isNativeApp } from './app-channel'

const CHECKOUT_GROUP = 'venzio-checkout'
const ARRIVAL_GROUP = 'venzio-arrival'

export type ReminderIntervalHours = 2 | 4

export interface NotificationPrefs {
  officeArrival: boolean
  checkoutReminders: boolean
  intervalHours: ReminderIntervalHours
}

const DEFAULT_PREFS: NotificationPrefs = {
  officeArrival: true,
  checkoutReminders: true,
  intervalHours: 4,
}

const PREFS_KEY = 'venzio_notification_prefs'

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

async function ensurePermission(): Promise<boolean> {
  if (!isNativeApp()) return false
  const status = await LocalNotifications.checkPermissions()
  if (status.display === 'granted') return true
  const req = await LocalNotifications.requestPermissions()
  return req.display === 'granted'
}

/** Schedule checkout reminders at +2h/+4h/+8h/+12h and auto-checkout warning at T+12h−15m. */
export async function scheduleCheckoutReminders(
  checkinAtIso: string,
  prefs: NotificationPrefs = loadNotificationPrefs(),
): Promise<void> {
  if (!isNativeApp() || !prefs.checkoutReminders) return
  if (!(await ensurePermission())) return

  const checkinMs = new Date(checkinAtIso).getTime()
  if (!Number.isFinite(checkinMs)) return

  await cancelCheckoutReminders()

  const intervals =
    prefs.intervalHours === 2 ? [2, 4, 8, 12] : [4, 8, 12]
  const now = Date.now()
  const notifications: { id: number; title: string; body: string; schedule: { at: Date }; group?: string }[] = []

  intervals.forEach((hours, idx) => {
    const at = checkinMs + hours * 3600_000
    if (at > now) {
      notifications.push({
        id: 1000 + idx,
        title: 'Still checked in?',
        body: `You checked in ${hours}h ago. Tap to check out when you leave.`,
        schedule: { at: new Date(at) },
        group: CHECKOUT_GROUP,
      })
    }
  })

  const warnAt = checkinMs + 12 * 3600_000 - 15 * 60_000
  if (warnAt > now) {
    notifications.push({
      id: 1099,
      title: 'Auto checkout soon',
      body: 'Venzio will check you out in 15 minutes unless you check out first.',
      schedule: { at: new Date(warnAt) },
      group: CHECKOUT_GROUP,
    })
  }

  if (notifications.length === 0) return

  await LocalNotifications.schedule({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: n.schedule,
      extra: { route: '/me' },
    })),
  })
}

export async function cancelCheckoutReminders(): Promise<void> {
  if (!isNativeApp()) return
  const pending = await LocalNotifications.getPending()
  const ids = pending.notifications
    .filter((n) => n.id >= 1000 && n.id < 1100)
    .map((n) => n.id)
  if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
}

export async function notifyOfficeArrival(officeName: string): Promise<void> {
  if (!isNativeApp() || !loadNotificationPrefs().officeArrival) return
  if (!(await ensurePermission())) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 2001,
        title: 'You arrived',
        body: `You're near ${officeName}. Tap to check in.`,
        extra: { route: '/me', geofence: true },
      },
    ],
  })
}
