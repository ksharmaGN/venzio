export const GENDER_VALUES = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const
export type Gender = typeof GENDER_VALUES[number]

export const MARITAL_STATUS_VALUES = ['single', 'married', 'divorced', 'widowed', 'separated'] as const
export type MaritalStatus = typeof MARITAL_STATUS_VALUES[number]

export const BLOOD_GROUP_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
export type BloodGroup = typeof BLOOD_GROUP_VALUES[number]

export const WORK_MODE_VALUES = ['office', 'remote', 'hybrid'] as const
export type WorkMode = typeof WORK_MODE_VALUES[number]

export const EMPLOYMENT_TYPE_VALUES = ['full_time', 'part_time', 'contract', 'intern', 'consultant'] as const
export type EmploymentType = typeof EMPLOYMENT_TYPE_VALUES[number]

export const EMPLOYEE_STATUS_VALUES = ['active', 'terminated', 'suspended', 'on_leave', 'notice_period'] as const
export type EmployeeStatus = typeof EMPLOYEE_STATUS_VALUES[number]

export const SOURCE_OF_HIRE_VALUES = ['direct', 'referral', 'job_portal', 'consultancy', 'campus'] as const
export type SourceOfHire = typeof SOURCE_OF_HIRE_VALUES[number]
