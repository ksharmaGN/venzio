import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { deleteSignalConfig } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string; signalId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, signalId } = await params
  const ctx = await requireWsAccess(request, slug, 'signals', 'delete')
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await deleteSignalConfig(signalId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
