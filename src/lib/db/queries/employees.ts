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

// ─── Raw types ────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  workspace_id: string
  user_id: string | null
  employee_id: string | null
  first_name: string
  last_name: string
  gender: Gender | null
  date_of_birth: string | null
  marital_status: MaritalStatus | null
  number_of_children: number | null
  blood_group: BloodGroup | null
  photo_url: string | null
  personal_email: string | null
  work_email: string
  phone: string | null
  alternate_phone: string | null
  current_address: string | null
  permanent_address: string | null
  employee_status: EmployeeStatus
  deleted_at: string | null
  created_at: string
  updated_at: string
}

interface EmploymentDetailsRow {
  designation: string | null
  department: string | null
  work_location: string | null
  work_mode: WorkMode | null
  reporting_manager_id: string | null
  employment_type: EmploymentType | null
  source_of_hire: SourceOfHire | null
  total_work_experience: number | null
  date_of_joining: string | null
  confirmation_date: string | null
  probation_end_date: string | null
  exit_date: string | null
  exit_reason: string | null
}

interface EmployeeSensitiveRow {
  pan_encrypted: string | null
  aadhaar_encrypted: string | null
  uan: string | null
  passport_number: string | null
  bank_account_encrypted: string | null
  bank_ifsc: string | null
  bank_name: string | null
}

type EmployeeRow = Employee & EmploymentDetailsRow & EmployeeSensitiveRow

export interface EmergencyContact {
  id: string
  name: string
  relationship: string | null
  phone: string
}

export interface EmploymentInfo {
  designation: string | null
  department: string | null
  work_location: string | null
  work_mode: WorkMode | null
  reporting_manager_id: string | null
  employment_type: EmploymentType | null
  source_of_hire: SourceOfHire | null
  total_work_experience: number | null
  date_of_joining: string | null
  confirmation_date: string | null
  probation_end_date: string | null
  exit_date: string | null
  exit_reason: string | null
}

export interface EmployeeSensitiveInfo {
  pan: string | null
  aadhaar: string | null
  uan: string | null
  passport_number: string | null
  bank_account: string | null
  bank_ifsc: string | null
  bank_name: string | null
}

