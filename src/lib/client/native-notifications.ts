import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type Schedule,
} from "@capacitor/local-notifications";
import { en } from "@/locales/en";
import { fmtTimeOnDate } from "@/lib/client/format-time";
import { isNativeApp } from "./app-channel";

const CHECKOUT_GROUP = "venzio-checkout";
const ARRIVAL_GROUP = "venzio-arrival";
const CHECKIN_GROUP = "venzio-checkin";

/** Android notification channels — must exist before channelId is used */
const CHANNEL_CHECKIN = "venzio_checkin";
const CHANNEL_REMINDERS = "venzio_reminders";
const CHANNEL_ARRIVAL = "venzio_arrival";

/** Stale reminder hours — must match en.notifications.stale keys */
export const STALE_REMINDER_HOURS = [4, 8, 12, 16, 18, 20, 22] as const;

export type ReminderIntervalHours = 2 | 4;

export interface NotificationPrefs {
  officeArrival: boolean;
  checkoutReminders: boolean;
  intervalHours: ReminderIntervalHours;
}

const DEFAULT_PREFS: NotificationPrefs = {
  officeArrival: true,
  checkoutReminders: true,
  intervalHours: 4,
};

const PREFS_KEY = "venzio_notification_prefs";

let androidChannelsReady = false;

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

function scheduleAt(at: Date): Schedule {
  if (isAndroid()) {
    return { at, allowWhileIdle: true };
  }
  return { at };
}

function soonSchedule(): Schedule {
  return scheduleAt(new Date(Date.now() + 500));
}

async function ensureAndroidChannels(): Promise<void> {
  if (!isAndroid() || androidChannelsReady) return;

  const channels = [
    {
      id: CHANNEL_CHECKIN,
      name: en.native.notifications.channelCheckin,
      description: en.native.notifications.channelCheckinDesc,
      importance: 4 as const,
      vibration: true,
    },
    {
      id: CHANNEL_REMINDERS,
      name: en.native.notifications.channelReminders,
      description: en.native.notifications.channelRemindersDesc,
      importance: 4 as const,
      vibration: true,
    },
    {
      id: CHANNEL_ARRIVAL,
      name: en.native.notifications.channelArrival,
      description: en.native.notifications.channelArrivalDesc,
      importance: 4 as const,
      vibration: true,
    },
  ];

  for (const channel of channels) {
    await LocalNotifications.createChannel(channel);
  }
  androidChannelsReady = true;
}

/** Permissions + Android channels + system notification toggle. */
export async function prepareNativeNotifications(): Promise<boolean> {
  if (!isNativeApp()) return false;

  const status = await LocalNotifications.checkPermissions();
  if (status.display !== "granted") {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== "granted") return false;
  }

  const enabled = await LocalNotifications.areEnabled();
  if (!enabled.value) return false;

  await ensureAndroidChannels();
  return true;
}

/** Capacitor local notifications (Android 13+ / iOS). Not the browser Notification API. */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  return prepareNativeNotifications();
}

function channelForGroup(group: string): string | undefined {
  if (!isAndroid()) return undefined;
  if (group === CHECKIN_GROUP) return CHANNEL_CHECKIN;
  if (group === CHECKOUT_GROUP) return CHANNEL_REMINDERS;
  if (group === ARRIVAL_GROUP) return CHANNEL_ARRIVAL;
  return CHANNEL_REMINDERS;
}

function buildNotification(
  partial: Omit<LocalNotificationSchema, "channelId"> & { group: string },
): LocalNotificationSchema {
  const channelId = channelForGroup(partial.group);
  return channelId ? { ...partial, channelId } : partial;
}

function staleHoursForPrefs(prefs: NotificationPrefs): number[] {
  if (prefs.intervalHours === 2) {
    return [...STALE_REMINDER_HOURS];
  }
  return STALE_REMINDER_HOURS.filter((h) => h % 4 === 0);
}

function notificationIdForStaleHour(hour: number): number {
  return 1000 + hour;
}

/** T+12h from check-in when the API omits scheduled_checkout_at. */
export function defaultScheduledCheckoutAt(checkinAtIso: string): string {
  const checkinMs = new Date(checkinAtIso).getTime();
  const base = Number.isFinite(checkinMs) ? checkinMs : Date.now();
  return new Date(base + 12 * 60 * 60 * 1000).toISOString();
}

