import { db } from '../index'
import { countWorkdays } from '@/lib/attendance-summary'

export type AccrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
export type CreditTiming = 'start' | 'end'

export interface LeaveType {
  id: string
  workspace_id: string
  name: string
  accrual_frequency: AccrualFrequency
  accrual_credits: number
  credit_timing: CreditTiming
  created_at: string
  deleted_at: string | null
}

export interface LeaveRequest {
  id: string
  workspace_id: string
  user_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  rejection_reason: string | null
  actioned_by_user_id: string | null
  created_at: string
}

export interface LeaveTypeWithBalance extends LeaveType {
  available_days: number
  total_accrued: number
  used_days: number
}

export interface LeaveBalanceAdjustment {
  id: string
  workspace_id: string
  user_id: string
  leave_type_id: string
  balance_days: number
  effective_date: string
  created_by: string
  created_at: string
}

export function nextQuarterStart(): string {
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const nextQStartMonth = Math.floor(month / 3) * 3 + 3
  const year = nextQStartMonth >= 12 ? now.getFullYear() + 1 : now.getFullYear()
  const m = nextQStartMonth >= 12 ? 0 : nextQStartMonth
  return `${year}-${String(m + 1).padStart(2, '0')}-01`
}

export async function getWorkspaceLeaveTypes(workspaceId: string): Promise<LeaveType[]> {
  return db.query<LeaveType>(
    `SELECT * FROM workspace_leave_types
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId],
  )
}

export async function getLeaveTypeById(id: string, workspaceId: string): Promise<LeaveType | null> {
  return db.queryOne<LeaveType>(
    'SELECT * FROM workspace_leave_types WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [id, workspaceId],
  )
}

export async function createLeaveType(params: {
  workspaceId: string
  name: string
  accrualFrequency: AccrualFrequency
  creditTiming: CreditTiming
  accrualCredits: number
}): Promise<LeaveType> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_leave_types (id, workspace_id, name, accrual_frequency, accrual_credits, credit_timing)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.name, params.accrualFrequency, params.accrualCredits, params.creditTiming],
  )
  const row = await db.queryOne<LeaveType>('SELECT * FROM workspace_leave_types WHERE id = ?', [id])
  if (!row) throw new Error('Leave type insert succeeded but row not found')
  return row
}

export async function softDeleteLeaveType(id: string, workspaceId: string): Promise<boolean> {
  const row = await db.queryOne<{ id: string }>(
    'SELECT id FROM workspace_leave_types WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [id, workspaceId],
  )
  if (!row) return false
  await db.execute(
    `UPDATE workspace_leave_types SET deleted_at = datetime('now') WHERE id = ? AND workspace_id = ?`,
    [id, workspaceId],
  )
  return true
}

export async function getUsedLeaveDays(
  workspaceId: string,
  userId: string,
  leaveTypeId: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
  fromDate?: string,
): Promise<number> {
  const rows = await db.query<{ start_date: string; end_date: string }>(
    `SELECT start_date, end_date FROM leave_requests
     WHERE workspace_id = ? AND user_id = ? AND leave_type_id = ? AND status = 'approved'
     ${fromDate ? "AND start_date >= ?" : ""}`,
    fromDate
      ? [workspaceId, userId, leaveTypeId, fromDate]
      : [workspaceId, userId, leaveTypeId],
  )
  return rows.reduce((sum, r) => {
    return sum + countWorkdays(r.start_date, r.end_date, undefined, workingDays)
  }, 0)
}

const PERIOD_MONTHS: Record<AccrualFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
}

// Pro-rata accrual based on DOJ:
//   • First period: credits × (days_remaining_in_period / total_days_in_period)
//   • 'start' timing: first-period credits available immediately; each subsequent
//     period's credits available at its start (front-loaded).
//   • 'end' timing: credits available only after completing each period (back-loaded).
function computeTotalAccrued(
  joinedAt: string,
  frequency: AccrualFrequency,
  accrualCredits: number,
  creditTiming: CreditTiming,
): number {
  const normalized = joinedAt.includes('T') ? joinedAt : joinedAt.replace(' ', 'T') + 'Z'
  const joined = new Date(normalized)
  const now = new Date()
  if (now < joined) return 0

  const periodMonths = PERIOD_MONTHS[frequency]
  const joinYear = joined.getFullYear()
  const joinMonth = joined.getMonth() // 0-indexed

  // First period: 1st of join-month → 1st of (join-month + periodMonths)
  const firstPeriodStart = new Date(joinYear, joinMonth, 1)
  const secondPeriodStart = new Date(joinYear, joinMonth + periodMonths, 1) // exclusive end of first period

  // Pro-rata fraction for first period
  const totalMsInFirstPeriod = secondPeriodStart.getTime() - firstPeriodStart.getTime()
  const workedMsInFirstPeriod = secondPeriodStart.getTime() - joined.getTime()
  const proRataFraction = Math.min(1, Math.max(0, workedMsInFirstPeriod / totalMsInFirstPeriod))
  const firstPeriodCredits = accrualCredits * proRataFraction

  const round1 = (n: number) => Math.round(n * 10) / 10

  if (creditTiming === 'start') {
    // First period: available immediately on DOJ
    if (now < secondPeriodStart) return round1(firstPeriodCredits)

    // Full periods started since secondPeriodStart (current in-progress counts too → +1)
    const monthsSinceSecondPeriod = (now.getFullYear() - secondPeriodStart.getFullYear()) * 12 +
      (now.getMonth() - secondPeriodStart.getMonth())
    const periodsStarted = Math.floor(monthsSinceSecondPeriod / periodMonths) + 1
    return round1(firstPeriodCredits + periodsStarted * accrualCredits)
  } else {
    // 'end': credits available after completing each period
    if (now < secondPeriodStart) return 0 // first period not yet done

    const monthsSinceSecondPeriod = (now.getFullYear() - secondPeriodStart.getFullYear()) * 12 +
      (now.getMonth() - secondPeriodStart.getMonth())
    const periodsCompleted = Math.floor(monthsSinceSecondPeriod / periodMonths)
    return round1(firstPeriodCredits + periodsCompleted * accrualCredits)
  }
}

export async function getLeaveTypesWithBalance(
  workspaceId: string,
  userId: string,
  memberJoinedAt: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
): Promise<LeaveTypeWithBalance[]> {
  const types = await getWorkspaceLeaveTypes(workspaceId)
  const today = new Date().toISOString().slice(0, 10)
  return Promise.all(
    types.map(async (t) => {
      const adj = await getLatestLeaveBalanceAdjustment(workspaceId, userId, t.id)

      let totalAccrued: number
      let usedDays: number

      if (adj && adj.effective_date <= today) {
        totalAccrued =
          adj.balance_days +
          computeTotalAccrued(adj.effective_date, t.accrual_frequency, t.accrual_credits, t.credit_timing)
        usedDays = await getUsedLeaveDays(workspaceId, userId, t.id, workingDays, adj.effective_date)
      } else {
        totalAccrued = computeTotalAccrued(memberJoinedAt, t.accrual_frequency, t.accrual_credits, t.credit_timing)
        usedDays = await getUsedLeaveDays(workspaceId, userId, t.id, workingDays)
      }

      return {
        ...t,
        total_accrued: totalAccrued,
        used_days: usedDays,
        available_days: Math.max(0, totalAccrued - usedDays),
      }
    }),
  )
}

export interface LeaveRequestWithType extends LeaveRequest {
  leave_type_name: string
}

export interface AdminLeaveRequest extends LeaveRequest {
  leave_type_name: string
  user_full_name: string | null
  user_email: string
}

export async function getWorkspaceLeaveRequests(
  workspaceId: string,
): Promise<AdminLeaveRequest[]> {
  return db.query<AdminLeaveRequest>(
    `SELECT lr.*,
            wlt.name  AS leave_type_name,
            u.full_name AS user_full_name,
            u.email   AS user_email
     FROM leave_requests lr
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     JOIN users u ON u.id = lr.user_id
     WHERE lr.workspace_id = ?
     ORDER BY lr.start_date DESC`,
    [workspaceId],
  )
}

export async function getUserLeaveRequests(
  workspaceId: string,
  userId: string,
): Promise<LeaveRequestWithType[]> {
  return db.query<LeaveRequestWithType>(
    `SELECT lr.*, wlt.name AS leave_type_name
     FROM leave_requests lr
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     WHERE lr.workspace_id = ? AND lr.user_id = ?
     ORDER BY lr.start_date DESC`,
    [workspaceId, userId],
  )
}

export async function hasOverlappingLeaveRequest(
  workspaceId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM leave_requests
     WHERE workspace_id = ? AND user_id = ? AND status = 'approved'
       AND start_date <= ? AND end_date >= ?`,
    [workspaceId, userId, endDate, startDate],
  )
  return (row?.cnt ?? 0) > 0
}

