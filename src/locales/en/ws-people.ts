/**
 * Copy for the workforce half of the `/ws` admin surface: Employees, Assets,
 * Leave (requests / applied / maternity) and the People membership screen.
 *
 * Kept out of `src/locales/en.ts` on purpose - that file is edited by every
 * other surface at once, and these four screens change together. Import the
 * export you need directly:
 *
 *   import { wsEmployees } from '@/locales/en/ws-people'
 *
 * Anything a user can read belongs here rather than inline in a component.
 */

// ─── Employees ────────────────────────────────────────────────────────────────

export const wsEmployees = {
  title: 'Employees',
  subtitle: (total: number, active: number) =>
    `${total} ${total === 1 ? 'person' : 'people'} · ${active} active`,
  addButton: 'Add employee',
  editButton: 'Edit profile',
  backToDirectory: 'Back to directory',
  backToStep: 'Back',

  searchPlaceholder: 'Search name, job title or email',
  departmentAll: 'All departments',
  departmentLabel: 'Department filter',
  statusAll: 'All statuses',
  statusLabel: 'Status filter',
  loadMore: 'Load more',
  loadingMore: 'Loading…',

  colEmployee: 'Employee',
  colJobTitle: 'Job title',
  colRole: 'Role',
  colDepartment: 'Department',
  colType: 'Type',
  colJoined: 'Joined',
  colStatus: 'Status',

  emptyTitle: 'No employees match your filters',
  emptyHint: 'Clear the search or pick a different department.',
  emptyDirectoryTitle: 'No employee records yet',
  emptyDirectoryHint: 'Add someone to start the HR directory.',

  loadFailed: 'Could not load employees.',
  notFound: 'That employee record no longer exists.',

  // Detail view
  sectionLeaveBalance: 'Leave balance',
  leaveBalanceEmpty: 'No leave types configured for this workspace.',
  leaveBalanceRemaining: (available: number, total: number) =>
    `${available} of ${total} left`,
  joinedOn: (date: string) => `joined ${date}`,
  noValue: '—',
  maskedHint: 'Aadhaar and bank account are masked. Open the edit wizard to change them.',

  // Wizard
  wizardAddTitle: 'Add employee',
  wizardEditTitle: 'Edit profile',
  wizardNewSubject: 'New employee',
  wizardContinue: 'Continue',
  wizardSaveEdit: 'Save changes',
  wizardSaveAdd: 'Create employee',
  wizardSaving: 'Saving…',
  wizardCancel: 'Cancel',
  wizardSavedAdd: 'Employee record created',
  wizardSavedEdit: 'Employee profile updated',
  wizardGenericError: 'Something went wrong. Please try again.',

  stepBasic: 'Basic details',
  stepBasicSub: 'Personal and contact information',
  stepEmployment: 'Employment',
  stepEmploymentSub: 'Job and employment details',
  stepBank: 'Bank & IDs',
  stepBankSub: 'Financial and statutory identifiers',
  stepEmergency: 'Emergency',
  stepEmergencySub: 'Emergency contact information',
  stepReview: 'Review',
  stepReviewSub: 'Review and submit',

  // Documents panel
  documentsTitle: 'Documents',
  documentsEmpty: 'No document slots yet',
  documentsEmptyHint: 'Upload a file to open the first slot.',
  documentsLoadFailed: 'Could not load documents.',
  documentByCompany: 'provided by company',
  documentByEmployee: 'uploaded by employee',
  documentUpload: 'Upload for employee',
  documentReplace: 'Replace file',
  documentDownload: 'Download',
  documentVerify: 'Verify',
  documentReject: 'Reject',
  documentRejectReasonLabel: 'Reason for rejecting',
  documentRejectReasonPlaceholder: 'Tell them what to fix',
  documentRejectConfirm: 'Confirm reject',
  documentRejectCancel: 'Cancel',
  documentRejectReasonRequired: 'A reason is required to reject a document.',
  documentRejectedNote: (reason: string) => `Rejected — ${reason}`,
  documentUploaded: 'File uploaded',
  documentVerified: 'Document verified',
  documentRejected: 'Document rejected',
  documentUploadFailed: 'Upload failed. Please try again.',
  documentActionFailed: 'Could not update the document.',
  documentAddSlotTitle: 'Add a document slot',
  documentSlotNameLabel: 'Document name',
  documentSlotNamePlaceholder: 'e.g. Offer letter',
  documentSlotOwnerLabel: 'Provided by',
  documentSlotOwnerAdmin: 'The company',
  documentSlotOwnerEmployee: 'The employee',
  documentSlotFileLabel: 'Choose a file',
  documentSlotSubmit: 'Upload',
  documentSlotNameRequired: 'Name the document before uploading.',

  statusActive: 'Active',
  statusTerminated: 'Terminated',
  statusSuspended: 'Suspended',
  statusOnLeave: 'On leave',
  statusNoticePeriod: 'Notice period',
} as const

// ─── Assets ───────────────────────────────────────────────────────────────────

