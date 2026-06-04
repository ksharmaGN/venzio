'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { en } from '@/locales/en'

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

function PrimaryBtn({ children, onClick, loading, small, disabled }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  small?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        height: small ? '40px' : '44px',
        padding: small ? '0 14px' : '0 20px',
        background: 'var(--brand)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontSize: small ? '13px' : '14px',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontWeight: 500,
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        opacity: (loading || disabled) ? 0.7 : 1,
        flexShrink: 0,
      }}
    >
      {loading ? '…' : children}
    </button>
  )
}

function StatusLine({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <p style={{ fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: msg.ok ? 'var(--teal)' : 'var(--danger)', marginTop: '8px' }}>
      {msg.text}
    </p>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AcrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'

interface LeaveTypeRow {
  id: string
  name: string
  accrual_frequency: AcrualFrequency
  accrual_credits: number
}

interface LeaveRow {
  id: string
  user_full_name: string | null
  user_email: string
  leave_type_name: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  rejection_reason: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatRange(start: string, end: string) {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const s = new Date(sy, sm - 1, sd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  const e = new Date(ey, em - 1, ed).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return start === end ? e : `${s} – ${e}`
}

function leaveDays(start: string, end: string) {
  return Math.floor((new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) / 86400000) + 1
}

// ─── Leave Types config ───────────────────────────────────────────────────────

function LeaveTypesSection({ slug }: { slug: string }) {
  const [types, setTypes] = useState<LeaveTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<AcrualFrequency>('monthly')
  const [credits, setCredits] = useState('1')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const loadTypes = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/leave-types`)
    if (res.ok) {
      const data = await res.json()
      setTypes(data.leaveTypes ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { loadTypes() }, [loadTypes])

  async function addType() {
    const trimmed = name.trim()
    if (!trimmed) return
    setAdding(true)
    setAddStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, accrual_frequency: frequency, accrual_credits: Math.max(1, parseInt(credits, 10) || 1) }),
      })
      const data = await res.json()
      if (res.ok) {
        setTypes((prev) => [...prev, data.leaveType as LeaveTypeRow])
        setName('')
        setFrequency('monthly')
        setCredits('1')
        setAddStatus({ text: `"${(data.leaveType as LeaveTypeRow).name}" added`, ok: true })
      } else {
        setAddStatus({ text: (data as { error?: string }).error ?? 'Failed to add', ok: false })
      }
    } finally {
      setAdding(false)
    }
  }

  async function deleteType(id: string) {
    if (!confirm(en.wsLeaveTypes.deleteConfirm)) return
    const res = await fetch(`/api/ws/${slug}/leave-types/${id}`, { method: 'DELETE' })
    if (res.ok) setTypes((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
        {en.wsLeaveTypes.sectionTitle}
      </h2>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        {en.wsLeaveTypes.sectionDescription}
      </p>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>Loading…</p>
      ) : types.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', marginBottom: '14px' }}>
          {en.wsLeaveTypes.emptyNoTypes}
        </p>
      ) : (
        <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {types.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {t.name}
                </span>
                <span style={{ marginLeft: '8px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)' }}>
                  {`${t.accrual_credits} credit${t.accrual_credits !== 1 ? 's' : ''}/${
                    t.accrual_frequency === 'monthly' ? 'month'
                    : t.accrual_frequency === 'quarterly' ? 'quarter'
                    : t.accrual_frequency === 'half-yearly' ? '6 months'
                    : 'year'
                  }`}
                </span>
              </div>
              <button type="button" onClick={() => deleteType(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {en.wsLeaveTypes.removeBtn}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {en.wsLeaveTypes.labelName}
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={en.wsLeaveTypes.placeholderName}
            onKeyDown={(e) => { if (e.key === 'Enter') void addType() }} style={{ ...inputStyle, height: '40px' }} />
        </div>
        <div style={{ flex: '0 0 120px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {en.wsLeaveTypes.labelFrequency}
          </label>
          <select value={frequency} onChange={(e) => { setFrequency(e.target.value as AcrualFrequency); setCredits('1') }}
            style={{ ...inputStyle, height: '40px', cursor: 'pointer' }}>
            <option value="monthly">{en.wsLeaveTypes.optionMonthly}</option>
            <option value="quarterly">{en.wsLeaveTypes.optionQuarterly}</option>
            <option value="half-yearly">{en.wsLeaveTypes.optionHalfYearly}</option>
            <option value="yearly">{en.wsLeaveTypes.optionYearly}</option>
          </select>
        </div>
<div style={{ flex: '0 0 80px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {en.wsLeaveTypes.labelCredits}
          </label>
          <input type="number" min={1} max={365} value={credits}
            onChange={(e) => setCredits(e.target.value)}
            style={{ ...inputStyle, height: '40px' }} />
        </div>
        <PrimaryBtn small onClick={() => void addType()} loading={adding} disabled={!name.trim()}>
          {en.wsLeaveTypes.addType}
        </PrimaryBtn>
      </div>
      <StatusLine msg={addStatus} />
    </div>
  )
}

// ─── Leave requests table ─────────────────────────────────────────────────────

type Filter = 'pending' | 'active' | 'all' | 'upcoming' | 'past'

const FILTER_LABELS: Record<Filter, string> = {
  pending: en.wsLeaves.filterPending,
  active: en.wsLeaves.filterActive,
  all: en.wsLeaves.filterAll,
  upcoming: en.wsLeaves.filterUpcoming,
  past: en.wsLeaves.filterPast,
}

function statusStyle(status: string): { color: string; background: string; label: string } {
  if (status === 'approved') return { color: 'var(--teal)', background: 'rgba(0,212,170,0.12)', label: en.wsLeaves.statusApproved }
  if (status === 'rejected') return { color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', label: en.wsLeaves.statusRejected }
  return { color: 'var(--amber)', background: 'rgba(245,158,11,0.12)', label: en.wsLeaves.statusPending }
}

function LeaveRequestsSection({ slug }: { slug: string }) {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const [activeRow, setActiveRow] = useState<{ id: string; mode: 'viewing' | 'rejecting' | 'approving' | 'rejecting-submitting' } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/leaves`)
    if (res.ok) {
      const d = await res.json() as { leaveRequests: LeaveRow[] }
      setRows(d.leaveRequests ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    void load()
  }, [load])

  async function handleApprove(id: string) {
    if (!confirm(en.wsLeaves.approveConfirm)) return
    setActiveRow({ id, mode: 'approving' })
    try {
      const res = await fetch(`/api/ws/${slug}/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (res.ok) {
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'approved' } : r))
        setActiveRow(null)
      } else {
        setActiveRow({ id, mode: 'viewing' })
      }
    } catch {
      setActiveRow({ id, mode: 'viewing' })
    }
  }

  async function handleReject(id: string) {
    const trimmed = rejectReason.trim()
    if (!trimmed) return
    setActiveRow({ id, mode: 'rejecting-submitting' })
    try {
      const res = await fetch(`/api/ws/${slug}/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: trimmed }),
      })
      if (res.ok) {
        setRows((prev) => prev.map((r) =>
          r.id === id ? { ...r, status: 'rejected', rejection_reason: trimmed } : r,
        ))
        setRejectReason('')
        setActiveRow(null)
      } else {
        setActiveRow({ id, mode: 'rejecting' })
      }
    } catch {
      setActiveRow({ id, mode: 'rejecting' })
    }
  }

  const today = todayStr()
  const searchQuery = search.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (filter === 'pending') { if (r.status !== 'pending') return false }
    else if (filter === 'active') { if (r.status !== 'approved' || r.start_date > today || r.end_date < today) return false }
    else if (filter === 'upcoming') { if (r.start_date <= today || r.status === 'pending') return false }
    else if (filter === 'past') { if (r.end_date >= today || r.status === 'pending') return false }
    if (!searchQuery) return true
    return (r.user_full_name ?? '').toLowerCase().includes(searchQuery) || r.user_email.toLowerCase().includes(searchQuery)
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h2
  style={{
    fontFamily: 'Syne, sans-serif',
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--navy)',
    margin: 0,
  }}
