import { randomBytes } from 'crypto'
import { db } from '../index'
import { encryptFieldOrNull, decryptFieldOrNull } from '@/lib/encryption'
import type {
  Gender,
  MaritalStatus,
  BloodGroup,
  WorkMode,
  EmploymentType,
  EmployeeStatus,
  SourceOfHire,
} from '@/lib/employee-constants'

// Raw DB row — encrypted fields stored as TEXT
export interface Employee {
  id: string
  workspace_id: string
  user_id: string | null
  first_name: string
  last_name: string
  gender: Gender | null
  date_of_birth: string | null
  marital_status: MaritalStatus | null
  number_of_children: number | null
  photo_url: string | null
  blood_group: BloodGroup | null
  personal_email: string | null
  work_email: string
  phone: string | null
  alternate_phone: string | null
  current_address: string | null
  permanent_address: string | null
  employee_id: string | null
  designation: string | null
  department: string | null
  work_location: string | null
  work_mode: WorkMode | null
  reporting_manager_id: string | null
  total_work_experience: number | null
  employment_type: EmploymentType
  employee_status: EmployeeStatus
  source_of_hire: SourceOfHire | null
  date_of_joining: string | null
  confirmation_date: string | null
  probation_end_date: string | null
  exit_date: string | null
  exit_reason: string | null
  pan_encrypted: string | null
  aadhaar_encrypted: string | null
  uan: string | null
  passport_number: string | null
  bank_account_encrypted: string | null
  bank_ifsc: string | null
  bank_name: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Public shape — sensitive fields decrypted, age computed from date_of_birth, encrypted columns omitted
export interface EmployeePublic
  extends Omit<Employee, 'pan_encrypted' | 'aadhaar_encrypted' | 'bank_account_encrypted'> {
  pan: string | null
  aadhaar: string | null
  bank_account: string | null
  age: number | null
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function toPublic(row: Employee): EmployeePublic {
  const { pan_encrypted, aadhaar_encrypted, bank_account_encrypted, ...rest } = row
  return {
    ...rest,
    pan: decryptFieldOrNull(pan_encrypted),
    aadhaar: decryptFieldOrNull(aadhaar_encrypted),
    bank_account: decryptFieldOrNull(bank_account_encrypted),
    age: computeAge(row.date_of_birth),
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listEmployees(workspaceId: string): Promise<EmployeePublic[]> {
  const rows = await db.query<Employee>(
    `SELECT * FROM employees
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY last_name ASC, first_name ASC`,
    [workspaceId],
  )
  return rows.map(toPublic)
}

export async function getEmployee(id: string, workspaceId: string): Promise<EmployeePublic | null> {
  const row = await db.queryOne<Employee>(
    `SELECT * FROM employees WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return row ? toPublic(row) : null
}

export async function findEmployeeByEmployeeId(
  workspaceId: string,
  employeeId: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<Employee>(
    `SELECT * FROM employees
     WHERE workspace_id = ? AND employee_id = ? AND deleted_at IS NULL`,
    [workspaceId, employeeId],
  )
  return row ? toPublic(row) : null
}

export async function findEmployeeByWorkEmail(
  workspaceId: string,
  workEmail: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<Employee>(
    `SELECT * FROM employees
     WHERE workspace_id = ? AND work_email = ? AND deleted_at IS NULL`,
    [workspaceId, workEmail],
  )
  return row ? toPublic(row) : null
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateEmployeeInput {
  workspace_id: string
  user_id?: string | null
  first_name: string
  last_name: string
  work_email: string
  employment_type: EmploymentType
  employee_status?: EmployeeStatus
  gender?: Gender | null
  date_of_birth?: string | null
  marital_status?: MaritalStatus | null
  number_of_children?: number | null
  photo_url?: string | null
  blood_group?: BloodGroup | null
  personal_email?: string | null
  phone?: string | null
  alternate_phone?: string | null
  current_address?: string | null
  permanent_address?: string | null
  employee_id?: string | null
  designation?: string | null
  department?: string | null
  work_location?: string | null
  work_mode?: WorkMode | null
  reporting_manager_id?: string | null
  total_work_experience?: number | null
  source_of_hire?: SourceOfHire | null
  date_of_joining?: string | null
  confirmation_date?: string | null
  probation_end_date?: string | null
  exit_date?: string | null
  exit_reason?: string | null
  pan?: string | null
  aadhaar?: string | null
  uan?: string | null
  passport_number?: string | null
  bank_account?: string | null
  bank_ifsc?: string | null
  bank_name?: string | null
  emergency_contact_name?: string | null
  emergency_contact_relationship?: string | null
  emergency_contact_phone?: string | null
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeePublic> {
  const id = randomBytes(16).toString('hex')
  await db.execute(
    `INSERT INTO employees (
      id, workspace_id, user_id,
      first_name, last_name, gender, date_of_birth, marital_status,
      number_of_children, photo_url, blood_group,
      personal_email, work_email, phone, alternate_phone,
      current_address, permanent_address,
      employee_id, designation, department, work_location, work_mode,
      reporting_manager_id, total_work_experience,
      employment_type, employee_status, source_of_hire,
      date_of_joining, confirmation_date, probation_end_date,
      exit_date, exit_reason,
      pan_encrypted, aadhaar_encrypted, uan, passport_number,
      bank_account_encrypted, bank_ifsc, bank_name,
      emergency_contact_name, emergency_contact_relationship, emergency_contact_phone
    ) VALUES (
      ?,?,?,
      ?,?,?,?,?,
      ?,?,?,
      ?,?,?,?,
      ?,?,
      ?,?,?,?,?,
      ?,?,
      ?,?,?,
      ?,?,?,
      ?,?,
      ?,?,?,?,
      ?,?,?,
      ?,?,?
    )`,
    [
      id, input.workspace_id, input.user_id ?? null,
      input.first_name, input.last_name, input.gender ?? null, input.date_of_birth ?? null,
      input.marital_status ?? null,
      input.number_of_children ?? null, input.photo_url ?? null, input.blood_group ?? null,
      input.personal_email ?? null, input.work_email, input.phone ?? null, input.alternate_phone ?? null,
      input.current_address ?? null, input.permanent_address ?? null,
      input.employee_id ?? null, input.designation ?? null, input.department ?? null,
      input.work_location ?? null, input.work_mode ?? null,
      input.reporting_manager_id ?? null, input.total_work_experience ?? null,
      input.employment_type, input.employee_status ?? 'active', input.source_of_hire ?? null,
      input.date_of_joining ?? null, input.confirmation_date ?? null, input.probation_end_date ?? null,
      input.exit_date ?? null, input.exit_reason ?? null,
      encryptFieldOrNull(input.pan), encryptFieldOrNull(input.aadhaar),
      input.uan ?? null, input.passport_number ?? null,
      encryptFieldOrNull(input.bank_account), input.bank_ifsc ?? null, input.bank_name ?? null,
      input.emergency_contact_name ?? null, input.emergency_contact_relationship ?? null,
      input.emergency_contact_phone ?? null,
    ],
  )
  const created = await db.queryOne<Employee>(`SELECT * FROM employees WHERE id = ?`, [id])
  return toPublic(created!)
}

// ─── Update ───────────────────────────────────────────────────────────────────

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, 'workspace_id'>>

export async function updateEmployee(
  id: string,
  workspaceId: string,
  input: UpdateEmployeeInput,
): Promise<EmployeePublic | null> {
  const sets: string[] = []
  const params: unknown[] = []

  const set = (col: string, val: unknown) => { sets.push(`${col} = ?`); params.push(val) }

  if (input.user_id !== undefined)                        set('user_id', input.user_id)
  if (input.first_name !== undefined)                     set('first_name', input.first_name)
  if (input.last_name !== undefined)                      set('last_name', input.last_name)
  if (input.gender !== undefined)                         set('gender', input.gender)
  if (input.date_of_birth !== undefined)                  set('date_of_birth', input.date_of_birth)
  if (input.marital_status !== undefined)                 set('marital_status', input.marital_status)
  if (input.number_of_children !== undefined)             set('number_of_children', input.number_of_children)
  if (input.photo_url !== undefined)                      set('photo_url', input.photo_url)
  if (input.blood_group !== undefined)                    set('blood_group', input.blood_group)
  if (input.personal_email !== undefined)                 set('personal_email', input.personal_email)
  if (input.work_email !== undefined)                     set('work_email', input.work_email)
  if (input.phone !== undefined)                          set('phone', input.phone)
  if (input.alternate_phone !== undefined)                set('alternate_phone', input.alternate_phone)
  if (input.current_address !== undefined)                set('current_address', input.current_address)
  if (input.permanent_address !== undefined)              set('permanent_address', input.permanent_address)
  if (input.employee_id !== undefined)                    set('employee_id', input.employee_id)
  if (input.designation !== undefined)                    set('designation', input.designation)
  if (input.department !== undefined)                     set('department', input.department)
  if (input.work_location !== undefined)                  set('work_location', input.work_location)
  if (input.work_mode !== undefined)                      set('work_mode', input.work_mode)
  if (input.reporting_manager_id !== undefined)           set('reporting_manager_id', input.reporting_manager_id)
  if (input.total_work_experience !== undefined)          set('total_work_experience', input.total_work_experience)
  if (input.employment_type !== undefined)                set('employment_type', input.employment_type)
  if (input.employee_status !== undefined)                set('employee_status', input.employee_status)
  if (input.source_of_hire !== undefined)                 set('source_of_hire', input.source_of_hire)
  if (input.date_of_joining !== undefined)                set('date_of_joining', input.date_of_joining)
  if (input.confirmation_date !== undefined)              set('confirmation_date', input.confirmation_date)
  if (input.probation_end_date !== undefined)             set('probation_end_date', input.probation_end_date)
  if (input.exit_date !== undefined)                      set('exit_date', input.exit_date)
  if (input.exit_reason !== undefined)                    set('exit_reason', input.exit_reason)
  if (input.pan !== undefined)                            set('pan_encrypted', encryptFieldOrNull(input.pan))
  if (input.aadhaar !== undefined)                        set('aadhaar_encrypted', encryptFieldOrNull(input.aadhaar))
  if (input.uan !== undefined)                            set('uan', input.uan)
  if (input.passport_number !== undefined)                set('passport_number', input.passport_number)
  if (input.bank_account !== undefined)                   set('bank_account_encrypted', encryptFieldOrNull(input.bank_account))
  if (input.bank_ifsc !== undefined)                      set('bank_ifsc', input.bank_ifsc)
  if (input.bank_name !== undefined)                      set('bank_name', input.bank_name)
  if (input.emergency_contact_name !== undefined)         set('emergency_contact_name', input.emergency_contact_name)
  if (input.emergency_contact_relationship !== undefined) set('emergency_contact_relationship', input.emergency_contact_relationship)
  if (input.emergency_contact_phone !== undefined)        set('emergency_contact_phone', input.emergency_contact_phone)

  if (sets.length === 0) return getEmployee(id, workspaceId)

  set('updated_at', new Date().toISOString().replace('T', ' ').slice(0, 19))
  params.push(id, workspaceId)

  await db.execute(
    `UPDATE employees SET ${sets.join(', ')}
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    params,
  )
  return getEmployee(id, workspaceId)
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function softDeleteEmployee(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE employees
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}
