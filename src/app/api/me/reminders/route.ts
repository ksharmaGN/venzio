import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const row = await db.queryOne<{
    reminder_office_arrival: number
    reminder_checkout: number
    reminder_interval_hours: number
  }>(
    `SELECT reminder_office_arrival, reminder_checkout, reminder_interval_hours
     FROM users WHERE id = ?`,
    [user.userId],
  )
  return NextResponse.json({
    office_arrival: (row?.reminder_office_arrival ?? 1) === 1,
    checkout_reminders: (row?.reminder_checkout ?? 1) === 1,
    interval_hours: row?.reminder_interval_hours === 2 ? 2 : 4,
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  let body: {
    office_arrival?: boolean
    checkout_reminders?: boolean
    interval_hours?: 2 | 4
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const office = body.office_arrival !== undefined ? (body.office_arrival ? 1 : 0) : undefined
  const checkout =
    body.checkout_reminders !== undefined ? (body.checkout_reminders ? 1 : 0) : undefined
  const interval =
    body.interval_hours === 2 || body.interval_hours === 4 ? body.interval_hours : undefined

  const fields: string[] = []
  const values: (number | string)[] = []
  if (office !== undefined) {
    fields.push('reminder_office_arrival = ?')
    values.push(office)
  }
  if (checkout !== undefined) {
    fields.push('reminder_checkout = ?')
    values.push(checkout)
  }
  if (interval !== undefined) {
    fields.push('reminder_interval_hours = ?')
    values.push(interval)
  }
  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  values.push(user.userId)
  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)

  return NextResponse.json({ success: true })
}
