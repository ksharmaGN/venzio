/**
 * Copy for the `/ws` admin screens re-skinned onto the app design system:
 * Reports, Settings (six tabs incl. Leave policies, Balances and Billing),
 * Holidays, Roles, Monthly activity, the Insights member table and the
 * workspace picker.
 *
 * Kept in its own module rather than folded into `src/locales/en.ts` so these
 * screens can be edited without touching the shared file. Strings that already
 * existed before the re-skin stay in `en.wsSettings` / `en.wsRoles` and are
 * imported from there - this file holds only what the new layout added.
 *
 *   import { wsAdmin } from '@/locales/en/ws-settings'
 */
export const wsAdmin = {
  // ── /ws/[slug]/reports ─────────────────────────────────────────────────────
  reports: {
    pageTitle: 'Reports',

    exportIntro: 'Generate and export HR reports as a spreadsheet.',

    attendanceTitle: 'Attendance summary',
    attendanceBody: 'Daily presence per employee for one month, with WFO / WFH / leave colouring and a legend sheet.',
    leaveTitle: 'Leave balance',
    leaveBody: 'Opening balance, days taken and the remainder, per employee and leave type.',
    headcountTitle: 'Headcount & attrition',
    headcountBody: 'Every member with the role they hold, their status and their join date.',
    expenseTitle: 'Expense & claims',
    expenseBody: 'Travel and reimbursement claims by status.',
    comingSoon: 'Coming soon',

    generateBtn: 'Generate',
    generatingBtn: 'Generating…',
    monthLabel: 'Month',
    monthFieldId: 'report-month',

    trendTitle: 'WFO trend · last 14 days',
    trendHint: 'Distinct people present per working day. Non-working days are not plotted.',
    trendAria: 'People present per working day over the last 14 days',
    trendEmpty: 'No presence recorded in the last 14 days.',
    trendUnavailable: 'The trend needs analytics access, which this role does not hold.',
    trendTitleFor: (label: string, value: number) =>
      `${label}: ${value} ${value === 1 ? 'person' : 'people'}`,

    // Plan / permission responses from GET /api/ws/[slug]/export
    planGate: 'Spreadsheet export is available on the Starter and Growth plans.',
    planHistoryGate: 'That month is outside your plan’s history window. Pick a more recent month or upgrade.',
    exportForbidden: 'You do not have permission to export this workspace.',
    exportFailed: 'The report could not be generated. Please try again.',
    exportDone: 'Report downloaded.',
    viewPricing: 'View pricing',
  },

  // ── /ws/[slug]/settings ────────────────────────────────────────────────────
  settings: {
    tabOrg: 'Org details',
    tabLeave: 'Leave policies',
    tabBalances: 'Balances',
    tabSignals: 'Signals',
    tabDomains: 'Domains',
    tabBilling: 'Billing',

    orgSectionTitle: 'Organisation details',
    leaveReadOnlyNote: 'Your role can view this configuration but not change it.',

    // Shown instead of the org form when GET /api/ws/[slug] fails. The form is
    // withheld on purpose: its initial state is a set of defaults, and saving
    // those would overwrite the workspace's real timezone, working days and
    // reminders with values nobody chose.
    orgLoadFailedTitle: 'Settings could not be loaded',
    orgLoadFailedBody:
      'Nothing has been changed. This form stays hidden until the saved configuration is on screen — editing it now would overwrite your timezone, working days and reminders with defaults.',
    orgLoadFailedRetry: 'Try again',
    signalsAndTitle: 'Verification uses AND logic — every configured signal must match for a check-in to count as verified.',

    fieldIds: {
      name: 'ws-name',
      timezone: 'ws-timezone',
    },
  },

  // ── Settings › Billing (read-only) ─────────────────────────────────────────
  billing: {
    currentPlanLabel: 'Current plan',
    limitsLabel: 'What this plan includes',
    maxUsers: (n: number | null) => (n === null ? 'Unlimited members' : `Up to ${n} members`),
    history: (months: number | null) =>
      months === null
        ? 'Unlimited history'
        : months % 12 === 0
          ? `${months / 12} year${months / 12 === 1 ? '' : 's'} of history`
          : `${months} months of history`,
    locations: (n: number) => `${n} signal location${n === 1 ? '' : 's'}`,
    csvYes: 'Spreadsheet export included',
    csvNo: 'No spreadsheet export',
    manageBtn: 'Manage billing',
    manageNote: 'Billing is not yet self-serve. Nothing happens when you press this — email us and we will move your workspace onto another plan by hand.',
    comparePlans: 'Compare plans',
  },

  // ── /ws/[slug]/holidays ────────────────────────────────────────────────────
  holidays: {
    pageTitle: 'Holiday calendar',
    pageSubtitle: (year: number) => `Public holidays observed by this workspace in ${year}.`,
    prevYear: 'Previous year',
    nextYear: 'Next year',

    addBtn: 'Add holiday',
    importBtn: 'Import',
    importingBtn: 'Importing…',
    importTitle: 'Import holidays',
    importDropLabel: 'Choose or drop a .csv / .xlsx file',
    importHint: 'Columns: name, date (YYYY-MM-DD) and an optional description. Maximum file size 2 MB.',
    importClose: 'Close',
    importResult: (inserted: number, updated: number, skipped: number) =>
      skipped > 0
        ? `${inserted} added, ${updated} updated, ${skipped} skipped`
        : `${inserted} added, ${updated} updated`,
    importFailed: 'Import failed',
    importRowError: (row: number, reason: string) => `Row ${row}: ${reason}`,
    dismiss: 'Dismiss',

    colName: 'Name',
    colDate: 'Date',
    colDescription: 'Description',
    colActions: 'Actions',
    selectAll: 'Select every holiday',
    selectOne: (name: string) => `Select ${name}`,
    edit: 'Edit',
    delete: 'Delete',

    formAddTitle: 'Add a holiday',
    formEditTitle: 'Edit holiday',
    fieldName: 'Name',
    fieldNamePlaceholder: 'e.g. Republic Day',
    fieldDate: 'Date',
    fieldDescription: 'Description',
    fieldDescriptionPlaceholder: 'Optional',
    saveBtn: 'Save',
    addSubmitBtn: 'Add',
    cancelBtn: 'Cancel',
    requiredError: 'A name and a date are required.',
    duplicateError: 'A holiday with this name and date already exists.',
    genericError: 'Something went wrong. Please try again.',

    emptyTitle: (year: number) => `No holidays in ${year}`,
    emptyHint: 'Add them one at a time, or import a sheet.',

    selectedCount: (n: number) => `${n} selected`,
    deselectAll: 'Deselect all',
    bulkDeleteBtn: (n: number) => `Delete ${n}`,
    bulkDeleteFailed: (n: number) => `${n} holiday${n === 1 ? '' : 's'} could not be deleted`,

    deleteTitle: 'Delete holiday',
    deleteBody: (name: string) => `Delete “${name}”? This cannot be undone.`,
    bulkDeleteTitle: (n: number) => `Delete ${n} holiday${n === 1 ? '' : 's'}`,
    bulkDeleteBody: (n: number) => `Delete the ${n} selected holiday${n === 1 ? '' : 's'}? This cannot be undone.`,
    deleteConfirm: 'Delete',
    deletingConfirm: 'Deleting…',

    footerCount: (n: number, year: number) => `${n} holiday${n === 1 ? '' : 's'} in ${year}`,
  },

  // ── /ws/[slug]/roles - additions to en.wsRoles ─────────────────────────────
  roles: {
    memberCountAria: (n: number) => `${n} member${n === 1 ? '' : 's'}`,
    systemBadge: 'Built-in',
    detailHeading: 'Permissions',
    detailHint: 'Read is ticked automatically whenever Write or Delete is on. Cells you cannot grant are the ones your own role does not hold.',
    selectPrompt: 'Select a role to see what it can do.',
    rowAllLabel: 'All',
  },

  // ── /ws/[slug]/monthly (the “Activity” nav screen) ─────────────────────────
  monthly: {
    pageTitle: 'Monthly activity',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    todayBtn: 'Today',
    exportBtn: 'Export report',
    exportingBtn: 'Exporting…',
    workingDays: (n: number) => `${n} working days`,

    legendOffice: 'Office',
    legendPresent: 'Present',
    legendRemote: 'Remote',
    legendAbsent: 'Absent',
    legendLeave: 'On leave',
    legendHoliday: 'Holiday',
    legendWeekend: 'Weekend',

    noSignalsBanner: 'No location signals configured — every check-in counts as present. Add a GPS or IP signal in Settings to tell office from remote.',
    planGatedTitle: 'That month is outside your plan’s history window',
    planGatedHint: 'Upgrade to reach further back.',
    emptyTitle: 'No active members to show',
    emptyHint: 'Members appear here once they join and start checking in.',

    cellPreJoin: (date: string) => `${date}: not yet a member`,
    cellStatus: (date: string, status: string) => `${date}: ${status}`,
    csvGateNote: 'Spreadsheet export is available on the Starter and Growth plans.',
  },

  // ── The per-member range table under /ws/[slug]/insights ───────────────────
  analytics: {
    heading: 'By member',
    subheading: (start: string, end: string, days: number) =>
      `${start} – ${end} · ${days} working days`,
    rangeStart: 'From',
    rangeEnd: 'To',
    thisMonthBtn: 'This month',

    statMembers: 'Members',
    statMembersHint: 'in this workspace',
    statOfficeDays: 'Office days',
    statCheckins: 'Check-ins',
    statAcrossTeam: 'total across the team',
    statHours: 'Hours tracked',
    statHoursHint: 'total logged',
    statAvgDays: 'Avg days',
    statAvgDaysHint: 'attended per person',

    colMember: 'Member',
    colJoined: 'Joined',
    colOffice: 'Office',
    colRemote: 'Remote',
    colPresent: 'Present',
    colAbsent: 'Absent',
    colTotalHours: 'Total hrs',
    colAvgPerDay: 'Avg/day',

    noSignalsBanner: 'No location signals configured — every check-in is shown. Add a GPS or IP signal in Settings to tell office from remote.',
    emptyTitle: 'No presence data for this period',
    emptyHint: 'Members appear here as they check in.',
    multiLocation: (n: number) => `${n} multi-location days`,
    multiLocationNote: 'Multi-location: days where checkout was recorded more than 1 km from check-in (field force / site visits).',
    forbidden: 'You do not have permission to see per-member analytics.',
  },

  // ── /ws picker and /ws/new ─────────────────────────────────────────────────
  picker: {
    titleWithWorkspaces: 'Your workspaces',
    titleEmpty: 'No workspaces yet',
    subtitleWithWorkspaces: 'Pick a workspace, or create another one.',
    subtitleEmpty: 'Create a workspace to start tracking your team’s presence.',

    sectionActive: 'Active',
    sectionArchived: 'Archived',
    archivedBadge: 'Archived',
    newBtn: 'New workspace',

    createTitle: 'Create a workspace',
    createSubtitle: 'Organisation features are separate from your personal /me dashboard.',
    fieldOrgName: 'Organisation name',
    fieldOrgNamePlaceholder: 'Acme Corp',
    fieldOrgNameId: 'ws-org-name',
    fieldSlug: 'Workspace URL handle',
    fieldSlugPlaceholder: 'acme-corp',
    fieldSlugId: 'ws-slug',
    slugAvailable: 'Available',
    slugTaken: 'Already taken',
    slugInvalid: 'Lowercase letters, numbers and hyphens only',
    slugChecking: 'Checking…',
    slugPreview: (slug: string) => `/ws/${slug}`,
    createBtn: 'Create workspace',
    creatingBtn: 'Creating…',
    createFailed: 'The workspace could not be created.',
    cancelBtn: 'Cancel',
    backToMe: 'Back to personal dashboard',
  },
} as const
