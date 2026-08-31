import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getAsset, assignAsset, unassignAsset } from '@/lib/db/queries/assets'
import { getEmployee } from '@/lib/db/queries/employees'

interface Props { params: Promise<{ slug: string; id: string }> }

function notFound() {
  return NextResponse.json({ error: 'Asset not found', code: 'NOT_FOUND' }, { status: 404 })
}

// ─── POST /api/ws/[slug]/assets/[id]/assign ───────────────────────────────────
// Body: { employee_id }

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Write)
  if (!ctx) return forbidden()

  const asset = await getAsset(id, ctx.workspace.id)
  if (!asset) return notFound()

  let body: { employee_id?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : ''
  if (!employeeId) {
    return NextResponse.json(
      { error: 'employee_id is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  // The employee id comes from the client, so it is resolved against THIS
  // workspace before it is written - otherwise an asset could be handed to an
  // employee of another tenant.
  const employee = await getEmployee(employeeId, ctx.workspace.id)
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' }, { status: 404 })
  }

  if (asset.status === 'retired') {
    return NextResponse.json(
      { error: 'A retired asset cannot be assigned', code: 'ASSET_RETIRED' },
      { status: 409 },
    )
  }

  if (asset.assigned_employee_id && asset.assigned_employee_id !== employeeId) {
    return NextResponse.json(
      { error: 'Asset is already assigned - return it first', code: 'ALREADY_ASSIGNED' },
      { status: 409 },
    )
  }

  const updated = await assignAsset(id, ctx.workspace.id, employeeId)
  return NextResponse.json({ asset: updated })
}

// ─── DELETE /api/ws/[slug]/assets/[id]/assign ─────────────────────────────────
// Return the asset to the pool.

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Write)
  if (!ctx) return forbidden()

  const asset = await getAsset(id, ctx.workspace.id)
  if (!asset) return notFound()

  if (!asset.assigned_employee_id) {
    return NextResponse.json(
      { error: 'Asset is not currently assigned', code: 'NOT_ASSIGNED' },
      { status: 409 },
    )
  }

  const updated = await unassignAsset(id, ctx.workspace.id)
  return NextResponse.json({ asset: updated })
}