export interface EmployeePublic extends Employee {
  employment: EmploymentInfo
  sensitive: EmployeeSensitiveInfo | null  // null in list views (not fetched)
  age: number | null
  emergency_contacts: EmergencyContact[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function toPublic(row: EmployeeRow, includeSensitive = false, emergencyContacts: EmergencyContact[] = []): EmployeePublic {
  return {
    id: row.id, workspace_id: row.workspace_id, user_id: row.user_id,
    employee_id: row.employee_id, first_name: row.first_name, last_name: row.last_name,
    gender: row.gender, date_of_birth: row.date_of_birth, marital_status: row.marital_status,
    number_of_children: row.number_of_children, blood_group: row.blood_group,
    photo_url: row.photo_url, personal_email: row.personal_email, work_email: row.work_email,
    phone: row.phone, alternate_phone: row.alternate_phone, current_address: row.current_address,
    permanent_address: row.permanent_address, employee_status: row.employee_status,
    deleted_at: row.deleted_at, created_at: row.created_at, updated_at: row.updated_at,
    employment: {
      designation: row.designation ?? null,
      department: row.department ?? null,
      work_location: row.work_location ?? null,
      work_mode: row.work_mode ?? null,
      reporting_manager_id: row.reporting_manager_id ?? null,
      employment_type: row.employment_type ?? null,
      source_of_hire: row.source_of_hire ?? null,
      total_work_experience: row.total_work_experience ?? null,
      date_of_joining: row.date_of_joining ?? null,
      confirmation_date: row.confirmation_date ?? null,
      probation_end_date: row.probation_end_date ?? null,
      exit_date: row.exit_date ?? null,
      exit_reason: row.exit_reason ?? null,
    },
    sensitive: includeSensitive ? {
      pan: decryptFieldOrNull(row.pan_encrypted ?? null),
      aadhaar: decryptFieldOrNull(row.aadhaar_encrypted ?? null),
      uan: row.uan ?? null,
      passport_number: row.passport_number ?? null,
      bank_account: decryptFieldOrNull(row.bank_account_encrypted ?? null),
      bank_ifsc: row.bank_ifsc ?? null,
      bank_name: row.bank_name ?? null,
    } : null,
    age: computeAge(row.date_of_birth),
    emergency_contacts: emergencyContacts,
  }
}

const EMPLOYMENT_JOIN = `
  LEFT JOIN employment_details ed ON ed.employee_id = e.id
  LEFT JOIN employee_sensitive es ON es.employee_id = e.id`

const EMPLOYMENT_COLS = `
  ed.designation, ed.department, ed.work_location, ed.work_mode,
  ed.reporting_manager_id, ed.employment_type, ed.source_of_hire,
  ed.total_work_experience, ed.date_of_joining, ed.confirmation_date,
  ed.probation_end_date, ed.exit_date, ed.exit_reason,
  es.pan_encrypted, es.aadhaar_encrypted, es.uan, es.passport_number,
  es.bank_account_encrypted, es.bank_ifsc, es.bank_name`

async function fetchEmergencyContacts(employeeId: string, workspaceId: string): Promise<EmergencyContact[]> {
  return db.query<EmergencyContact>(
    `SELECT id, name, relationship, phone FROM employee_emergency_contacts
     WHERE employee_id = ? AND workspace_id = ?`,
    [employeeId, workspaceId],
  )
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listEmployees(workspaceId: string): Promise<EmployeePublic[]> {
  const rows = await db.query<EmployeeRow>(
    `SELECT e.*,
       ed.designation, ed.department, ed.work_location, ed.work_mode,
       ed.reporting_manager_id, ed.employment_type, ed.source_of_hire,
       ed.total_work_experience, ed.date_of_joining, ed.confirmation_date,
       ed.probation_end_date, ed.exit_date, ed.exit_reason
     FROM employees e
     LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE e.workspace_id = ? AND e.deleted_at IS NULL
     ORDER BY e.last_name ASC, e.first_name ASC`,
    [workspaceId],
  )
  return rows.map(row => toPublic(row))
}

export async function getEmployee(id: string, workspaceId: string): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.id = ? AND e.workspace_id = ? AND e.deleted_at IS NULL`,
    [id, workspaceId],
  )
  if (!row) return null
  const emergencyContacts = await fetchEmergencyContacts(id, workspaceId)
  return toPublic(row, true, emergencyContacts)
}

export async function findEmployeeByEmployeeId(
  workspaceId: string,
  employeeId: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.workspace_id = ? AND e.employee_id = ? AND e.deleted_at IS NULL`,
    [workspaceId, employeeId],
  )
  if (!row) return null
  const emergencyContacts = await fetchEmergencyContacts(row.id, workspaceId)
  return toPublic(row, true, emergencyContacts)
}

export async function findEmployeeByWorkEmail(
  workspaceId: string,
  workEmail: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.workspace_id = ? AND e.work_email = ? AND e.deleted_at IS NULL`,
    [workspaceId, workEmail],
  )
  if (!row) return null
  const emergencyContacts = await fetchEmergencyContacts(row.id, workspaceId)
  return toPublic(row, true, emergencyContacts)
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateEmployeeInput {
  workspace_id: string
  user_id?: string | null
  employee_id?: string | null
  first_name: string
  last_name: string
  work_email: string
  employee_status?: EmployeeStatus
  gender?: Gender | null
  date_of_birth?: string | null
  marital_status?: MaritalStatus | null
  number_of_children?: number | null
  blood_group?: BloodGroup | null
  photo_url?: string | null
  personal_email?: string | null
  phone?: string | null
  alternate_phone?: string | null
  current_address?: string | null
  permanent_address?: string | null
  designation?: string | null
  department?: string | null
  work_location?: string | null
  work_mode?: WorkMode | null
  reporting_manager_id?: string | null
  employment_type?: EmploymentType | null
  source_of_hire?: SourceOfHire | null
  total_work_experience?: number | null
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
  emergency_contacts?: Array<{ name: string; relationship?: string | null; phone: string }>
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeePublic> {
  const id = randomBytes(16).toString('hex')

  await db.transaction(async (txDb) => {
    await txDb.execute(
      `INSERT INTO employees (
        id, workspace_id, user_id, employee_id,
        first_name, last_name, gender, date_of_birth, marital_status,
        number_of_children, blood_group, photo_url,
        personal_email, work_email, phone, alternate_phone,
        current_address, permanent_address, employee_status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, input.workspace_id, input.user_id ?? null, input.employee_id ?? null,
        input.first_name, input.last_name, input.gender ?? null, input.date_of_birth ?? null,
        input.marital_status ?? null, input.number_of_children ?? null,
        input.blood_group ?? null, input.photo_url ?? null,
        input.personal_email ?? null, input.work_email,
        input.phone ?? null, input.alternate_phone ?? null,
        input.current_address ?? null, input.permanent_address ?? null,
        input.employee_status ?? 'active',
      ],
    )