/** Immediate confirmation after check-in + scheduled stale + auto-checkout warning. */
export async function notifyCheckInConfirmed(
  scheduledCheckoutAtIso: string,
): Promise<void> {
  if (!isNativeApp()) return;
  if (!(await prepareNativeNotifications())) return;

  const checkoutLabel = fmtTimeOnDate(scheduledCheckoutAtIso);
  const body = en.notifications.checkinConfirmed.body(checkoutLabel);

  await LocalNotifications.schedule({
    notifications: [
      buildNotification({
        id: 1100,
        title: en.notifications.checkinConfirmed.title,
        body,
        schedule: soonSchedule(),
        group: CHECKIN_GROUP,
        extra: { route: "/me" },
      }),
    ],
  });
}

export async function scheduleCheckoutReminders(
  checkinAtIso: string,
  scheduledCheckoutAtIso: string | null | undefined,
  prefs: NotificationPrefs = loadNotificationPrefs(),
): Promise<void> {
  if (!isNativeApp() || !prefs.checkoutReminders) return;
  if (!(await prepareNativeNotifications())) return;

  const checkinMs = new Date(checkinAtIso).getTime();
  if (!Number.isFinite(checkinMs)) return;

  await cancelCheckoutReminders();

  const now = Date.now();
  const scheduled =
    scheduledCheckoutAtIso ?? defaultScheduledCheckoutAt(checkinAtIso);

  const notifications: LocalNotificationSchema[] = [];

  for (const hour of staleHoursForPrefs(prefs)) {
    const copy =
      en.notifications.stale[hour as keyof typeof en.notifications.stale];
    if (!copy) continue;
    const at = checkinMs + hour * 3600_000;
    if (at > now) {
      notifications.push(
        buildNotification({
          id: notificationIdForStaleHour(hour),
          title: copy.title,
          body: copy.body,
          schedule: scheduleAt(new Date(at)),
          group: CHECKOUT_GROUP,
          extra: { route: "/me" },
        }),
      );
    }
  }

  const checkoutMs = new Date(scheduled).getTime();
  if (Number.isFinite(checkoutMs)) {
    const warnAt = checkoutMs - 15 * 60_000;
    if (warnAt > now) {
      notifications.push(
        buildNotification({
          id: 1099,
          title: en.notifications.autoCheckoutSoon.title,
          body: en.notifications.autoCheckoutSoon.body(
            fmtTimeOnDate(scheduled),
          ),
          schedule: scheduleAt(new Date(warnAt)),
          group: CHECKOUT_GROUP,
          extra: { route: "/me" },
        }),
      );
    }
  }

  if (notifications.length === 0) return;

  await LocalNotifications.schedule({ notifications });
}

export async function cancelCheckoutReminders(): Promise<void> {
  if (!isNativeApp()) return;
  const pending = await LocalNotifications.getPending();
  const ids = pending.notifications
    .filter((n) => (n.id >= 1000 && n.id < 1200) || n.id === 1100)
    .map((n) => n.id);
  if (ids.length) {
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
  }
}

export async function notifyOfficeArrival(officeName: string): Promise<void> {
  if (!isNativeApp() || !loadNotificationPrefs().officeArrival) return;
  if (!(await prepareNativeNotifications())) return;

  await LocalNotifications.schedule({
    notifications: [
      buildNotification({
        id: 2001,
        title: en.notifications.officeArrival.title,
        body: en.notifications.officeArrival.body(officeName),
        schedule: soonSchedule(),
        group: ARRIVAL_GROUP,
        extra: { route: "/me", geofence: true },
      }),
    ],
  });
}

/** Re-schedule after app restart when user still has an open check-in. */
export async function syncCheckoutRemindersForOpenEvent(
  checkinAt: string,
  scheduledCheckoutAt: string | null | undefined,
): Promise<void> {
  if (!isNativeApp()) return;
  const prefs = loadNotificationPrefs();
  if (!prefs.checkoutReminders) return;
  await scheduleCheckoutReminders(checkinAt, scheduledCheckoutAt, prefs);
}
