import type {
  Gender,
  MaritalStatus,
  BloodGroup,
  WorkMode,
  EmploymentType,
  EmployeeStatus,
  SourceOfHire,
} from '@/lib/employee-constants'

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
  sensitive: EmployeeSensitiveInfo | null
  age: number | null
  emergency_contacts: EmergencyContact[]
}

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

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, 'workspace_id' | 'emergency_contacts'>>
