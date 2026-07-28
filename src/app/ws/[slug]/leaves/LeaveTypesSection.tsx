'use client'

import { useState, useEffect, useCallback } from 'react'
import { en } from '@/locales/en'
import { inputStyle, PrimaryBtn, StatusLine } from './shared'
import type { AcrualFrequency, LeaveTypeRow } from './types'

export function LeaveTypesSection({ slug }: { slug: string }) {
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
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
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
                Remove
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
