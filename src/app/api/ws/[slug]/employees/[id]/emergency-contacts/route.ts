import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getEmployee } from '@/lib/db/queries/employees'
import { addEmergencyContact } from '@/lib/db/queries/employees-contacts'

interface Props { params: Promise<{ slug: string; id: string }> }

// ─── POST /api/ws/[slug]/employees/[id]/emergency-contacts ────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const employee = await getEmployee(id, ctx.workspace.id)
  if (!employee) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fieldErrors: Record<string, string> = {}
  if (!body.name || typeof body.name !== 'string' || !(body.name as string).trim()) {
    fieldErrors.name = 'REQUIRED'
  }
  if (!body.phone || typeof body.phone !== 'string' || !(body.phone as string).trim()) {
    fieldErrors.phone = 'REQUIRED'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: fieldErrors },
      { status: 422 },
    )
  }

  const contact = await addEmergencyContact(id, ctx.workspace.id, {
    name: (body.name as string).trim(),
    phone: (body.phone as string).trim(),
    relationship: typeof body.relationship === 'string' ? body.relationship.trim() || null : null,
  })

  return NextResponse.json({ contact }, { status: 201 })
}
