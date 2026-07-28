import { db } from '../index'
import type { EmployeeStatus } from '@/lib/constants/employees'
import type { EmployeePublic } from '@/lib/types/employees'
import { type EmployeeRow, toPublic } from './employees'

export interface ListEmployeesOpts {
  limit?: number
  offset?: number
  department?: string
  status?: EmployeeStatus
  location?: string
  include_archived?: boolean
}

export async function listEmployeesPaged(
  workspaceId: string,
  opts: ListEmployeesOpts = {},
): Promise<{ employees: EmployeePublic[]; total: number }> {
  const limit = Math.min(opts.limit ?? 25, 100)
  const offset = opts.offset ?? 0

  const conditions: string[] = ['e.workspace_id = ?']
  const params: unknown[] = [workspaceId]

  if (!opts.include_archived) conditions.push('e.deleted_at IS NULL')
  if (opts.status)     { conditions.push('e.employee_status = ?'); params.push(opts.status) }
  if (opts.department) { conditions.push('ed.department = ?');     params.push(opts.department) }
  if (opts.location)   { conditions.push('ed.work_location = ?');  params.push(opts.location) }

  const where = `WHERE ${conditions.join(' AND ')}`
  const join = `LEFT JOIN employment_details ed ON ed.employee_id = e.id`

  const countRow = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM employees e ${join} ${where}`,
    params,
  )
  const total = countRow?.total ?? 0

  const rows = await db.query<EmployeeRow>(
    `SELECT e.*,
       ed.designation, ed.department, ed.work_location, ed.work_mode,
       ed.reporting_manager_id, ed.employment_type, ed.source_of_hire,
       ed.total_work_experience, ed.date_of_joining, ed.confirmation_date,
       ed.probation_end_date, ed.exit_date, ed.exit_reason
     FROM employees e ${join}
     ${where}
     ORDER BY e.last_name ASC, e.first_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  return { employees: rows.map(row => toPublic(row)), total }
}

// ─── Headcount by department ───────────────────────────────────────────────────

export interface DepartmentHeadcount {
  department: string
  count: number
}

export async function getDepartmentHeadcounts(workspaceId: string): Promise<DepartmentHeadcount[]> {
  const rows = await db.query<{ department: string | null; count: number }>(
    `SELECT COALESCE(ed.department, 'Unassigned') AS department, COUNT(*) AS count
     FROM employees e LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE e.workspace_id = ? AND e.deleted_at IS NULL AND e.employee_status != 'terminated'
     GROUP BY COALESCE(ed.department, 'Unassigned')
     ORDER BY count DESC`,
    [workspaceId],
  )
  return rows.map(r => ({ department: r.department ?? 'Unassigned', count: r.count }))
}

// ─── "This week" celebrations (birthdays, anniversaries, new joiners) ─────────

export type CelebrationType = 'birthday' | 'anniversary' | 'new_joiner'

export interface CelebrationItem {
  type: CelebrationType
  name: string
  /** YYYY-MM-DD occurrence date (this year for birthdays/anniversaries, actual join date for new joiners). */
  date: string
  label: string
}

/** Days from `fromStr` to `toStr`, both 'YYYY-MM-DD'. Positive when `toStr` is later. */
function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(`${fromStr}T00:00:00Z`).getTime()
  const b = new Date(`${toStr}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

/** Next occurrence (on/after `todayStr`) of the month/day of `dateStr`, as 'YYYY-MM-DD'. */
function nextOccurrence(dateStr: string, todayStr: string): string {
  const monthDay = dateStr.slice(5, 10) // 'MM-DD'
  const todayYear = parseInt(todayStr.slice(0, 4), 10)
  let candidate = `${todayYear}-${monthDay}`
  if (candidate < todayStr) candidate = `${todayYear + 1}-${monthDay}`
  return candidate
}

interface CelebrationSourceRow {
  first_name: string
  last_name: string
  date_of_birth: string | null
  date_of_joining: string | null
  department: string | null
}

/**
 * Birthdays and work anniversaries occurring within the next 7 days, and new
 * joiners from the last 7 days, for active employees. Sorted soonest-first.
 * Holidays are a separate concern - see `getHolidaysInRange` in `holidays.ts`.
 */
export async function getUpcomingCelebrations(workspaceId: string, todayStr: string): Promise<CelebrationItem[]> {
  const rows = await db.query<CelebrationSourceRow>(
    `SELECT e.first_name, e.last_name, e.date_of_birth, ed.date_of_joining, ed.department
     FROM employees e LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE e.workspace_id = ? AND e.deleted_at IS NULL AND e.employee_status != 'terminated'
       AND (e.date_of_birth IS NOT NULL OR ed.date_of_joining IS NOT NULL)`,
    [workspaceId],
  )

  const items: CelebrationItem[] = []

  for (const row of rows) {
    const name = `${row.first_name} ${row.last_name}`.trim()

    if (row.date_of_birth) {
      const occurrence = nextOccurrence(row.date_of_birth, todayStr)
      if (daysBetween(todayStr, occurrence) <= 7) {
        items.push({ type: 'birthday', name, date: occurrence, label: 'Birthday' })
      }
    }

    if (row.date_of_joining) {
      const daysSinceJoining = daysBetween(row.date_of_joining, todayStr)
      if (daysSinceJoining >= 0 && daysSinceJoining <= 7) {
        const dept = row.department ?? 'Unassigned'
        items.push({ type: 'new_joiner', name, date: row.date_of_joining, label: `New joiner — ${dept}` })
      } else {
        const occurrence = nextOccurrence(row.date_of_joining, todayStr)
        const years = parseInt(occurrence.slice(0, 4), 10) - parseInt(row.date_of_joining.slice(0, 4), 10)
        if (years > 0 && daysBetween(todayStr, occurrence) <= 7) {
          items.push({ type: 'anniversary', name, date: occurrence, label: `${years}-year work anniversary` })
        }
      }
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date))
}
