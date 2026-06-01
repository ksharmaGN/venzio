import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { actionLeaveRequest, getLeaveTypeById } from '@/lib/db/queries/leaves'
import { getUserById } from '@/lib/db/queries/users'

interface Props { params: Promise<{ slug: string; id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: { action?: unknown; rejection_reason?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const rejectionReason =
    typeof body.rejection_reason === 'string' ? body.rejection_reason.trim() : ''

  if (action === 'reject' && !rejectionReason) {
    return NextResponse.json(
      { error: 'rejection_reason is required when rejecting', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const result = await actionLeaveRequest({
    id,
    workspaceId: ctx.workspace.id,
    action,
    actionedByUserId: ctx.userId,
    rejectionReason: action === 'reject' ? rejectionReason : null,
  })

  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Leave request not found', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { error: 'Leave request has already been actioned', code: 'ALREADY_ACTIONED' },
      { status: 409 },
    )
  }

  // Fetch employee and leave type for context (used by future notification tickets)
  const [employee, leaveType] = await Promise.all([
    getUserById(result.updated.user_id),
    getLeaveTypeById(result.updated.leave_type_id, ctx.workspace.id),
  ])

  return NextResponse.json({
    leaveRequest: result.updated,
    employee: employee ? { id: employee.id, email: employee.email, full_name: employee.full_name } : null,
    leaveType: leaveType ? { id: leaveType.id, name: leaveType.name } : null,
  })
}
