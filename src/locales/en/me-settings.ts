/**
 * Copy for the secondary `/me` screens: Timeline (and the event row it renders),
 * Workspaces, Notifications and Settings.
 *
 * A separate module from `src/locales/en.ts` for the same reason as `./me`,
 * `./marketing` and `./documents`: that file is the long-lived product string
 * table and these screens churn together. Import it directly:
 *
 *   import { meSettings } from '@/locales/en/me-settings'
 *
 * Strings that already exist in `en.meTimeline`, `en.meOrgs`,
 * `en.meWsRegularization`, `en.notifications` and `en.auth` are NOT duplicated
 * here - those screens import both modules.
 */
export const meSettings = {
  // ── /me/timeline ──────────────────────────────────────────────────────────
  timeline: {
    title: 'Timeline',
    rangeFrom: 'From',
    rangeTo: 'To',
    /** "12 check-ins · 8 days" - the line under the range pickers. */
    summary: (checkins: number, days: number) =>
      `${checkins} check-in${checkins === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'}`,
  },

  // ── the row rendered per presence event ───────────────────────────────────
  event: {
    notePlaceholder: 'Add a note…',
    noteEmpty: 'Add a note…',
    noteSave: 'Save',
    noteSaving: 'Saving…',
    noteCancel: 'Cancel',
    noteEditLabel: 'Edit note',
    detailsShow: 'Details',
    detailsHide: 'Hide details',
    checkinLabel: 'Check-in',
    checkoutLabel: 'Checkout',
    remote: 'Remote',
    locationUnknown: 'Location not captured',
    mapLinkLabel: 'Open this location on a map',
    /** Checkout happened inside the configured radius. */
    distanceInside: (metres: number) => `${metres}m from office`,
    /** Checkout happened outside it - the `checkout_outside_radius` trust flag. */
    distanceOutside: (metres: number) => `${metres}m from office · outside radius`,
  },

  // ── /me/orgs ──────────────────────────────────────────────────────────────
  orgs: {
    title: 'Workspaces',
    /** "4 in office · 2 visited · 9 not in" */
    countsInOffice: (n: number) => `${n} in office`,
    countsVisited: (n: number) => `${n} visited`,
    countsNotIn: (n: number) => `${n} not in`,
  },

  // ── /me/settings ──────────────────────────────────────────────────────────
  settings: {
    title: 'Settings',
    saving: 'Please wait…',

    profile: {
      title: 'Profile',
      emailLabel: 'Email',
      nameLabel: 'Full name',
      nameEmpty: '—',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      saved: 'Saved',
      saveError: 'Failed to save',
    },

    email: {
      title: 'Change email',
      newLabel: 'New email address',
      newPlaceholder: 'new@example.com',
      sendCode: 'Send verification code',
      codeLabel: 'Verification code',
      codePlaceholder: '6-digit code',
      confirm: 'Confirm change',
      resend: 'Resend',
      codeSent: (email: string) => `Verification code sent to ${email}`,
      sendError: 'Failed to send code',
      updated: 'Email updated. Please log in again.',
      verifyError: 'Verification failed',
    },

    password: {
      title: 'Password',
      masked: '••••••••',
      edit: 'Edit',
      currentLabel: 'Current password',
      newLabel: 'New password',
      confirmLabel: 'Confirm new password',
      save: 'Save',
      cancel: 'Cancel',
      tooShort: 'Password must be at least 8 characters',
      mismatch: 'Passwords do not match',
      updated: 'Password updated',
      saveError: 'Failed',
    },

    tokens: {
      title: 'API tokens',
      intro: 'Use tokens to record check-ins from scripts or third-party tools.',
      revealWarning: "Copy this token now - it won't be shown again.",
      nameLabel: 'Token name',
      namePlaceholder: 'e.g. Home Mac',
      create: 'Create',
      empty: 'No tokens yet.',
      createError: 'Failed',
      created: (date: string) => `Created ${date}`,
      lastUsed: (date: string) => `Last used ${date}`,
      revoke: 'Revoke',
      revokeConfirm: 'Revoke this token? Any apps using it will stop working.',
    },

    org: {
      title: 'Organisation features',
      body: "Switch to an organisation account to manage your team's attendance, view dashboards, and configure location signals for your workspace.",
      cta: 'Switch to organisation account',
    },

    session: {
      title: 'Session',
      signOut: 'Sign out',
    },

    danger: {
      title: 'Danger zone',
      expand: 'Show danger zone',
      collapse: 'Hide danger zone',
      deactivateTitle: 'Deactivate account',
      deactivateBody:
        'Your check-ins and data are preserved - your account becomes invisible to all workspaces. You can reactivate anytime by logging back in.',
      deactivateCta: 'Deactivate account',
      confirmPrompt: 'Are you sure? This will sign you out immediately.',
      confirmYes: 'Yes, deactivate',
      confirmBusy: 'Deactivating…',
      confirmNo: 'Cancel',
      /** 409 from DELETE /api/me - the account still owns admin-less workspaces. */
      blockedTitle: (count: number) =>
        count === 1
          ? "You're the only admin of this workspace."
          : `You're the only admin of ${count} workspaces.`,
      blockedBody:
        "For each active workspace below, either promote another member to admin or archive it first. Archived workspaces don't block deactivation.",
      blockedPromote: (name: string) => `${name} - promote admin`,
      blockedOr: 'or',
      blockedArchive: 'archive workspace',
    },
  },
} as const
