import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { markNotificationsRead } from '@/lib/db/queries/notifications'

interface Props { params: Promise<{ slug: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  let body: { ids?: unknown } = {}
  try { body = await req.json() } catch { /* optional */ }
  const ids = Array.isArray(body.ids) && body.ids.every((id) => typeof id === 'string') ? (body.ids as string[]) : undefined
  await markNotificationsRead(ctx.userId, ctx.workspace.id, ids)
  return NextResponse.json({ ok: true })
}
