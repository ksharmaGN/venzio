'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Chip, Field, Input, Select, Skeleton, Toggle } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
import { wsReminders } from '@/locales/en/ws-reminders'

const t = en.wsSettings
const s = wsAdmin.settings
const r = wsReminders.settings

/**
 * The timezone menu. Data, not copy - IANA zone ids are identifiers and are
 * never translated, so they stay here rather than in the locale file.
 */
const TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
]

/** Monday-first, matching the working-days chips in the mock. */
const DAYS: { num: number; label: string }[] = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 0, label: 'Sun' },
]

interface SwitchRowProps {
  title: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled: boolean
}

function SwitchRow({ title, hint, checked, onChange, disabled }: SwitchRowProps) {
  return (
    <div
      className="row-between"
      style={{
        padding: '12px 14px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-2)',
        marginBottom: '10px',
      }}
    >
      <div>
        <p style={{ fontWeight: 600, fontSize: '13.5px' }}>{title}</p>
        <p className="t-muted">{hint}</p>
      </div>
      <Toggle label={title} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

interface ReminderFieldProps {
  label: string
  hint: string
  id: string
  value: string
  onChange: (next: string) => void
  disabled: boolean
}

/**
 * One reminder time. `<input type="time">` yields '' when cleared, and ''
 * means the reminder is off - so the state below is stated explicitly rather
 * than left to be inferred from an empty box.
 */
function ReminderField({ label, hint, id, value, onChange, disabled }: ReminderFieldProps) {
  const on = value !== ''
  return (
    <Field label={label} htmlFor={id} hint={hint} style={{ flex: '1 1 200px', minWidth: '200px' }}>
      <Input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
        <Chip tone={on ? 'verified' : 'leave'}>{on ? r.onBadge(value) : r.offBadge}</Chip>
        {on && !disabled && (
          <button
            type="button"
            aria-label={r.clearAria(label)}
            onClick={() => onChange('')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              fontSize: '12px',
              color: 'var(--brand)',
              cursor: 'pointer',
            }}
          >
            {r.clearButton}
          </button>
        )}
      </div>
    </Field>
  )
}

export default function OrgTab({ slug, canWrite }: { slug: string; canWrite: boolean }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [tz, setTz] = useState('UTC')
  const [allowRemote, setAllowRemote] = useState(false)
  const [leavesEnabled, setLeavesEnabled] = useState(true)
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  // '' means the reminder is off - the same value an emptied time input sends.
  const [checkinReminderAt, setCheckinReminderAt] = useState('')
  const [checkoutReminderAt, setCheckoutReminderAt] = useState('')
  /**
   * The state above is a set of defaults, not the workspace's configuration -
   * so "still loading" and "failed to load" must be told apart from "loaded".
   * Painting the form on a failed load would let a save PATCH those defaults
   * over the real timezone, working days and reminders.
   */
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoad('loading')
    fetch(`/api/ws/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET /api/ws/${slug} responded ${res.status}`)
        const body = await res.json()
        if (!body || typeof body !== 'object') throw new Error('GET /api/ws/[slug] returned no workspace')
        return body
      })
      .then((data) => {
        if (cancelled) return
        setName(data.name ?? '')
        if (data.display_timezone) setTz(data.display_timezone)
        setAllowRemote(!!data.allow_remote)
        setLeavesEnabled(data.leaves_enabled !== false)
        if (Array.isArray(data.working_days)) setWorkingDays(data.working_days)
        setCheckinReminderAt(data.checkin_reminder_at ?? '')
        setCheckoutReminderAt(data.checkout_reminder_at ?? '')
        setLoad('ready')
      })
      .catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [slug, reloadKey])

  async function save() {
    // Unreachable from the UI - the form is not rendered unless the real values
    // are in hand - but stated here so it can never become reachable by accident.
    if (load !== 'ready') return
    if (workingDays.length === 0) {
      setStatus({ text: t.workingDaysSaveAtLeastOne, ok: false })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          displayTimezone: tz,
          allowRemote,
          leavesEnabled,
          workingDays,
          checkinReminderAt: checkinReminderAt || null,
          checkoutReminderAt: checkoutReminderAt || null,
        }),
      })
      setStatus(res.ok ? { text: t.saveSuccess, ok: true } : { text: t.saveError, ok: false })
      if (res.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // A zone stored before this list existed must still be selectable.
  const tzOptions = (TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES]).map((zone) => ({
    value: zone,
    label: zone,
  }))

  if (load === 'loading') {
    return (
      <Card className="fx-spring">
        <div className="stack">
          <Skeleton height={42} radius="var(--radius-md)" />
          <Skeleton height={42} radius="var(--radius-md)" />
          <Skeleton height={64} radius="var(--radius-md)" />
          <Skeleton height={64} radius="var(--radius-md)" />
        </div>
      </Card>
    )
  }

  if (load === 'error') {
    return (
      <Card className="fx-spring">
        <div role="alert">
          <p className="t-eyebrow" style={{ marginBottom: '8px', color: 'var(--danger)' }}>
            {s.orgLoadFailedTitle}
          </p>
          <p className="t-muted" style={{ margin: '0 0 14px' }}>{s.orgLoadFailedBody}</p>
        </div>
        <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
          {s.orgLoadFailedRetry}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="fx-spring">
      <p className="t-eyebrow" style={{ marginBottom: '12px' }}>{s.orgSectionTitle}</p>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Field
          label={t.workspaceNameLabel}
          htmlFor={s.fieldIds.name}
          style={{ flex: '1 1 200px', minWidth: '200px' }}
        >
          <Input
            id={s.fieldIds.name}
            value={name}
            disabled={!canWrite}
            placeholder={t.workspaceNamePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label={t.timezoneLabel}
          htmlFor={s.fieldIds.timezone}
          hint={t.timezoneHint}
          style={{ flex: '1 1 200px', minWidth: '200px' }}
        >
          <Select
            id={s.fieldIds.timezone}
            value={tz}
            disabled={!canWrite}
            options={tzOptions}
            onChange={(e) => setTz(e.target.value)}
          />
        </Field>
      </div>

      <span className="field-label">{t.workingDaysLabel}</span>
      <p className="t-muted" style={{ margin: '0 0 8px' }}>{t.workingDaysHint}</p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '0 0 16px' }}>
        {DAYS.map(({ num, label }) => {
          const active = workingDays.includes(num)
          return (
            <Chip
              key={label}
              tone={active ? 'verified' : 'leave'}
              {...(canWrite ? { 'aria-pressed': active } : null)}
              onClick={
                canWrite
                  ? () =>
                      setWorkingDays((prev) =>
                        active ? prev.filter((d) => d !== num) : [...prev, num].sort((a, b) => a - b),
                      )
                  : undefined
              }
            >
              {label}
            </Chip>
          )
        })}
      </div>

      <p className="t-eyebrow" style={{ margin: '4px 0 6px' }}>{r.sectionTitle}</p>
      <p className="t-muted" style={{ margin: '0 0 10px' }}>{r.sectionHint}</p>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <ReminderField
          label={r.checkinLabel}
          hint={r.checkinHint}
          id={r.fieldIds.checkin}
          value={checkinReminderAt}
          onChange={setCheckinReminderAt}
          disabled={!canWrite}
        />
        <ReminderField
          label={r.checkoutLabel}
          hint={r.checkoutHint}
          id={r.fieldIds.checkout}
          value={checkoutReminderAt}
          onChange={setCheckoutReminderAt}
          disabled={!canWrite}
        />
      </div>
      <p className="t-muted" style={{ margin: '0 0 16px' }}>{r.approximateNote}</p>

      <SwitchRow
        title={t.allowRemoteLabel}
        hint={t.allowRemoteHint}
        checked={allowRemote}
        onChange={setAllowRemote}
        disabled={!canWrite}
      />
      <SwitchRow
        title={t.leavesEnabledLabel}
        hint={t.leavesEnabledHint}
        checked={leavesEnabled}
        onChange={setLeavesEnabled}
        disabled={!canWrite}
      />

      {canWrite && (
        <Button onClick={save} loading={saving} style={{ marginTop: '6px' }}>
          {t.saveButton}
        </Button>
      )}

      {status && (
        <p
          role="status"
          style={{ marginTop: '10px', fontSize: '13px', color: status.ok ? 'var(--brand)' : 'var(--danger)' }}
        >
          {status.text}
        </p>
      )}
    </Card>
  )
}
