'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { en } from '@/locales/en'
import { inputStyle, PrimaryBtn, StatusLine } from './shared'
import type { LeaveTypeRow } from './types'

interface OpeningBalanceRow {
  id: string
  user_id: string
  leave_type_id: string
  balance_days: number
  note: string | null
  user_email: string
  user_full_name: string | null
  leave_type_name: string
  member_record_id: string
}

export function OpeningBalancesSection({ slug }: { slug: string }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [balances, setBalances] = useState<OpeningBalanceRow[]>([])
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [editState, setEditState] = useState<Record<string, { balance_days: string; note: string; saving: boolean; saved: boolean }>>({})
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([])
  const [members, setMembers] = useState<{ member_id: string; user_id: string; email: string; full_name: string | null }[]>([])
  const [cutover, setCutover] = useState<{ date: string; saving: boolean; msg: { text: string; ok: boolean } | null }>({ date: '', saving: false, msg: null })
  const [addForm, setAddForm] = useState<{ show: boolean; memberId: string; typeId: string; balance: string; note: string; saving: boolean; msg: { text: string; ok: boolean } | null }>({ show: false, memberId: '', typeId: '', balance: '', note: '', saving: false, msg: null })
  const [importState, setImportState] = useState<{ loading: boolean; msg: { text: string; ok: boolean } | null; errors: { row: number; reason: string }[] }>({ loading: false, msg: null, errors: [] })

  const loadAll = useCallback(async () => {
    setLoadingBalances(true)
    const [wsRes, balRes, typesRes] = await Promise.all([
      fetch(`/api/ws/${slug}`),
      fetch(`/api/ws/${slug}/leave-balances`),
      fetch(`/api/ws/${slug}/leave-types`),
    ])
    if (wsRes.ok) {
      const d = await wsRes.json() as { leave_cutover_date?: string | null }
      setCutover((p) => ({ ...p, date: d.leave_cutover_date ?? '' }))
    }
    if (balRes.ok) {
      const d = await balRes.json() as { balances: OpeningBalanceRow[] }
      setBalances(d.balances ?? [])
    }
    if (typesRes.ok) {
      const d = await typesRes.json() as { leaveTypes: LeaveTypeRow[] }
      setLeaveTypes(d.leaveTypes ?? [])
    }
    setLoadingBalances(false)
  }, [slug])

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/members?limit=200`)
    if (res.ok) {
      const d = await res.json() as { members: { member_id: string; user_id: string; email: string; full_name: string | null }[] }
      setMembers((d.members ?? []).filter((m) => m.user_id && m.member_id))
    }
  }, [slug])

  useEffect(() => { void loadAll() }, [loadAll])

  async function saveCutoverDate() {
    const date = cutover.date
    setCutover((p) => ({ ...p, saving: true, msg: null }))
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveCutoverDate: date || null }),
      })
      if (res.ok) {
        setCutover((p) => ({ ...p, msg: { text: date ? en.wsOpeningBalances.cutoverDateSaved : en.wsOpeningBalances.cutoverDateCleared, ok: true } }))
      } else {
        const d = await res.json() as { error?: string }
        setCutover((p) => ({ ...p, msg: { text: d.error ?? 'Failed to save', ok: false } }))
      }
    } finally {
      setCutover((p) => ({ ...p, saving: false }))
    }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportState({ loading: true, msg: null, errors: [] })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/ws/${slug}/leave-balances/import`, { method: 'POST', body: fd })
      const d = await res.json() as { imported?: number; errors?: { row: number; reason: string }[] }
      const imported = d.imported ?? 0
      const errors = d.errors ?? []
      setImportState({ loading: false, msg: { text: en.wsOpeningBalances.importSuccess(imported) + (errors.length > 0 ? ` · ${en.wsOpeningBalances.importErrors(errors.length)}` : ''), ok: errors.length === 0 }, errors })
      if (imported > 0) void loadAll()
    } finally {
      setImportState((p) => ({ ...p, loading: false }))
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function startEdit(row: OpeningBalanceRow) {
    setEditState((prev) => ({
      ...prev,
      [row.id]: { balance_days: String(row.balance_days), note: row.note ?? '', saving: false, saved: false },
    }))
  }

  async function saveRow(row: OpeningBalanceRow) {
    const state = editState[row.id]
    if (!state) return
    const days = parseFloat(state.balance_days)
    if (isNaN(days) || days < 0) return
    setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: true, saved: false } }))
    try {
      const res = await fetch(`/api/ws/${slug}/members/${row.member_record_id}/leave-balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ leave_type_id: row.leave_type_id, balance_days: days, note: state.note || null }]),
      })
      if (res.ok) {
        setBalances((prev) => prev.map((b) => b.id === row.id ? { ...b, balance_days: days, note: state.note || null } : b))
        setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: false, saved: true } }))
      } else {
        setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: false, saved: false } }))
      }
    } catch {
      setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: false, saved: false } }))
    }
  }

  // addForm.memberId stores the workspace member record id (not user_id)
  async function addBalance_submit() {
    const { memberId, typeId, balance, note } = addForm
    if (!memberId || !typeId) return
    const days = parseFloat(balance)
    if (isNaN(days) || days < 0) return
    setAddForm((p) => ({ ...p, saving: true, msg: null }))
    try {
      const res = await fetch(`/api/ws/${slug}/members/${memberId}/leave-balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ leave_type_id: typeId, balance_days: days, note: note || null }]),
      })
      if (res.ok) {
        setAddForm({ show: false, memberId: '', typeId: '', balance: '', note: '', saving: false, msg: null })
        void loadAll()
      } else {
        const d = await res.json() as { error?: string }
        setAddForm((p) => ({ ...p, msg: { text: d.error ?? 'Failed to add', ok: false } }))
      }
    } finally {
      setAddForm((p) => ({ ...p, saving: false }))
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }
  const hintStyle: React.CSSProperties = { fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }

  return (
    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px' }}>
        {en.wsOpeningBalances.sectionTitle}
      </h2>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        {en.wsOpeningBalances.sectionDescription}
      </p>

      {/* Cutover date */}
      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        <label style={labelStyle}>{en.wsOpeningBalances.cutoverDateLabel}</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={cutover.date}
            onChange={(e) => setCutover((p) => ({ ...p, date: e.target.value }))}
            style={{ ...inputStyle, height: '40px', width: '180px', flex: '0 0 180px' }}
          />
          <PrimaryBtn small onClick={() => void saveCutoverDate()} loading={cutover.saving}>
            {en.wsOpeningBalances.cutoverDateSave}
          </PrimaryBtn>
        </div>
        <p style={hintStyle}>{en.wsOpeningBalances.cutoverDateHint}</p>
        <StatusLine msg={cutover.msg} />
      </div>

      {/* CSV import */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={(e) => void handleFileImport(e)} />
        <PrimaryBtn small onClick={() => fileRef.current?.click()} loading={importState.loading}>
          {en.wsOpeningBalances.importBtn}
        </PrimaryBtn>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
          {en.wsOpeningBalances.importHint}
        </span>
      </div>
      <StatusLine msg={importState.msg} />
      {importState.errors.length > 0 && (
        <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', maxHeight: '140px', overflowY: 'auto' }}>
          {importState.errors.map((e, i) => (
            <p key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--danger)', margin: i === 0 ? 0 : '4px 0 0' }}>
              {e.row > 0 ? `Row ${e.row}: ` : ''}{e.reason}
            </p>
          ))}
        </div>
      )}

      {/* Balances table */}
      <div style={{ marginTop: '16px' }}>
        {loadingBalances ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: '40px', borderRadius: '6px', background: 'var(--surface-2)', animation: 'vnz-pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0' }}>
            {en.wsOpeningBalances.emptyNoBalances}
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', background: 'var(--surface-0)' }}>
            <div style={{ minWidth: '640px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 80px', padding: '10px 14px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', gap: '10px' }}>
                {[en.wsOpeningBalances.colEmployee, en.wsOpeningBalances.colLeaveType, en.wsOpeningBalances.colBalance, en.wsOpeningBalances.colNote, ''].map((h, i) => (
                  <span key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              {balances.map((row, idx) => {
                const editing = editState[row.id]
                return (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 80px', padding: '10px 14px', gap: '10px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.user_full_name ?? row.user_email}
                      </p>
                      {row.user_full_name && (
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.user_email}
                        </p>
                      )}
                    </div>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.leave_type_name}
                    </span>
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={editing.balance_days}
                        onChange={(e) => setEditState((prev) => ({ ...prev, [row.id]: { ...editing, balance_days: e.target.value } }))}
                        style={{ ...inputStyle, height: '34px', fontSize: '13px' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {row.balance_days}
                      </span>
                    )}
                    {editing ? (
                      <input
                        type="text"
                        value={editing.note}
                        onChange={(e) => setEditState((prev) => ({ ...prev, [row.id]: { ...editing, note: e.target.value } }))}
                        placeholder={en.wsOpeningBalances.addPlaceholderNote}
                        style={{ ...inputStyle, height: '34px', fontSize: '13px' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.note ?? '—'}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {editing ? (
                        <button
                          type="button"
                          disabled={editing.saving}
                          onClick={() => void saveRow(row)}
                          style={{ height: '28px', padding: '0 10px', background: editing.saved ? 'var(--teal)' : 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: editing.saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {editing.saving ? en.wsOpeningBalances.savingRow : editing.saved ? en.wsOpeningBalances.rowSaved : en.wsOpeningBalances.saveRow}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          style={{ height: '28px', padding: '0 10px', background: 'none', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add new balance */}
      <div style={{ marginTop: '12px' }}>
        {!addForm.show ? (
          <button
            type="button"
            onClick={() => { setAddForm((p) => ({ ...p, show: true })); void loadMembers() }}
            style={{ height: '36px', padding: '0 14px', background: 'none', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}
          >
            + {en.wsOpeningBalances.addBtn}
          </button>
        ) : (
          <div style={{ padding: '14px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>{en.wsOpeningBalances.colEmployee}</label>
                <select value={addForm.memberId} onChange={(e) => setAddForm((p) => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, height: '40px', cursor: 'pointer' }}>
                  <option value="">Select employee…</option>
                  {members.map((m) => (
                    <option key={m.member_id} value={m.member_id}>{m.full_name ?? m.email} ({m.email})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>{en.wsOpeningBalances.colLeaveType}</label>
                <select value={addForm.typeId} onChange={(e) => setAddForm((p) => ({ ...p, typeId: e.target.value }))} style={{ ...inputStyle, height: '40px', cursor: 'pointer' }}>
                  <option value="">Select leave type…</option>
                  {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 100px' }}>
                <label style={labelStyle}>Days</label>
                <input type="number" min={0} step={0.5} value={addForm.balance} onChange={(e) => setAddForm((p) => ({ ...p, balance: e.target.value }))} placeholder="0" style={{ ...inputStyle, height: '40px' }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>{en.wsOpeningBalances.colNote}</label>
                <input type="text" value={addForm.note} onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))} placeholder={en.wsOpeningBalances.addPlaceholderNote} style={{ ...inputStyle, height: '40px' }} />
              </div>
              <PrimaryBtn small onClick={() => void addBalance_submit()} loading={addForm.saving} disabled={!addForm.memberId || !addForm.typeId || !addForm.balance}>
                {en.wsOpeningBalances.saveRow}
              </PrimaryBtn>
              <button type="button" onClick={() => setAddForm((p) => ({ ...p, show: false, msg: null }))} style={{ height: '40px', padding: '0 14px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {en.wsLeaves.cancelBtn}
              </button>
            </div>
            <StatusLine msg={addForm.msg} />
          </div>
        )}
      </div>
    </div>
  )
}
