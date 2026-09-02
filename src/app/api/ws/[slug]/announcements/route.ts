import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { createAnnouncement, listAnnouncements } from '@/lib/db/queries/announcements'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { createNotification } from '@/lib/db/queries/notifications'
import { sendPushToUser } from '@/lib/push'

interface Props { params: Promise<{ slug: string }> }

/** Same shape as the employees routes' 422: a per-field code map. */
type FieldErrors = Record<string, string>

const MAX_TITLE_LEN = 200
const MAX_BODY_LEN = 4000

// ─── GET /api/ws/[slug]/announcements ────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Read)
  if (!ctx) return forbidden()

  const announcements = await listAnnouncements(ctx.workspace.id)
  return NextResponse.json({ announcements })
}

// ─── POST /api/ws/[slug]/announcements ───────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Write)
  if (!ctx) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fields: FieldErrors = {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const message = typeof body.body === 'string' ? body.body.trim() : ''

  if (!title) fields.title = 'REQUIRED'
  else if (title.length > MAX_TITLE_LEN) fields.title = 'TOO_LONG'
  if (!message) fields.body = 'REQUIRED'
  else if (message.length > MAX_BODY_LEN) fields.body = 'TOO_LONG'

  if (Object.keys(fields).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields },
      { status: 422 },
    )
  }

  // ── Order matters: the record FIRST, then the fan-out. ────────────────────
  //
  // A notification's `ref_id` points at the announcement row, so writing the
  // row first is the only order in which that pointer is ever valid. Crash
  // mid-fan-out and the announcement exists with some people notified and some
  // not: recoverable, and visible to the admin in the Posted list. The reverse
  // order would push a notification whose `ref_id` names a row that does not
  // exist - unrecoverable, and invisible until a member taps it.
  const announcement = await createAnnouncement({
    workspaceId: ctx.workspace.id,
    title,
    body: message,
    createdBy: ctx.userId,
  })

  const recipients = await getActiveMemberIds(ctx.workspace.id)

  // One allSettled over both deliveries for every recipient. Delivery is
  // best-effort by design: a member with no push subscription, a dead
  // endpoint, or missing VAPID keys must not fail an announcement that is
  // already durably recorded. The in-app notification is the guaranteed
  // channel; push is the nudge toward it.
  const results = await Promise.allSettled(
    recipients.flatMap((userId) => [
      createNotification({
        userId,
        workspaceId: ctx.workspace.id,
        type: 'announcement',
        refType: 'announcement',
        refId: announcement.id,
        title,
        body: message,
      }),
      sendPushToUser(userId, {
        title,
        body: message,
        tag: `announcement-${announcement.id}`,
        data: { url: `/me/notifications?ws=${slug}` },
      }),
    ]),
  )

  // `delivered` counts people whose in-app notification landed - the channel we
  // promise - not push attempts. The notification write is the even-indexed
  // entry of each recipient's pair.
  const delivered = recipients.reduce(
    (count, _userId, i) => (results[i * 2]?.status === 'fulfilled' ? count + 1 : count),
    0,
  )

  return NextResponse.json({ announcement, delivered }, { status: 201 })
}
