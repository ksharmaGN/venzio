import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import type { PresenceEventWithMatch, MatchedBy } from '@/lib/signals'
import { getActiveMembersWithDetails, getSignalConfigs } from '@/lib/db/queries/workspaces'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { isOfficeMatched } from '@/lib/attendance-summary'
import type { DashboardMember, DashboardResponse } from '../dashboard/route'
import type { InsightBucket, InsightsResponse } from '../insights/route'
import type { RealtimeMinuteBucket, RealtimeLocation, RealtimeResponse } from '../realtime/route'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ws/[slug]/today-summary
 *
 * Combines the Overview page's three "today" widgets (dashboard member list,
 * hourly check-in chart, and the 30-minute realtime pulse) into a single
 * request. All three derive from the same underlying event window, so this
 * fetches events once instead of the 3x redundant queryWorkspaceEvents calls
 * (and 3x redundant requireWsAdmin lookups) that /dashboard, /insights, and
 * /realtime each did independently when called separately from the client.
 */
export interface TodaySummaryResponse {
  dashboard: DashboardResponse
  hourly: InsightsResponse
  realtime: RealtimeResponse
}

function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function zp(n: number): string {
  return String(n).padStart(2, '0')
}

/** Parse a DB datetime ("YYYY-MM-DD HH:MM:SS" or ISO) into epoch ms. */
function toMs(dt: string): number {
  return new Date(dt.includes('T') ? (dt.endsWith('Z') ? dt : dt + 'Z') : dt.replace(' ', 'T') + 'Z').getTime()
}

function isPresentOffice(member: DashboardMember): boolean {
  return member.presence_status === 'present' && !!member.latest_event && isOfficeMatched(member.latest_event.matched_by)
}

function isPresentRemote(member: DashboardMember): boolean {
  return member.presence_status === 'present' && !!member.latest_event && !isOfficeMatched(member.latest_event.matched_by)
}