export async function getLeaveRequestsInRange(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<{ user_id: string; start_date: string; end_date: string }[]> {
  return db.query(
    `SELECT user_id, start_date, end_date FROM leave_requests
     WHERE workspace_id = ?
       AND status = 'approved'
       AND start_date <= ?
       AND end_date >= ?`,
    [workspaceId, endDate, startDate],
  )
}

export interface MemberOnLeaveToday {
  user_id: string
  full_name: string | null
  email: string
  leave_type_name: string
}

export async function getMembersOnLeaveToday(workspaceId: string, date: string): Promise<MemberOnLeaveToday[]> {
  return db.query<MemberOnLeaveToday>(
    `SELECT lr.user_id, u.full_name, u.email, wlt.name AS leave_type_name
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     WHERE lr.workspace_id = ?
       AND lr.status = 'approved'
       AND lr.start_date <= ?
       AND lr.end_date >= ?
       AND u.deleted_at IS NULL
     ORDER BY u.full_name ASC`,
    [workspaceId, date, date],
  )
}

export async function getLatestLeaveBalanceAdjustment(
  workspaceId: string,
  userId: string,
  leaveTypeId: string,
): Promise<LeaveBalanceAdjustment | null> {
  return db.queryOne<LeaveBalanceAdjustment>(
    `SELECT * FROM leave_initial_balances
     WHERE workspace_id = ? AND user_id = ? AND leave_type_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [workspaceId, userId, leaveTypeId],
  )
}

export async function getLatestLeaveBalanceAdjustmentsForUser(
  workspaceId: string,
  userId: string,
): Promise<LeaveBalanceAdjustment[]> {
  return db.query<LeaveBalanceAdjustment>(
    `SELECT lba.*
     FROM leave_initial_balances lba
     WHERE lba.workspace_id = ? AND lba.user_id = ?
       AND lba.created_at = (
         SELECT MAX(lba2.created_at)
         FROM leave_initial_balances lba2
         WHERE lba2.workspace_id = lba.workspace_id
           AND lba2.user_id = lba.user_id
           AND lba2.leave_type_id = lba.leave_type_id
       )`,
    [workspaceId, userId],
  )
}

export async function setLeaveBalanceAdjustment(params: {
  workspaceId: string
  userId: string
  leaveTypeId: string
  balanceDays: number
  effectiveDate: string
  createdBy: string
}): Promise<LeaveBalanceAdjustment> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO leave_initial_balances
       (id, workspace_id, user_id, leave_type_id, balance_days, effective_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.userId, params.leaveTypeId, params.balanceDays, params.effectiveDate, params.createdBy],
  )
  const row = await db.queryOne<LeaveBalanceAdjustment>(
    'SELECT * FROM leave_initial_balances WHERE id = ?',
    [id],
  )
  if (!row) throw new Error('Adjustment insert succeeded but row not found')
  return row
}

export async function createLeaveRequest(params: {
  workspaceId: string
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string | null
}): Promise<LeaveRequest> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO leave_requests
       (id, workspace_id, user_id, leave_type_id, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      params.workspaceId,
      params.userId,
      params.leaveTypeId,
      params.startDate,
      params.endDate,
      params.reason ?? null,
    ],
  )
  const row = await db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [id])
  if (!row) throw new Error('Leave request insert succeeded but row not found')
  return row
}

export async function getLeaveRequestById(
  id: string,
  workspaceId: string,
): Promise<LeaveRequest | null> {
  return db.queryOne<LeaveRequest>(
    'SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?',
    [id, workspaceId],
  )
}

export type ActionLeaveError = 'NOT_FOUND' | 'ALREADY_ACTIONED'
export type ActionLeaveResult =
  | { updated: LeaveRequest }
  | { error: ActionLeaveError }

export async function actionLeaveRequest(params: {
  id: string
  workspaceId: string
  action: 'approve' | 'reject'
  actionedByUserId: string
  rejectionReason?: string | null
}): Promise<ActionLeaveResult> {
  const row = await db.queryOne<LeaveRequest>(
    'SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?',
    [params.id, params.workspaceId],
  )
  if (!row) return { error: 'NOT_FOUND' }
  if (row.status !== 'pending') return { error: 'ALREADY_ACTIONED' }

  const newStatus = params.action === 'approve' ? 'approved' : 'rejected'
  await db.execute(
    `UPDATE leave_requests
     SET status = ?, actioned_by_user_id = ?, rejection_reason = ?
     WHERE id = ?`,
    [newStatus, params.actionedByUserId, params.rejectionReason ?? null, params.id],
  )
  const updated = await db.queryOne<LeaveRequest>(
    'SELECT * FROM leave_requests WHERE id = ?',
    [params.id],
  )
  return { updated: updated! }
}
