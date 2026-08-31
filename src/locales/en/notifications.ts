/**
 * Copy for the `/me` notification surfaces.
 *
 * `en.notifications` in `src/locales/en.ts` holds the *push* notification
 * bodies (stale check-in reminders and friends). This module holds the UI copy
 * for the notification screens, and is imported directly
 * (`@/locales/en/notifications`) rather than through `en`.
 */
export const notificationsUi = {
  /** Unified view - every workspace, badged. */
  titleAll: 'All notifications',
  /** Scoped view - one workspace, no badges (the header already says which). */
  titleWorkspace: 'Notifications',
  markAllRead: 'Mark all read',
  empty: 'No notifications yet',
  emptyWorkspace: 'No notifications in this workspace yet',
  /** Badge for an account-level notification that belongs to no workspace. */
  personalBadge: 'Personal',
}