/** Sum session hours for completed events. */
function sessionHours(events: { checkin_at: string; checkout_at: string | null }[]): number {
  let total = 0
  for (const ev of events) {
    if (!ev.checkout_at) continue
    total += Math.max(0, (toMs(ev.checkout_at) - toMs(ev.checkin_at)) / (1000 * 60 * 60))
  }
  return Math.round(total * 10) / 10
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const { workspace } = ctx

  // Dashboard list params - same defaults as /api/ws/[slug]/dashboard
  const sp = request.nextUrl.searchParams
  const statusFilter = (sp.get('status') ?? 'all') as 'all' | 'present' | 'visited' | 'notIn'
  const signalFilter = (sp.get('signal') ?? 'all') as 'all' | MatchedBy
  const search = (sp.get('search') ?? '').toLowerCase().trim()
  const sortBy = (sp.get('sortBy') ?? 'time') as 'name' | 'time' | 'duration'
  const sortDir = (sp.get('sortDir') ?? 'asc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '10', 10)))

  const tz = workspace.display_timezone || 'UTC'
  const todayStr = todayInTz(tz)
  const startUtc = localMidnightToUtc(todayStr, tz)
  const endUtc = localMidnightToUtc(nextDayStr(todayStr), tz)

  // Wide +/-1 day UTC window - a superset of both the dashboard's local-today
  // window and the realtime widget's last-30-minute window, for any timezone
  // offset. One event fetch at this width covers all three widgets below.
  const [ly, lm, ld] = todayStr.split('-').map(Number)
  const wideStart = new Date(Date.UTC(ly, lm - 1, ld - 1)).toISOString().slice(0, 10) + 'T00:00:00Z'
  const wideEnd = new Date(Date.UTC(ly, lm - 1, ld + 1)).toISOString().slice(0, 10) + 'T23:59:59Z'

  const [wideEvents, members, signalConfigs] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, { startDate: wideStart, endDate: wideEnd }),
    getActiveMembersWithDetails(workspace.id),
    getSignalConfigs(workspace.id),
  ])

  // ── Dashboard ────────────────────────────────────────────────────────────
  const startMs = toMs(startUtc)
  const endMs = toMs(endUtc)
  const dashboardEvents = wideEvents.filter((ev) => {
    const t = toMs(ev.checkin_at)
    return t >= startMs && t < endMs
  })

  const eventsByUser = new Map<string, PresenceEventWithMatch[]>()
  for (const event of dashboardEvents) {
    const arr = eventsByUser.get(event.user_id) ?? []
    arr.push(event)
    eventsByUser.set(event.user_id, arr)
  }

  const allMembers: DashboardMember[] = members.map((member: MemberWithUser) => {
    const userEvents = eventsByUser.get(member.user_id) ?? []
    const openEvent = userEvents.find((e) => !e.checkout_at)
    const latest = openEvent ?? userEvents[0] ?? null

    let presence_status: 'present' | 'visited' | 'notIn'
    if (!latest) {
      presence_status = 'notIn'
    } else if (openEvent) {
      presence_status = 'present'
    } else {
      presence_status = 'visited'
    }

    return {
      member_id: member.member_id,
      user_id: member.user_id,
      email: member.email,
      role: member.role,
      full_name: member.full_name,
      presence_status,
      latest_event: latest
        ? {
            checkin_at: latest.checkin_at,
            checkout_at: latest.checkout_at,
            matched_by: latest.matched_by,
            event_type: latest.event_type,
            matched_signals: latest.matched_signals,
            trust_flags: latest.trust_flags ? (JSON.parse(latest.trust_flags) as string[]) : [],
            ip_address: latest.ip_address,
            gps_lat: latest.gps_lat,
            gps_lng: latest.gps_lng,
            location_label: latest.location_label,
            checkout_location_mismatch: latest.checkout_location_mismatch ?? null,
          }
        : null,
      event_count: userEvents.length,
    }
  })

  const counts = {
    present: allMembers.filter((m) => m.presence_status === 'present').length,
    visited: allMembers.filter((m) => m.presence_status === 'visited').length,
    notIn: allMembers.filter((m) => m.presence_status === 'notIn').length,
    total: allMembers.length,
    office: allMembers.filter(isPresentOffice).length,
    remote: allMembers.filter(isPresentRemote).length,
  }

  let filtered = allMembers
  if (statusFilter !== 'all') filtered = filtered.filter((m) => m.presence_status === statusFilter)
  if (signalFilter !== 'all') filtered = filtered.filter((m) => m.latest_event?.matched_by === signalFilter)
  if (search) {
    filtered = filtered.filter((m) => {
      const name = (m.full_name ?? '').toLowerCase()
      return name.includes(search) || m.email.toLowerCase().includes(search)
    })
  }

  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') {
      cmp = (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email)
    } else if (sortBy === 'time') {
      const tA = a.latest_event?.checkin_at ?? ''
      const tB = b.latest_event?.checkin_at ?? ''
      cmp = tA.localeCompare(tB)
    } else {
      // duration: present members with no checkout first (they're ongoing)
      const durationMs = (m: DashboardMember) =>
        m.latest_event
          ? m.latest_event.checkout_at
            ? toMs(m.latest_event.checkout_at) - toMs(m.latest_event.checkin_at)
            : Date.now() - toMs(m.latest_event.checkin_at)
          : 0
      cmp = durationMs(a) - durationMs(b)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const locationMap = new Map<string, number>()
  for (const m of allMembers) {
    if (m.presence_status === 'notIn') continue
    const isRemote = !!m.latest_event && !isOfficeMatched(m.latest_event.matched_by)
    const label = m.latest_event?.location_label
      ?? (isRemote ? 'Remote' : (m.latest_event?.matched_signals?.includes('wifi') ? 'Office (Wi-Fi)' : m.latest_event?.matched_signals?.includes('gps') ? 'Office (GPS)' : 'Office'))
    locationMap.set(label, (locationMap.get(label) ?? 0) + 1)
  }
  const location_counts = [...locationMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const total = filtered.length
  const offset = (page - 1) * limit
  const paged = filtered.slice(offset, offset + limit)

  const dashboard: DashboardResponse = {
    members: paged,
    all_members: allMembers,
    total,
    page,
    limit,
    counts,
    location_counts,
    workspace_name: workspace.name,
  }

  // ── Hourly ("today" insights bucket chart) ─────────────────────────────────
  const localDateStr = (dt: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt)
  const localHour = (dt: Date) => {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(dt)
    return parseInt(s, 10) % 24
  }

  const now = new Date()
  const nowLocalH = localHour(now)

  type BucketDef = {
    key: string
    label: string
    match: (dt: Date) => boolean
    matchPresence: (cinDt: Date, coutDt: Date | null) => boolean
  }
  const bucketDefs: BucketDef[] = []
  for (let h = 0; h <= nowLocalH; h++) {
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const bucketH = h
    bucketDefs.push({
      key: zp(h),
      label,
      match: (dt) => localDateStr(dt) === todayStr && localHour(dt) === bucketH,
      matchPresence: (cinDt, coutDt) => {
        const cinDate = localDateStr(cinDt)
        const cinH = localHour(cinDt)
        if (cinDate !== todayStr) return false
        if (cinH > bucketH) return false
        if (bucketH === nowLocalH) return !coutDt
        if (!coutDt) return true
        const coutDate = localDateStr(coutDt)
        const coutH = localHour(coutDt)
        return coutDate > todayStr || (coutDate === todayStr && coutH >= bucketH)
      },
    })
  }

  const eligibleMemberSet = new Set(members.map((m) => m.user_id))
  const officeEvents = wideEvents.filter((ev) => {
    if (!eligibleMemberSet.has(ev.user_id)) return false
    if (ev.event_type === 'remote_checkin') return false
    return ev.matched_by === 'verified' || ev.matched_by === 'override'
  })

  const periodEvents = officeEvents.filter((ev) => localDateStr(new Date(toMs(ev.checkin_at))) === todayStr)
  const total_checkins_period = periodEvents.length
  const total_hours_period = sessionHours(periodEvents)
  const total_members = members.length
  const denom = total_members * 1 // avgDays = 1 for the "today" interval
  const avg_hours_per_member = denom > 0 ? Math.round((total_hours_period / denom) * 10) / 10 : 0

  const buckets: InsightBucket[] = bucketDefs.map((def) => {
    const present = officeEvents.filter((ev) => {
      const cinDt = new Date(toMs(ev.checkin_at))
      const coutDt = ev.checkout_at ? new Date(toMs(ev.checkout_at)) : null
      return def.matchPresence(cinDt, coutDt)
    })
    const matchingCheckins = officeEvents.filter((ev) => def.match(new Date(toMs(ev.checkin_at))))
    return {
      label: def.label,
      key: def.key,
      unique_users: new Set(present.map((e) => e.user_id)).size,
      total_checkins: matchingCheckins.length,
      total_hours: sessionHours(matchingCheckins),
    }
  })

  const maxBucket = buckets.reduce<InsightBucket | null>(
    (best, b) => (b.unique_users > (best?.unique_users ?? -1) ? b : best),
    null,
  )
  const daysWithData = buckets.filter((b) => b.unique_users > 0).length
  const avg_daily_users =
    daysWithData > 0 ? Math.round((buckets.reduce((s, b) => s + b.unique_users, 0) / daysWithData) * 10) / 10 : 0

  const hourly: InsightsResponse = {
    interval: 'today',
    buckets,
    total_members,
    peak_bucket: maxBucket?.unique_users ? maxBucket.key : null,
    avg_daily_users,
    total_checkins: total_checkins_period,
    avg_hours_per_member,
  }

  // ── Realtime (last 30 minutes) ──────────────────────────────────────────────
  const nowMs = now.getTime()
  const windowMs = 30 * 60 * 1000
  const rtStartMs = nowMs - windowMs

  const recentEvents = wideEvents.filter((ev) => {
    const checkinMs = toMs(ev.checkin_at)
    return checkinMs >= rtStartMs && checkinMs <= nowMs
  })

  const per_minute: RealtimeMinuteBucket[] = Array.from({ length: 30 }, (_, i) => {
    const bucketStart = rtStartMs + i * 60000
    const bucketEnd = bucketStart + 60000
    const users = new Set<string>()
    for (const ev of recentEvents) {
      const checkinMs = toMs(ev.checkin_at)
      const checkoutMs = ev.checkout_at ? toMs(ev.checkout_at) : Infinity
      if (checkinMs <= bucketEnd && checkoutMs >= bucketStart) users.add(ev.user_id)
    }
    const minsAgo = 29 - i
    const label = minsAgo === 0 ? 'now' : `${minsAgo}m`
    return { minute: i, label, count: users.size }
  })

  const rtLocationMap = new Map<string, Set<string>>()
  for (const cfg of signalConfigs) {
    const label = cfg.location_name
      ?? (cfg.signal_type === 'wifi' ? 'Office (Wi-Fi)' : cfg.signal_type === 'gps' ? 'Office (GPS)' : 'Remote')
    if (!rtLocationMap.has(label)) rtLocationMap.set(label, new Set())
  }
  for (const ev of recentEvents) {
    const isOffice = ev.matched_by === 'verified' || ev.matched_by === 'override'
    const loc = ev.location_label
      ?? (isOffice
        ? (ev.matched_signals.includes('wifi') ? 'Office (Wi-Fi)' : ev.matched_signals.includes('gps') ? 'Office (GPS)' : 'Office')
        : 'Remote')
    const users = rtLocationMap.get(loc) ?? new Set()
    users.add(ev.user_id)
    rtLocationMap.set(loc, users)
  }
  const active_count = new Set([...rtLocationMap.values()].flatMap((s) => [...s])).size
  const locations: RealtimeLocation[] = [...rtLocationMap.entries()]
    .map(([label, users]) => ({ label, count: users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const realtime: RealtimeResponse = { active_count, per_minute, locations }

  return NextResponse.json({ dashboard, hourly, realtime } satisfies TodaySummaryResponse, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
