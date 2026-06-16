import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getEmployee } from '@/lib/db/queries/employees'
import { removeEmergencyContact } from '@/lib/db/queries/employees-contacts'

interface Props { params: Promise<{ slug: string; id: string; contactId: string }> }

// ─── DELETE /api/ws/[slug]/employees/[id]/emergency-contacts/[contactId] ──────

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id, contactId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const employee = await getEmployee(id, ctx.workspace.id)
  if (!employee) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })

  const ok = await removeEmergencyContact(contactId, id, ctx.workspace.id)
  if (!ok) return NextResponse.json({ error: 'Contact not found', code: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json({ success: true })
}
