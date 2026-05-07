'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Calendar, LayoutList, CalendarDays,
  ChevronDown, SlidersHorizontal, MoreHorizontal, Plus,
  Pencil, Trash2, Check, Upload,
} from 'lucide-react'

interface Holiday {
  id: string
  name: string
  date: string
  description: string | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function formatDateRange(year: number) {
  return `01-Jan-${year} - 31-Dec-${year}`
}

function formatDate(iso: string): { full: string; day: string } {
  const [y, m, d] = iso.split('-')
  const day = DAYS[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()]
  return { full: `${d}-${MONTHS[parseInt(m) - 1]}-${y}`, day }
}

// ─── Shared ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '13px',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  background: 'var(--surface-2)',
  color: 'var(--navy)',
  outline: 'none',
  boxSizing: 'border-box',
}

// ─── Add / Edit Form ──────────────────────────────────────────────────────────

function HolidayForm({ slug, initial, onSave, onCancel }: {
  slug: string
  initial?: Holiday
  onSave: (h: Holiday) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim() || !date) { setError('Name and date are required'); return }
    setSaving(true); setError(null)
    try {
      const url = initial
        ? `/api/ws/${slug}/holidays/${initial.id}`
        : `/api/ws/${slug}/holidays`
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), date, description: description.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      onSave(data.holiday)
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '10px',
    }}>
      <p style={{
        fontSize: '13px', fontWeight: 600,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        color: 'var(--navy)', margin: '0 0 10px',
      }}>
        {initial ? 'Edit holiday' : 'Add holiday'}
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Holiday name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ ...inputStyle, flex: '2 1 150px', minWidth: 0 }}
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 130px', minWidth: 0 }}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ ...inputStyle, flex: '2 1 180px', minWidth: 0 }}
        />
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--danger)', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 8px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            height: '32px', padding: '0 14px',
            background: 'var(--brand)', color: '#fff',
            border: 'none', borderRadius: '6px',
            fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          <Check size={13} />
          {initial ? 'Save' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: '32px', padding: '0 12px',
            background: 'transparent', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: '6px',
            fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ holiday, onConfirm, onCancel }: {
  holiday: Holiday
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '28px',
        maxWidth: '400px',
        width: '100%',
      }}>
        <h2 style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '18px', fontWeight: 700,
          color: 'var(--navy)', margin: '0 0 8px',
        }}>
          Delete holiday
        </h2>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '14px', color: 'var(--text-secondary)',
          lineHeight: 1.6, margin: '0 0 24px',
        }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--navy)' }}>{holiday.name}</strong>?
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              height: '40px', padding: '0 28px',
              background: 'var(--danger)', color: '#fff',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: '40px', padding: '0 20px',
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── More Menu ────────────────────────────────────────────────────────────────