    await txDb.execute(
      `INSERT INTO employment_details (
        id, employee_id, workspace_id,
        designation, department, work_location, work_mode,
        reporting_manager_id, employment_type, source_of_hire,
        total_work_experience, date_of_joining, confirmation_date,
        probation_end_date, exit_date, exit_reason
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        randomBytes(16).toString('hex'), id, input.workspace_id,
        input.designation ?? null, input.department ?? null,
        input.work_location ?? null, input.work_mode ?? null,
        input.reporting_manager_id ?? null, input.employment_type ?? null,
        input.source_of_hire ?? null, input.total_work_experience ?? null,
        input.date_of_joining ?? null, input.confirmation_date ?? null,
        input.probation_end_date ?? null, input.exit_date ?? null, input.exit_reason ?? null,
      ],
    )

    await txDb.execute(
      `INSERT INTO employee_sensitive (
        id, employee_id, workspace_id,
        pan_encrypted, aadhaar_encrypted, uan, passport_number,
        bank_account_encrypted, bank_ifsc, bank_name
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        randomBytes(16).toString('hex'), id, input.workspace_id,
        encryptFieldOrNull(input.pan), encryptFieldOrNull(input.aadhaar),
        input.uan ?? null, input.passport_number ?? null,
        encryptFieldOrNull(input.bank_account), input.bank_ifsc ?? null, input.bank_name ?? null,
      ],
    )

    for (const ec of input.emergency_contacts ?? []) {
      await txDb.execute(
        `INSERT INTO employee_emergency_contacts
         (id, employee_id, workspace_id, name, relationship, phone)
         VALUES (?,?,?,?,?,?)`,
        [randomBytes(16).toString('hex'), id, input.workspace_id, ec.name, ec.relationship ?? null, ec.phone],
      )
    }
  })

  const created = await getEmployee(id, input.workspace_id)
  return created!
}

// ─── Update ───────────────────────────────────────────────────────────────────

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, 'workspace_id' | 'emergency_contacts'>>

