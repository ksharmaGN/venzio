/**
 * Copy for the workspace admin shell, the Overview dashboard and the
 * Attendance screen (src/components/ws/*, src/app/ws/[slug]/**).
 *
 * A separate module from `src/locales/en.ts` for the same reason as `./me` and
 * `./documents`: that file is the long-lived product string table and these
 * screens churn together. Import it directly:
 *
 *   import { wsAdmin } from '@/locales/en/ws-overview'
 *
 * The strings that do NOT live here are the sidebar tab labels - the sidebar
 * reads `en.wsNav.screens` as a `Record<Screen, string>`, so a screen's label
 * has to be in that record or the build fails.
 */

export const wsAdmin = {
  /** Sidebar + topbar chrome. */
  shell: {
    navLabel: 'Workspace sections',
    switchWorkspace: 'Switch workspace',
    accountMenu: 'Account menu',
    /** Rendered as a chip beside the role badge, e.g. "growth plan". */
    planChip: (plan: string) => `${plan} plan`,
    menuSettings: 'Settings',
    menuWorkspaces: 'All workspaces',
    menuProfile: 'My profile',
    menuSignOut: 'Sign out',
  },

  /** /ws/:slug - the Overview dashboard. */
  overview: {
    exportReport: 'Export report',
    exporting: 'Exporting…',
    exportFailed: 'Export failed',

    /**
     * The tile counts active workspace members, not `employees` rows - HR
     * records are optional, so "employees" would name the wrong set.
     */
    headcountTitle: 'Total headcount',
    headcountHint: 'Active workspace members',
    inOfficeTitle: 'In office',
    inOfficeHint: 'currently in office',
    remoteTitle: 'Remote',
    remoteHint: 'working remotely',

    officePresenceTitle: 'Office presence',
    officePresenceHint: 'people in office by hour · today',
    officePresenceChartLabel: 'People in office by hour today',

    activeMembersTitle: 'Current active members',
    locationColumn: 'Location',
    membersColumn: 'Members',
    noActivity: 'No activity yet today.',

    viewAll: (count: number) => `View all ${count} ›`,

    planLimitReached: (used: number, max: number, plan: string) =>
      `Member limit reached - ${used}/${max} on the ${plan} plan. Upgrade to add more members.`,
    planLimitNear: (used: number, max: number, plan: string) =>
      `Approaching member limit - ${used}/${max} on the ${plan} plan.`,
    departmentChartLabel: 'Headcount by department',
    /** The bar covering members with no department on file. */
    departmentUnknown: 'No HR details',
    departmentCoverage: (withDept: number, total: number) =>
      `${withDept} of ${total} member(s) have a department on file`,
    departmentEmpty: 'No departments on file yet',
    departmentEmptyHint: 'Departments come from HR details, which are optional.',
    departmentEmptyAction: 'Add HR details ›',

    /**
     * Celebrations read birthdays and joining dates off HR records, so an empty
     * fortnight and "nobody has HR details" look identical. Say which.
     */
    celebrationsEmptyHint: 'Birthdays and work anniversaries come from HR details.',
  },

  /** /ws/:slug/attendance - today's roster and the regularization queue. */
  attendance: {
    pageTitle: 'Attendance',
    pageSubtitle: 'Today',
    showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,

    verifiedWfoTitle: 'Verified WFO',
    onLeaveTitle: 'On leave',
    partialTitle: 'Partial / unverified',
    regularizationsTitle: 'Regularizations',

    colName: 'Name',
    colRole: 'Role',
    colToday: 'Today',
    colTime: 'Time',
    rosterEmptyTitle: 'Nobody on the roster yet',
    rosterEmptyHint: 'Members appear here as soon as they join the workspace.',

    queueTitle: 'Regularization requests',
    queueEmptyTitle: 'No pending regularizations',
    queueEmptyHint: 'Requests raised from a member timeline land here.',

    /** Drill-down slide-over. */
    statusEyebrow: "Today's status",
    signalsEyebrow: 'Signals matched',
    detailsEyebrow: 'Check-in detail',
    signalGps: 'GPS',
    signalWifi: 'Wi-Fi',
    signalIp: 'IP',
    signalMatched: 'matched',
    signalUnmatched: 'not matched',
    checkedInAt: 'Checked in',
    checkedOutAt: 'Checked out',
    stillIn: 'Still checked in',
    locationLabel: 'Location',
    noEventToday: 'No check-in recorded today.',
    trustFlags: 'Trust flags',
    statusOverride: 'Override',
    statusSuspicious: 'Suspicious',
    viewTimeline: 'Open full timeline',
    close: 'Close',

    overrideEyebrow: 'Override to present',
    overrideAction: 'Mark as present',
    overrideNote:
      'This never modifies the original event — it is stored as a separate, additive override.',
    overrideDone: 'Marked as present — override recorded.',
    overrideFailed: 'Could not record the override.',
    overrideUnavailable:
      'An admin override is recorded by approving this person’s regularization request. There is no pending request for them today.',
    alreadyVerified: 'This day is already counted as in-office.',

    declineDone: 'Regularization declined.',
    declineFailed: 'Could not decline the request.',
  },

  /** /ws/:slug/approvals - additions to the existing en.wsApprovals block. */
  approvals: {
    filterDocuments: 'Documents',
    countOf: (shown: number, total: number) => `${shown} of ${total} item(s)`,
    reviewDocument: 'Review ›',
    loadFailed: 'Could not load approvals.',
    actionFailed: 'Could not action that request.',
  },
} as const