function MoreMenu({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          height: '32px', width: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)',
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '36px', right: 0, zIndex: 50,
          background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '4px', minWidth: '140px',
        }}>
          <button
            type="button"
            onClick={() => { onAdd(); setOpen(false) }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            style={{
              width: '100%', height: '34px', padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'transparent', border: 'none', borderRadius: '5px',
              fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
              color: 'var(--navy)', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <Plus size={13} />
            Add holiday
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HolidaysPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string)

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchHolidays() {
      setLoading(true)
      const res = await fetch(`/api/ws/${slug}/holidays?year=${year}`)
      if (cancelled) return
      if (res.ok) {
        const data = await res.json()
        setHolidays(data.holidays ?? [])
      }
      setLoading(false)
    }
    fetchHolidays()
    return () => { cancelled = true }
  }, [slug, year, refreshKey])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/ws/${slug}/holidays`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setImportMsg({ text: data.error ?? 'Import failed', ok: false })
        return
      }
      setImportMsg({ text: `Imported: ${data.inserted} added, ${data.updated} updated`, ok: true })
      setRefreshKey(k => k + 1)
    } finally {
      setImporting(false)
    }
  }

  async function deleteHoliday(id: string) {
    const res = await fetch(`/api/ws/${slug}/holidays/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHolidays(prev => prev.filter(h => h.id !== id))
      setConfirmDeleteId(null)
    }
  }

  function onSaved(holiday: Holiday) {
    setHolidays(prev => {
      const idx = prev.findIndex(h => h.id === holiday.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = holiday
        return next.sort((a, b) => a.date.localeCompare(b.date))
      }
      return [...prev, holiday].sort((a, b) => a.date.localeCompare(b.date))
    })
    setShowAdd(false)
    setEditingId(null)
  }

  const iconBtn = (active?: boolean): React.CSSProperties => ({
    height: '32px', width: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'color-mix(in srgb, var(--brand) 10%, transparent)' : 'transparent',
    border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
    borderRadius: '6px', cursor: 'pointer',
    color: active ? 'var(--brand)' : 'var(--text-secondary)',
  })

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    color: 'var(--navy)',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
  }

  const COLS = [
    { label: 'Name', w: 'auto' },
    { label: 'Date', w: '180px' },
    { label: 'Description', w: 'auto' },
    { label: '', w: '76px' },
  ]

  const deleteTarget = confirmDeleteId
    ? holidays.find(h => h.id === confirmDeleteId) ?? null
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', padding: '0 28px' }}>
      {deleteTarget && (
        <DeleteModal
          holiday={deleteTarget}
          onConfirm={() => deleteHoliday(deleteTarget.id)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      <div style={{ padding: '20px 0 12px' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          margin: 0,
        }}>
          Holidays Calendar
        </h1>
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-0)', gap: '12px', flexWrap: 'wrap',
      }}>
        {/* Left: year nav + date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" onClick={() => setYear(y => y - 1)} style={iconBtn()}>
            <ChevronLeft size={15} />
          </button>
          <span style={{
            height: '32px', width: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)', borderRadius: '6px',
            color: 'var(--text-secondary)',
          }}>
            <Calendar size={15} />
          </span>
          <button type="button" onClick={() => setYear(y => y + 1)} style={iconBtn()}>
            <ChevronRight size={15} />
          </button>
          <span style={{
            marginLeft: '8px', fontSize: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 500, color: 'var(--navy)',
          }}>
            {formatDateRange(year)}
          </span>
        </div>

        {/* Right: import + more */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            style={{
              height: '32px', padding: '0 12px',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
              color: 'var(--navy)', opacity: importing ? 0.6 : 1,
            }}
          >
            <Upload size={13} />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <MoreMenu onAdd={() => { setShowAdd(true); setEditingId(null) }} />
        </div>
      </div>

      {/* ── Import status ── */}
      {importMsg && (
        <div style={{
          margin: '10px 0 0',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
          color: importMsg.ok ? 'var(--teal)' : 'var(--danger)',
          background: importMsg.ok
            ? 'color-mix(in srgb, var(--teal) 10%, transparent)'
            : 'color-mix(in srgb, var(--danger) 10%, transparent)',
          border: `1px solid ${importMsg.ok ? 'color-mix(in srgb, var(--teal) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{importMsg.text}</span>
          <button
            type="button"
            onClick={() => setImportMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 12px', fontSize: '16px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Add form ── */}
      {showAdd && (
        <div style={{ padding: '12px 0 0' }}>
          <HolidayForm slug={slug} onSave={onSaved} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#95c7ad'}}>
              {COLS.map(({ label, w }, i) => (
                <th key={i} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontWeight: 600, color: 'var(--text-secondary)',
                  verticalAlign: 'middle',
                  borderBottom: '1px solid var(--border)',
                  borderRight: i < COLS.length - 1 ? '1px solid var(--border)' : undefined,
                  whiteSpace: 'nowrap', width: w,
                  position: 'sticky', top: 0, zIndex: 1,
                  background: '#95c7ad',
                }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              [1,2,3,4,5].map(i => (
                <tr key={i}>
                  {[140, 130, 200, 60].map((w, j, arr) => (
                    <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', borderRight: j < arr.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <div style={{ height: '14px', background: 'var(--surface-2)', borderRadius: '4px', width: `${w}px` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '56px 16px', textAlign: 'center' }}>
                  <Calendar size={28} color="var(--border)" style={{ display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                    No holidays for {year}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    style={{ fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Add the first holiday
                  </button>
                </td>
              </tr>
            ) : (
              holidays.map(h => {
                if (editingId === h.id) {
                  return (
                    <tr key={h.id}>
                      <td colSpan={4} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <HolidayForm slug={slug} initial={h} onSave={onSaved} onCancel={() => setEditingId(null)} />
                      </td>
                    </tr>
                  )
                }

                const { full, day } = formatDate(h.date)
                return (
                  <tr key={h.id} style={{ background: 'var(--surface-0)' }}>
                    {/* Name */}
                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                      {h.name}
                    </td>

                    {/* Date */}
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {full},&nbsp;
                      <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{day}</span>
                    </td>

                    {/* Description */}
                    <td style={tdStyle}>
                      {h.description ? (
                        <span style={{
                          fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                          color: 'var(--text-secondary)',
                        }}>
                          {h.description}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--border)' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', borderRight: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => { setEditingId(h.id); setShowAdd(false) }}
                          title="Edit"
                          style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(h.id)}
                          title="Delete"
                          style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--danger)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer count ── */}
      {!loading && holidays.length > 0 && (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)', background: 'var(--surface-1)' }}>
          <p style={{ fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-muted)', margin: 0 }}>
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {year}
          </p>
        </div>
      )}
    </div>
  )
}
