import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceMemberByRecordId } from '@/lib/db/queries/workspaces'
import {
  getWorkspaceLeaveTypes,
  getLeaveTypeById,
  getLatestLeaveBalanceAdjustmentsForUser,
  setLeaveBalanceAdjustment,
  nextQuarterStart,
} from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string; memberId: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const member = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!member || !member.user_id) {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const types = await getWorkspaceLeaveTypes(ctx.workspace.id)
  const adjustments = await getLatestLeaveBalanceAdjustmentsForUser(ctx.workspace.id, member.user_id)
  const adjMap = new Map(adjustments.map((a) => [a.leave_type_id, a]))

  const result = types.map((t) => {
    const adj = adjMap.get(t.id)
    return {
      leave_type_id: t.id,
      leave_type_name: t.name,
      balance_days: adj?.balance_days ?? null,
      effective_date: adj?.effective_date ?? null,
      created_at: adj?.created_at ?? null,
    }
  })

  return NextResponse.json({ adjustments: result })
}

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const member = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!member || !member.user_id) {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: { leave_type_id?: unknown; balance_days?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const leaveTypeId = typeof body.leave_type_id === 'string' ? body.leave_type_id : ''
  if (!leaveTypeId) {
    return NextResponse.json({ error: 'leave_type_id is required', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const balanceDays = typeof body.balance_days === 'number' ? body.balance_days : NaN
  if (isNaN(balanceDays) || balanceDays < 0) {
    return NextResponse.json({ error: 'balance_days must be a non-negative number', code: 'INVALID_BALANCE' }, { status: 400 })
  }

  const leaveType = await getLeaveTypeById(leaveTypeId, ctx.workspace.id)
  if (!leaveType) {
    return NextResponse.json({ error: 'Leave type not found', code: 'LEAVE_TYPE_NOT_FOUND' }, { status: 404 })
  }

  const adjustment = await setLeaveBalanceAdjustment({
    workspaceId: ctx.workspace.id,
    userId: member.user_id,
    leaveTypeId,
    balanceDays,
    effectiveDate: nextQuarterStart(),
    createdBy: ctx.userId,
  })

  return NextResponse.json({ adjustment }, { status: 201 })
}
