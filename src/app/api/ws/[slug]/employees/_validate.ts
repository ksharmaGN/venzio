import {
  Gender,
  MaritalStatus,
  BloodGroup,
  WorkMode,
  EmploymentType,
  EmployeeStatus,
  SourceOfHire,
} from '@/lib/constants/employees'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^@]+@[^@]+\.[^@]+$/
const UAN_RE = /^\d{12}$/

export const FieldErrorCode = {
  REQUIRED: 'REQUIRED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_ENUM: 'INVALID_ENUM',
  MUST_BE_BEFORE_TODAY: 'MUST_BE_BEFORE_TODAY',
  MUST_BE_AFTER_DOJ: 'MUST_BE_AFTER_DOJ',
  MUST_BE_NON_NEGATIVE: 'MUST_BE_NON_NEGATIVE',
} as const

export type FieldErrors = Record<string, string>

export function validateEmployeeFields(
  body: Record<string, unknown>,
  opts: { requireDoj?: boolean; existingDoj?: string | null } = {},
): FieldErrors {
  const fields: FieldErrors = {}
  const today = new Date().toISOString().slice(0, 10)

  // Email fields
  if (body.work_email !== undefined) {
    const v = body.work_email
    if (typeof v !== 'string' || !v.trim() || !EMAIL_RE.test(v.trim())) {
      fields.work_email = FieldErrorCode.INVALID_EMAIL
    }
  }
  if (body.personal_email !== undefined && body.personal_email !== null) {
    const v = body.personal_email
    if (typeof v === 'string' && v.trim() && !EMAIL_RE.test(v.trim())) {
      fields.personal_email = FieldErrorCode.INVALID_EMAIL
    }
  }

  // date_of_joining
  if (body.date_of_joining !== undefined) {
    const v = body.date_of_joining
    if (typeof v !== 'string' || !DATE_RE.test(v)) {
      fields.date_of_joining = FieldErrorCode.INVALID_FORMAT
    } else if (v > today) {
      fields.date_of_joining = FieldErrorCode.MUST_BE_BEFORE_TODAY
    }
  } else if (opts.requireDoj) {
    fields.date_of_joining = FieldErrorCode.REQUIRED
  }

  // exit_date — compare against body doj first, then existing doj
  if (body.exit_date !== undefined && body.exit_date !== null) {
    const v = body.exit_date
    if (typeof v !== 'string' || !DATE_RE.test(v)) {
      fields.exit_date = FieldErrorCode.INVALID_FORMAT
    } else {
      const doj =
        typeof body.date_of_joining === 'string' && DATE_RE.test(body.date_of_joining)
          ? body.date_of_joining
          : (opts.existingDoj ?? null)
      if (doj && v < doj) fields.exit_date = FieldErrorCode.MUST_BE_AFTER_DOJ
    }
  }

  // UAN
  if (body.uan !== undefined && body.uan !== null) {
    if (typeof body.uan !== 'string' || !UAN_RE.test(body.uan)) {
      fields.uan = FieldErrorCode.INVALID_FORMAT
    }
  }

  // total_work_experience
  if (body.total_work_experience !== undefined && body.total_work_experience !== null) {
    if (typeof body.total_work_experience !== 'number' || body.total_work_experience < 0) {
      fields.total_work_experience = FieldErrorCode.MUST_BE_NON_NEGATIVE
    }
  }

  // Enum fields
  const enumCheck = <T extends readonly string[]>(key: string, allowed: T) => {
    const v = body[key]
    if (v !== undefined && v !== null && !allowed.includes(v as string)) {
      fields[key] = FieldErrorCode.INVALID_ENUM
    }
  }
  enumCheck('gender', Object.values(Gender))
  enumCheck('marital_status', Object.values(MaritalStatus))
  enumCheck('blood_group', Object.values(BloodGroup))
  enumCheck('work_mode', Object.values(WorkMode))
  enumCheck('employment_type', Object.values(EmploymentType))
  enumCheck('employee_status', Object.values(EmployeeStatus))
  enumCheck('source_of_hire', Object.values(SourceOfHire))

  return fields
}