export async function updateEmployee(
  id: string,
  workspaceId: string,
  input: UpdateEmployeeInput,
): Promise<EmployeePublic | null> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const eSets: string[] = []
  const eParams: unknown[] = []
  const eSet = (col: string, val: unknown) => { eSets.push(`${col} = ?`); eParams.push(val) }

  if (input.user_id !== undefined)            eSet('user_id', input.user_id)
  if (input.employee_id !== undefined)        eSet('employee_id', input.employee_id)
  if (input.first_name !== undefined)         eSet('first_name', input.first_name)
  if (input.last_name !== undefined)          eSet('last_name', input.last_name)
  if (input.gender !== undefined)             eSet('gender', input.gender)
  if (input.date_of_birth !== undefined)      eSet('date_of_birth', input.date_of_birth)
  if (input.marital_status !== undefined)     eSet('marital_status', input.marital_status)
  if (input.number_of_children !== undefined) eSet('number_of_children', input.number_of_children)
  if (input.blood_group !== undefined)        eSet('blood_group', input.blood_group)
  if (input.photo_url !== undefined)          eSet('photo_url', input.photo_url)
  if (input.personal_email !== undefined)     eSet('personal_email', input.personal_email)
  if (input.work_email !== undefined)         eSet('work_email', input.work_email)
  if (input.phone !== undefined)              eSet('phone', input.phone)
  if (input.alternate_phone !== undefined)    eSet('alternate_phone', input.alternate_phone)
  if (input.current_address !== undefined)    eSet('current_address', input.current_address)
  if (input.permanent_address !== undefined)  eSet('permanent_address', input.permanent_address)
  if (input.employee_status !== undefined)    eSet('employee_status', input.employee_status)

  const dSets: string[] = []
  const dParams: unknown[] = []
  const dSet = (col: string, val: unknown) => { dSets.push(`${col} = ?`); dParams.push(val) }

  if (input.designation !== undefined)            dSet('designation', input.designation)
  if (input.department !== undefined)             dSet('department', input.department)
  if (input.work_location !== undefined)          dSet('work_location', input.work_location)
  if (input.work_mode !== undefined)              dSet('work_mode', input.work_mode)
  if (input.reporting_manager_id !== undefined)   dSet('reporting_manager_id', input.reporting_manager_id)
  if (input.employment_type !== undefined)        dSet('employment_type', input.employment_type)
  if (input.source_of_hire !== undefined)         dSet('source_of_hire', input.source_of_hire)
  if (input.total_work_experience !== undefined)  dSet('total_work_experience', input.total_work_experience)
  if (input.date_of_joining !== undefined)        dSet('date_of_joining', input.date_of_joining)
  if (input.confirmation_date !== undefined)      dSet('confirmation_date', input.confirmation_date)
  if (input.probation_end_date !== undefined)     dSet('probation_end_date', input.probation_end_date)
  if (input.exit_date !== undefined)              dSet('exit_date', input.exit_date)
  if (input.exit_reason !== undefined)            dSet('exit_reason', input.exit_reason)

  const sSets: string[] = []
  const sParams: unknown[] = []
  const sSet = (col: string, val: unknown) => { sSets.push(`${col} = ?`); sParams.push(val) }

  if (input.pan !== undefined)              sSet('pan_encrypted', encryptFieldOrNull(input.pan))
  if (input.aadhaar !== undefined)          sSet('aadhaar_encrypted', encryptFieldOrNull(input.aadhaar))
  if (input.uan !== undefined)              sSet('uan', input.uan)
  if (input.passport_number !== undefined)  sSet('passport_number', input.passport_number)
  if (input.bank_account !== undefined)     sSet('bank_account_encrypted', encryptFieldOrNull(input.bank_account))
  if (input.bank_ifsc !== undefined)        sSet('bank_ifsc', input.bank_ifsc)
  if (input.bank_name !== undefined)        sSet('bank_name', input.bank_name)

  if (eSets.length === 0 && dSets.length === 0 && sSets.length === 0) {
    return getEmployee(id, workspaceId)
  }

  await db.transaction(async (txDb) => {
    if (eSets.length > 0) {
      eSets.push('updated_at = ?')
      eParams.push(now, id, workspaceId)
      await txDb.execute(
        `UPDATE employees SET ${eSets.join(', ')}
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        eParams,
      )
    }
    if (dSets.length > 0) {
      dSets.push('updated_at = ?')
      dParams.push(now, id, workspaceId)
      await txDb.execute(
        `UPDATE employment_details SET ${dSets.join(', ')}
         WHERE employee_id = ? AND workspace_id = ?`,
        dParams,
      )
    }
    if (sSets.length > 0) {
      sSets.push('updated_at = ?')
      sParams.push(now, id, workspaceId)
      await txDb.execute(
        `UPDATE employee_sensitive SET ${sSets.join(', ')}
         WHERE employee_id = ? AND workspace_id = ?`,
        sParams,
      )
    }
  })

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

// ─── Emergency contacts ───────────────────────────────────────────────────────

export async function addEmergencyContact(
  employeeId: string,
  workspaceId: string,
  contact: { name: string; relationship?: string | null; phone: string },
): Promise<EmergencyContact> {
  const id = randomBytes(16).toString('hex')
  await db.execute(
    `INSERT INTO employee_emergency_contacts
     (id, employee_id, workspace_id, name, relationship, phone)
     VALUES (?,?,?,?,?,?)`,
    [id, employeeId, workspaceId, contact.name, contact.relationship ?? null, contact.phone],
  )
  return { id, name: contact.name, relationship: contact.relationship ?? null, phone: contact.phone }
}

export async function removeEmergencyContact(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    `DELETE FROM employee_emergency_contacts WHERE id = ? AND workspace_id = ?`,
    [id, workspaceId],
  )
  return result.changes > 0
}
