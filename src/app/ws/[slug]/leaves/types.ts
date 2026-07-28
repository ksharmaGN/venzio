export type AcrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'

export interface LeaveTypeRow {
  id: string
  name: string
  accrual_frequency: AcrualFrequency
  accrual_credits: number
}
