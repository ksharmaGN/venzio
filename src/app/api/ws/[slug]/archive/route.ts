import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { archiveWorkspace } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string }> }

/**
 * POST /api/ws/[slug]/archive
 *
 * Archives a workspace. Admin only. Workspace is soft-archived (archived_at set).
 * Data is preserved. Workspace can be identified at /ws but is greyed out.
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, 'ownership', 'write')
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  if (ctx.workspace.archived_at) {
    return NextResponse.json({ error: 'Workspace is already archived', code: 'ALREADY_ARCHIVED' }, { status: 409 })
  }

  await archiveWorkspace(ctx.workspace.id)
  return NextResponse.json({ ok: true })
}
