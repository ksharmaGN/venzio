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

/**
 * Copy for the document review notifications.
 *
 * Kept in this module rather than the inline `en.notifications` group because
 * that group is the original single-file copy and is closed to additions - new
 * strings go in a per-area module (invariant 16).
 *
 * These fire when an admin verifies or rejects an employee-supplied document.
 * Until they existed an admin could reject somebody's ID proof and the employee
 * was told nothing at all - the slot just silently went red the next time they
 * happened to open `/me/documents`.
 */
export const documentNotifications = {
  verifiedTitle: 'Document verified',
  verifiedBody: (documentName: string) => `Your ${documentName} has been verified.`,
  rejectedTitle: 'Document rejected',
  /**
   * The reason is the whole point of the notification - without it the employee
   * knows only that they must do something again, not what.
   */
  rejectedBody: (documentName: string, reason: string) =>
    `Your ${documentName} was rejected: ${reason}`,
  /** Defensive: `reject_reason` is required by the route, but the column is nullable. */
  rejectedBodyNoReason: (documentName: string) =>
    `Your ${documentName} was rejected. Please upload it again.`,
}
