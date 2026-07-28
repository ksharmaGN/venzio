'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardMember, DashboardResponse } from '@/app/api/ws/[slug]/dashboard/route'
import type { InsightsResponse } from '@/app/api/ws/[slug]/insights/route'
import type { RealtimeResponse } from '@/app/api/ws/[slug]/realtime/route'
import { resolvePresenceTag } from '@/lib/client/presence'
import { en } from '@/locales/en'
import { useToast } from '@/components/shared/Toast'
import { Users, Monitor, Home, Activity, Calendar } from 'lucide-react'
import { StatCard } from './StatCard'
import { MembersModal } from './MembersModal'
import { OfficePresenceGraph } from './OfficePresenceGraph'
import { CurrentActiveMembersCard } from './CurrentActiveMembersCard'
import { PendingApprovalsCard } from './PendingApprovalsCard'
import { DepartmentHeadcountCard } from './DepartmentHeadcountCard'
import { CelebrationsCard } from './CelebrationsCard'

interface Props {
  slug: string
  planLimitBanner?: React.ReactNode
}

export default function TodayClient({ slug, planLimitBanner }: Props) {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [modal, setModal] = useState<{ title: string; members: DashboardMember[] } | null>(null)

  const [todayHourlyData, setTodayHourlyData] = useState<InsightsResponse | null>(null)
  const [todayHourlyLoading, setTodayHourlyLoading] = useState(true)

  const [dashLoading, setDashLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [realtimeData, setRealtimeData] = useState<RealtimeResponse | null>(null)
  const [realtimeLoading, setRealtimeLoading] = useState(true)

  const fetchDash = useCallback(async (isSilent = false) => {
    if (!isSilent) setDashLoading(true)
    try {
      const res = await fetch(
        `/api/ws/${slug}/dashboard?status=all&signal=all&sortBy=name&sortDir=asc&page=1&limit=10`,
      );
      if (res.ok) {
        setData(await res.json())
        setLastUpdated(new Date())
      }
    } finally {
      if (!isSilent) setDashLoading(false)
    }
  }, [slug])

  const fetchTodayHourly = useCallback(async (isSilent = false) => {
    if (!isSilent) setTodayHourlyLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/insights?interval=today`, { cache: 'no-store' })
      if (res.ok) setTodayHourlyData(await res.json())
    } finally {
      if (!isSilent) setTodayHourlyLoading(false)
    }
  }, [slug])

  const fetchRealtime = useCallback(async (isSilent = false) => {
    if (!isSilent) setRealtimeLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/realtime`)
      if (res.ok) setRealtimeData(await res.json())
    } finally {
      if (!isSilent) setRealtimeLoading(false)
    }
  }, [slug])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchDash(),
      fetchTodayHourly(),
      fetchRealtime(),
    ])
  }, [fetchDash, fetchTodayHourly, fetchRealtime])

  useEffect(() => {
    refreshAll()
    const dashId = setInterval(() => fetchDash(true), 30000)
    const graphId = setInterval(() => fetchTodayHourly(true), 10000)
    const realtimeId = setInterval(() => fetchRealtime(true), 60000)
    return () => {
      clearInterval(dashId)
      clearInterval(graphId)
      clearInterval(realtimeId)
    }
  }, [refreshAll, fetchDash, fetchTodayHourly, fetchRealtime])

  const counts = data?.counts ?? { present: 0, visited: 0, notIn: 0, total: 0, office: 0, remote: 0, onLeave: 0 }

  const [actioningId, setActioningId] = useState<string | null>(null)
  const { show: showToast } = useToast()

  const actionLeave = useCallback(async (id: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    setActioningId(id)
    try {
      const res = await fetch(`/api/ws/${slug}/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'approve' ? { action } : { action, rejection_reason: rejectionReason }),
      })
      if (res.ok) {
        showToast(action === 'approve' ? en.wsLeaves.approveToast : en.wsLeaves.declineToast, 'success')
        await fetchDash(true)
      } else {
        showToast(en.wsLeaves.actionErrorToast, 'error')
      }
    } catch {
      showToast(en.wsLeaves.actionErrorToast, 'error')
    } finally {
      setActioningId(null)
    }
  }, [slug, fetchDash, showToast])

  const handleApproveLeave = useCallback((id: string) => {
    if (!confirm(en.wsLeaves.approveConfirm)) return
    actionLeave(id, 'approve')
  }, [actionLeave])

  const handleDeclineLeave = useCallback((id: string) => {
    const reason = window.prompt(en.wsLeaves.rejectReasonPlaceholder)
    if (!reason || !reason.trim()) return
    actionLeave(id, 'reject', reason.trim())
  }, [actionLeave])

  return (
    <div className="dash-page" style={{ padding: '24px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '20px', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.2,
          }}>
            {data?.workspace_name ?? slug}
          </h1>
          <span style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px',
            color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            Dashboard
            {lastUpdated && (
              <>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border)' }} />
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={refreshAll}
            disabled={dashLoading || todayHourlyLoading}
            style={{
              height: '40px', padding: '0 16px',
              background: 'var(--surface-0)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Activity size={14} className={dashLoading ? 'animate-spin' : ''} />
            {dashLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const now = new Date()
              const y = now.getFullYear()
              const m = String(now.getMonth() + 1).padStart(2, '0')
              const start = `${y}-${m}-01`
              const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
              const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
              const res = await fetch(`/api/ws/${slug}/export?start=${start}&end=${end}`)
              if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? 'Export failed'); return }
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `report-${slug}-${y}-${m}.csv`
              document.body.appendChild(a); a.click(); document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
            style={{
              height: '40px', padding: '0 20px',
              background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--brand) 35%, transparent)',
            }}
          >
            Export Report
          </button>
        </div>
      </div>

      {planLimitBanner}

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard
          className="dash-stat-card"
          title="Total Employees"
          value={counts.total}
          sub="Active personnel count"
          onClick={() => setModal({ title: 'Total Employees', members: data?.all_members ?? [] })}
          icon={<Users size={16} />}
          accentColor="var(--brand)"
          neutralValue
        />
        <StatCard
          className="dash-stat-card"
          title="In Office"
          value={counts.office}
          sub="currently in office"
          onClick={() => setModal({ title: 'In Office', members: (data?.all_members ?? []).filter(m => resolvePresenceTag(m.presence_status, m.latest_event?.matched_by, m.latest_event?.event_type) === 'in_office') })}
          icon={<Monitor size={16} />}
          accentColor="var(--teal)"
        />
        <StatCard
          className="dash-stat-card"
          title="Remote"
          value={counts.remote}
          sub="working remotely"
          onClick={() => setModal({ title: 'Remote', members: (data?.all_members ?? []).filter(m => resolvePresenceTag(m.presence_status, m.latest_event?.matched_by, m.latest_event?.event_type) === 'remote') })}
          icon={<Home size={16} />}
          accentColor="var(--amber)"
        />
        <StatCard
          className="dash-stat-card"
          title="On Leave"
          value={counts.onLeave}
          sub="on leave today"
          onClick={() => setModal({ title: 'On Leave', members: (data?.all_members ?? []).filter(m => m.on_leave) })}
          icon={<Calendar size={16} />}
          accentColor="#8B5CF6"
        />
      </div>

      {/* ── Graphs row ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="dash-graph-item" style={{ flex: 2, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          <OfficePresenceGraph buckets={todayHourlyData?.buckets ?? []} loading={todayHourlyLoading} />
        </div>
        <div className="dash-graph-item" style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column' }}>
          <CurrentActiveMembersCard data={realtimeData} loading={realtimeLoading} />
        </div>
      </div>

      {/* ── Pending approvals + headcount widgets row ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="dash-graph-item" style={{ flex: 1.15, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          <PendingApprovalsCard
            data={data?.pending_approvals ?? []}
            total={data?.pending_approvals_total ?? 0}
            loading={dashLoading}
            actioningId={actioningId}
            onApprove={handleApproveLeave}
            onDecline={handleDeclineLeave}
          />
        </div>
        <div className="dash-graph-item" style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column' }}>
          <DepartmentHeadcountCard data={data?.department_headcounts ?? []} loading={dashLoading} />
        </div>
      </div>

      {/* ── Celebrations widget row ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="dash-graph-item" style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column' }}>
          <CelebrationsCard data={data?.celebrations ?? []} loading={dashLoading} />
        </div>
      </div>

      {counts.total === 0 && !dashLoading && (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)' }}>No members yet.</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Invite people from the People tab to get started.
          </p>
        </div>
      )}

      {/* ── Members modal ── */}
      {modal && (
        <MembersModal
          title={modal.title}
          members={modal.members}
          slug={slug}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
