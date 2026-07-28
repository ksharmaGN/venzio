import type { MemberTodaySummary } from "@/app/api/me/ws/[slug]/today/route";

export interface WorkspaceTodayResponse {
  workspace: { id: string; name: string; slug: string };
  viewerRole: string;
  members: MemberTodaySummary[];
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
}

export type MemberDisplayStatus = "in_office" | "remote" | "not_in";

export interface LeaveTypeWithBalance {
  id: string
  name: string
  accrual_frequency: 'monthly' | 'quarterly'
  accrual_credits: number
  available_days: number
  total_accrued: number
  used_days: number
}

export interface MemberOnLeaveToday {
  user_id: string
  full_name: string | null
  email: string
  leave_type_name: string
}

export interface LeaveRequestWithType {
  id: string
  leave_type_id: string
  leave_type_name: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  rejection_reason: string | null
  created_at: string
}

export type AccordionTab = "office" | "remote" | "leave" | "onLeave" | "holidays" | "myLeaves";

export interface ApplyLeaveState {
  open: boolean
  types: LeaveTypeWithBalance[]
  typesLoading: boolean
  selectedTypeId: string
  startDate: string
  endDate: string
  reason: string
  submitting: boolean
  error: string | null
  success: boolean
}