export const wsAssets = {
  title: 'Assets',
  subtitle: 'Company equipment issued to employees — laptops, ID cards, peripherals.',
  exportButton: 'Export CSV',
  addButton: 'Add asset',
  cancelButton: 'Cancel',

  statTotal: 'Total assets',
  statTotalHint: (value: string) => `${value} in service`,
  statAssigned: 'Assigned',
  statAssignedHint: 'held by employees',
  statAvailable: 'Available',
  statAvailableHint: 'ready to issue',
  statRepair: 'In repair',
  statRepairHint: 'out of circulation',

  addFormTitle: 'Add an asset',
  fieldName: 'Asset name',
  fieldNamePlaceholder: 'e.g. MacBook Pro 14"',
  fieldCategory: 'Category',
  fieldCategoryPlaceholder: 'e.g. Laptop',
  fieldSerial: 'Serial number',
  fieldSerialPlaceholder: 'Serial number',
  fieldCondition: 'Condition',
  fieldValue: 'Purchase value',
  fieldValuePlaceholder: 'Value',
  fieldNotes: 'Notes',
  addSubmit: 'Add',
  addHint: 'New assets enter the register as Available. Assign them from the table below.',
  addNameRequired: 'An asset name is required.',
  added: 'Asset added to the register',

  categoryAll: 'All',
  registerTitle: 'Register',

  colAsset: 'Asset',
  colTagSerial: 'Serial',
  colAssignedTo: 'Assigned to',
  colIssued: 'Issued',
  colCondition: 'Condition',
  colStatus: 'Status',
  colAction: 'Action',

  statusAssigned: 'Assigned',
  statusAvailable: 'Available',
  statusRepair: 'In repair',
  statusRetired: 'Retired',

  conditionGood: 'good',
  conditionFair: 'fair',
  conditionPoor: 'poor',
  conditionUnset: 'unset',

  actionAssign: 'Assign',
  actionReturn: 'Mark returned',
  actionRepair: 'Send to repair',
  actionBackInService: 'Back in service',
  actionRetire: 'Retire',

  assignTitle: 'Assign asset',
  assignEmployeeLabel: 'Employee',
  assignEmployeePlaceholder: 'Select employee',
  assignSubmit: 'Assign',
  assignCancel: 'Cancel',
  assignEmployeeRequired: 'Pick an employee first.',
  assigned: (name: string) => `Assigned to ${name}`,
  returned: 'Asset returned to the pool',
  sentToRepair: 'Asset sent for repair',
  backInService: 'Asset is back in service',
  retired: 'Asset retired',
  conditionUpdated: 'Condition updated',
  actionFailed: 'Could not update the asset.',

  emptyTitle: 'No assets in this category',
  emptyHint: 'Add one to start the register.',
  loadFailed: 'Could not load assets.',
  noEmployees: 'Add an employee record before assigning equipment.',
} as const

// ─── Leave (admin) ────────────────────────────────────────────────────────────

export const wsLeaveScreen = {
  title: 'Leave',
  tabRequests: 'Requests',
  tabApplied: 'Applied leaves',
  tabMaternity: 'Maternity',

  // Requests
  pendingTitle: 'Pending requests',
  pendingEmptyTitle: 'All caught up',
  pendingEmptyHint: 'No leave requests waiting on you.',
  approve: 'Approve',
  approving: 'Approving…',
  decline: 'Decline',
  declineReasonLabel: 'Reason for declining',
  declineReasonPlaceholder: 'Tell them why',
  declineConfirm: 'Confirm decline',
  declineCancel: 'Cancel',
  declineReasonRequired: 'A reason is required to decline.',
  approved: 'Leave request approved',
  declined: 'Leave request declined',
  requestActionFailed: 'Could not update the request.',

  // Applied
  filterAll: 'All',
  filterPending: 'Pending',
  filterApproved: 'Approved',
  filterRejected: 'Declined',
  colEmployee: 'Employee',
  colType: 'Type',
  colDates: 'Dates',
  colDays: 'Days',
  colStatus: 'Status',
  appliedEmptyTitle: 'Nothing in this filter',
  appliedEmptyHint: 'Try another status.',
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusRejected: 'Declined',
  loadFailed: 'Could not load leave requests.',


  // Maternity
  maternityIntro:
    '26-week paid entitlement (Maternity Benefit Act). Track each case from request through return to work.',
  maternityStart: 'Start maternity leave',
  maternityFormTitle: 'New maternity leave',
  maternityEmployee: 'Employee',
  maternityEmployeePlaceholder: 'Select employee',
  maternityDue: 'Expected due date',
  maternityWeeks: 'Weeks',
  maternityAdd: 'Add',
  maternityCancel: 'Cancel',
  maternityFormHint:
    'Leave starts ~4 weeks before the due date; expected return is calculated from the entitlement.',
  maternityEmployeeRequired: 'Select an employee and a due date.',
  maternityCreated: 'Maternity leave case created',
  maternityCreateFailed: 'Could not create the case.',

  maternityStatRequested: 'Awaiting approval',
  maternityStatApproved: 'Approved · upcoming',
  maternityStatOnLeave: 'Currently on leave',
  maternityStatReturned: 'Returned',

  maternityDueDate: 'Due date',
  maternityLeaveStart: 'Leave start',
  maternityExpectedReturn: 'Expected return',
  maternityEntitlement: 'Entitlement',
  maternityWeeksValue: (weeks: number) => `${weeks} weeks`,

  stageRequested: 'Requested',
  stageApproved: 'Approved',
  stageOnLeave: 'On leave',
  stageReturned: 'Returned',

  maternityApprove: 'Approve leave',
  maternityRevoke: 'Revoke approval',
  maternityMarkOnLeave: 'Mark on leave',
  maternityMarkReturned: 'Mark returned',
  maternityReturnedOn: (date: string) => `Returned ${date}`,
  maternityUpdated: 'Case updated',
  maternityUpdateFailed: 'Could not move the case.',
  maternityEmptyTitle: 'No maternity leave cases',
  maternityEmptyHint: 'Start one when someone files for maternity leave.',
  maternityLoadFailed: 'Could not load maternity cases.',
} as const

// ─── People (membership) ──────────────────────────────────────────────────────

export const wsPeopleUi = {
  subtitle: 'Invite people, change what they can do, and remove access.',
  inviteToggle: 'Invite someone',
  membersTitle: 'Members',
  searchButton: 'Search',
  employeeProfile: 'Employee profile',
  actionsLabel: 'Actions',
  roleLocked: 'Locked',
} as const