>
  {en.wsLeaves.title}
  {!loading && (
    <span
      style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '15px',
        color: 'var(--text-muted)',
        marginLeft: '4px',
      }}
    >
      ({filtered.length})
    </span>
  )}
</h2>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'pending', 'active', 'upcoming', 'past'] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{
              height: '30px', padding: '0 12px',
              border: filter === f ? '1px solid var(--brand)' : '1px solid var(--border)',
              borderRadius: '20px',
              background: filter === f ? 'rgba(27,77,255,0.08)' : 'var(--surface-0)',
              color: filter === f ? 'var(--brand)' : 'var(--text-secondary)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}>
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={en.wsLeaves.searchPlaceholder}
        style={{ ...inputStyle, height: '36px', marginBottom: '12px', fontSize: '13px' }}
      />

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', background: 'var(--surface-0)' }}>
        <div style={{ minWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 60px 80px 140px', padding: '10px 16px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', gap: '12px' }}>
            {['Employee Name', 'Leave Type', 'Dates', 'Days', 'Status', 'Actions'].map((h) => (
              <span key={h} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {h}
              </span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: '44px', borderRadius: '6px', background: 'var(--surface-2)', animation: 'vnz-pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
              {searchQuery ? 'No results match your search.' : `No ${filter === 'all' ? '' : FILTER_LABELS[filter].toLowerCase() + ' '}leave requests yet.`}
            </p>
          ) : (
            filtered.map((r, idx) => {
              const isPast = r.end_date < today
              const days = leaveDays(r.start_date, r.end_date)
              const statusBadge = statusStyle(r.status)
              const isExpanded = activeRow?.id === r.id
              const isRejecting = activeRow?.id === r.id && (activeRow.mode === 'rejecting' || activeRow.mode === 'rejecting-submitting')
              const isActioning = activeRow?.id === r.id && (activeRow.mode === 'approving' || activeRow.mode === 'rejecting-submitting')

              return (
                <React.Fragment key={r.id}>
                  {/* Main row */}
                  <div
                    onClick={() => setActiveRow(isExpanded ? null : { id: r.id, mode: 'viewing' })}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 60px 80px 140px', padding: '12px 16px', gap: '12px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'var(--surface-1)' : 'transparent' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.user_full_name ?? r.user_email}
                      </p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.user_email}
                      </p>
                    </div>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.leave_type_name}
                    </span>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: isPast ? 'var(--text-muted)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatRange(r.start_date, r.end_date)}
                    </span>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: isPast ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {days}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', color: statusBadge.color, background: statusBadge.background }}>
                      {statusBadge.label}
                    </span>
                    {/* Actions — stop click propagation so row expand doesn't trigger */}
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => void handleApprove(r.id)}
                            style={{ height: '28px', padding: '0 10px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {isActioning && !isRejecting ? en.wsLeaves.approving : en.wsLeaves.approveBtn}
                          </button>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => { setActiveRow(isRejecting ? { id: r.id, mode: 'viewing' } : { id: r.id, mode: 'rejecting' }); setRejectReason('') }}
                            style={{ height: '28px', padding: '0 10px', background: 'none', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {en.wsLeaves.rejectBtn}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{ padding: '14px 16px 16px', background: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: isRejecting ? '14px' : 0 }}>
                        <div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Employee</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{r.user_full_name ?? '—'}</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{r.user_email}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Leave Type</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{r.leave_type_name}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Duration</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{formatRange(r.start_date, r.end_date)} · {days} day{days !== 1 ? 's' : ''}</p>
                        </div>
                        {r.reason && (
                          <div>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Reason</p>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{r.reason}</p>
                          </div>
                        )}
                        {r.status === 'rejected' && r.rejection_reason && (
                          <div>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Rejection Reason</p>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--danger)', margin: 0 }}>{r.rejection_reason}</p>
                          </div>
                        )}
                      </div>

                      {/* Inline reject form */}
                      {isRejecting && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            {en.wsLeaves.rejectReasonLabel} <span style={{ color: 'var(--danger)' }}>*</span>
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder={en.wsLeaves.rejectReasonPlaceholder}
                            rows={2}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', background: 'var(--surface-0)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              disabled={!rejectReason.trim() || isActioning}
                              onClick={() => void handleReject(r.id)}
                              style={{ height: '32px', padding: '0 14px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: (!rejectReason.trim() || isActioning) ? 'not-allowed' : 'pointer', opacity: (!rejectReason.trim() || isActioning) ? 0.6 : 1 }}
                            >
                              {isActioning ? en.wsLeaves.rejecting : en.wsLeaves.confirmRejectBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveRow(prev => prev ? { ...prev, mode: 'viewing' } : null); setRejectReason('') }}
                              style={{ height: '32px', padding: '0 14px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
                            >
                              {en.wsLeaves.cancelBtn}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Opening Leave Balances ───────────────────────────────────────────────────

interface BalanceMember {
  member_id: string
  user_id: string | null
  email: string
  full_name: string | null
}

interface BalanceEntry {
  leave_type_id: string
  leave_type_name: string
  balance_days: number | null
  effective_date: string | null
  created_at: string | null
}

function nextQuarterLabel(): string {
  const now = new Date()
  const m = now.getMonth()
  const nextQMonth = Math.floor(m / 3) * 3 + 3
  const year = nextQMonth >= 12 ? now.getFullYear() + 1 : now.getFullYear()
  const month = nextQMonth >= 12 ? 0 : nextQMonth
  return new Date(year, month, 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function LeaveBalancesSection({ slug }: { slug: string }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<BalanceMember[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [selected, setSelected] = useState<BalanceMember | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [entries, setEntries] = useState<BalanceEntry[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saveMsg, setSaveMsg] = useState<Record<string, { text: string; ok: boolean }>>({})

  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [importErrors, setImportErrors] = useState<{ row: number; email: string; leave_type: string; error: string }[]>([])

  // Search members
  useEffect(() => {
    if (!search.trim()) { setResults([]); setShowDrop(false); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/ws/${slug}/members?search=${encodeURIComponent(search)}&limit=8`).catch(() => null)
      if (res?.ok) {
        const d = await res.json() as { members?: BalanceMember[] }
        setResults(d.members ?? [])
        setShowDrop(true)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search, slug])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Load balances when member selected
  useEffect(() => {
    if (!selected) { setEntries([]); setInputs({}); return }
    setLoadingBalances(true)
    fetch(`/api/ws/${slug}/members/${selected.member_id}/leave-balances`)
      .then(r => r.json())
      .then((d: { adjustments?: BalanceEntry[] }) => {
        const adj = d.adjustments ?? []
        setEntries(adj)
        setInputs(Object.fromEntries(adj.map(e => [e.leave_type_id, e.balance_days != null ? String(e.balance_days) : ''])))
        setSaveMsg({})
      })
      .catch(() => {})
      .finally(() => setLoadingBalances(false))
  }, [selected, slug])

  function selectMember(m: BalanceMember) {
    setSelected(m)
    setSearch('')
    setShowDrop(false)
  }

  async function handleSave(leaveTypeId: string) {
    if (!selected) return
    const val = parseFloat(inputs[leaveTypeId] ?? '')
    if (isNaN(val) || val < 0) {
      setSaveMsg(p => ({ ...p, [leaveTypeId]: { text: en.wsLeaveBalances.invalidBalance, ok: false } }))
      return
    }
    setSaving(p => ({ ...p, [leaveTypeId]: true }))
    setSaveMsg(p => ({ ...p, [leaveTypeId]: { text: '', ok: true } }))
    try {
      const res = await fetch(`/api/ws/${slug}/members/${selected.member_id}/leave-balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_type_id: leaveTypeId, balance_days: val }),
      })
      const data = await res.json() as { adjustment?: { balance_days: number; effective_date: string; created_at: string } }
      if (res.ok && data.adjustment) {
        setEntries(prev => prev.map(e =>
          e.leave_type_id === leaveTypeId
            ? { ...e, balance_days: data.adjustment!.balance_days, effective_date: data.adjustment!.effective_date, created_at: data.adjustment!.created_at }
            : e,
        ))
        setSaveMsg(p => ({ ...p, [leaveTypeId]: { text: en.wsLeaveBalances.saveBtn + ' ✓', ok: true } }))
      } else {
        setSaveMsg(p => ({ ...p, [leaveTypeId]: { text: en.wsLeaveBalances.failedToSave, ok: false } }))
      }
    } catch {
      setSaveMsg(p => ({ ...p, [leaveTypeId]: { text: 'Failed to save', ok: false } }))
    } finally {
      setSaving(p => ({ ...p, [leaveTypeId]: false }))
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportMsg(null)
    setImportErrors([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/ws/${slug}/leave-balances/import`, { method: 'POST', body: fd })
      const data = await res.json() as { imported?: number; errors?: typeof importErrors }
      if (res.ok) {
        const n = data.imported ?? 0
        const errs = data.errors ?? []
        setImportMsg({ text: `${n} imported${errs.length ? `, ${errs.length} error${errs.length > 1 ? 's' : ''}` : ''}`, ok: errs.length === 0 })
        setImportErrors(errs)
        if (selected) {
          const refresh = await fetch(`/api/ws/${slug}/members/${selected.member_id}/leave-balances`)
          if (refresh.ok) {
            const rd = await refresh.json() as { adjustments?: BalanceEntry[] }
            const adj = rd.adjustments ?? []
            setEntries(adj)
            setInputs(Object.fromEntries(adj.map(a => [a.leave_type_id, a.balance_days != null ? String(a.balance_days) : ''])))
          }
        }
      } else {
        setImportMsg({ text: en.wsLeaveBalances.importFailed, ok: false })
      }
    } catch {
      setImportMsg({ text: en.wsLeaveBalances.importFailed, ok: false })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
          {en.wsLeaveBalances.sectionTitle}
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          {en.wsLeaveBalances.sectionDescription}{' '}
          <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{en.wsLeaveBalances.effectiveFrom} {nextQuarterLabel()}.</span>
        </p>
      </div>

      {/* Member search */}
      <div ref={dropRef} style={{ position: 'relative', marginBottom: '16px' }}>
        {selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selected.full_name ?? selected.email}
              </span>
              {selected.full_name && (
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>{selected.email}</span>
              )}
            </div>
            <button type="button" onClick={() => { setSelected(null); setEntries([]); setInputs({}); setSaveMsg({}) }}
              style={{ background: 'none', border: 'none', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>
              {en.wsLeaveBalances.changeMember}
            </button>
          </div>
        ) : (
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder={en.wsLeaveBalances.searchPlaceholder}
            style={{ ...inputStyle, height: '40px', fontSize: '13px' }}
          />
        )}
        {showDrop && results.length > 0 && (
          <div style={{ position: 'absolute', top: '44px', left: 0, right: 0, background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', zIndex: 50, overflow: 'hidden' }}>
            {results.map(m => (
              <button key={m.member_id} type="button" onClick={() => selectMember(m)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{m.full_name ?? m.email}</span>
                {m.full_name && <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>{m.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Balance rows */}
      {selected && (
        loadingBalances ? (
          <div style={{ height: '44px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', animation: 'vnz-pulse 1.5s ease-in-out infinite', marginBottom: '16px' }} />
        ) : entries.length === 0 ? (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {en.wsLeaveBalances.noLeaveTypes}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {entries.map(entry => (
              <div key={entry.leave_type_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: '1 1 140px', minWidth: 0 }}>
                  {entry.leave_type_name}
                </span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {en.wsLeaveBalances.currentBalance}:{' '}
                  <span style={{ color: entry.balance_days != null ? 'var(--teal)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {entry.balance_days != null ? `${entry.balance_days}d` : en.wsLeaveBalances.notSet}
                  </span>
                </span>
                <input
                  type="number" min={0} step={0.5}
                  value={inputs[entry.leave_type_id] ?? ''}
                  onChange={e => setInputs(p => ({ ...p, [entry.leave_type_id]: e.target.value }))}
                  placeholder="0"
                  style={{ width: '80px', height: '36px', padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', background: 'var(--surface-2)', color: 'var(--text-primary)', outline: 'none', flexShrink: 0 }}
                />
                <button type="button" disabled={saving[entry.leave_type_id]}
                  onClick={() => void handleSave(entry.leave_type_id)}
                  style={{ height: '36px', padding: '0 14px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: saving[entry.leave_type_id] ? 'not-allowed' : 'pointer', opacity: saving[entry.leave_type_id] ? 0.7 : 1, flexShrink: 0 }}>
                  {saving[entry.leave_type_id] ? en.wsLeaveBalances.saving : en.wsLeaveBalances.saveBtn}
                </button>
                {saveMsg[entry.leave_type_id]?.text && (
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: saveMsg[entry.leave_type_id].ok ? 'var(--teal)' : 'var(--danger)' }}>
                    {saveMsg[entry.leave_type_id].text}
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* CSV import */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', height: '36px', padding: '0 14px', background: importing ? 'var(--surface-2)' : 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: importing ? 'var(--text-muted)' : 'var(--text-primary)', cursor: importing ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
            {importing ? '…' : en.wsLeaveBalances.importCsv}
            <input type="file" accept=".csv" style={{ display: 'none' }} disabled={importing} onChange={handleImport} />
          </label>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
            {en.wsLeaveBalances.importHelp}
          </span>
        </div>
        {importMsg && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: importMsg.ok ? 'var(--teal)' : 'var(--danger)', margin: 0 }}>
            {importMsg.text}
          </p>
        )}
        {importErrors.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', padding: '6px 12px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', gap: '8px' }}>
              {['Row', 'Email', 'Leave Type', 'Error'].map(h => (
                <span key={h} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
              ))}
            </div>
            {importErrors.map((err, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', padding: '6px 12px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{err.row}</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.email}</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.leave_type}</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--danger)' }}>{err.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLeavesPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="leaves-page">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px' }}>
          Leaves
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Configure leave types and review all member leave requests.
        </p>
      </div>

      <LeaveTypesSection slug={slug} />
      <LeaveBalancesSection slug={slug} />
      <LeaveRequestsSection slug={slug} />

      <style>{`
        @keyframes vnz-pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .leaves-page{
          width:100%;
          max-width:900px;
          margin:0 auto;
          padding:20px 16px;
          box-sizing:border-box;
        }
        @media(min-width:640px){
          .leaves-page{padding:28px 32px;}
        }
      `}</style>
    </div>
  )
}
