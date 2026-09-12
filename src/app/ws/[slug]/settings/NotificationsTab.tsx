'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Chip, Field, Input, Skeleton, Toggle } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
import { wsReminders } from '@/locales/en/ws-reminders'
import {
  ALL_CATEGORIES,
  CATEGORY_DEFS,
  isNotificationCategory,
  type NotificationCategory,
} from '@/lib/notifications/categories'

const t = en.wsSettings
const s = wsAdmin.settings
const r = wsReminders.settings

/**
 * What this workspace broadcasts on everybody's behalf: Approvals and
 * Announcements.
 *
 * It used to be everything this workspace sends - four category switches plus
 * the two reminder times. The nudges addressed to one person about their own
 * working day (the daily check-in reminder, and the check-in session ladder)
 * moved to `/me/settings`, where the person being nagged can stop it. What is
 * left here is the two categories the organisation sends TO its members, which
 * are the two they cannot mute. The screens now partition the catalogue rather
 * than overlapping on it - see `CATEGORY_DEFS`.
 *
 * The list is filtered on `workspaceSwitchable` rather than hardcoded, so the
 * catalogue stays the only place the split is decided.
 *
 * Gated on `Resource.Settings`, deliberately not a resource of its own: adding
 * one means rewriting every seeded grid in `system-roles.json` (invariant 12)
 * for a distinction nobody has asked for.
 */

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
 *
 * **Deliberately not rendered.** The reminder times came off this screen with
 * the reminder switch: a daily nudge is the member's to configure, and leaving
 * an admin the schedule for a notification only the member can silence was the
 * half-and-half arrangement this change removed. The component is kept rather
 * than deleted because the decision is a product one and reversing it is
 * putting the JSX back - the state, the load and the PATCH below are all still
 * wired (see the save comment). It draws an unused-symbol warning from ESLint,
 * which is the accepted cost of that.
 *
 * Moved here verbatim from `OrgTab`, inline styles included, so the diff reads
 * as a move rather than a rewrite. Those three inline style objects predate
 * invariant 15 and are the only ones left in this file - everything below was
 * written against `globals.css`. Registered in `docs/known-gaps.md`.
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

export default function NotificationsTab({ slug, canWrite }: { slug: string; canWrite: boolean }) {
  /**
   * The workspace's reminder times. No longer edited on this screen - see
   * `ReminderField` - but still loaded and still sent back on save, because
   * the PATCH below carries both fields on every save. Dropping them from
   * state would make `checkinReminderAt` default to `''`, and `''` is what an
   * emptied time input sends: the first Save a workspace pressed would null
   * out times it had set and had no way to see. Held and round-tripped
   * unchanged, so this screen can only alter the categories it shows.
   */
  const [checkinReminderAt, setCheckinReminderAt] = useState('')
  const [checkoutReminderAt, setCheckoutReminderAt] = useState('')
  /** The DISABLED set, mirroring the column. Empty means everything is on. */
  const [off, setOff] = useState<Set<NotificationCategory>>(new Set())
  /**
   * Same tri-state as Org details, for the same reason: the state above is a
   * set of defaults ("nothing off, no reminders"), not this workspace's
   * configuration. Painting the form on a failed load would let one Save wipe
   * the reminder times and switch every category back on.
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
        setCheckinReminderAt(data.checkin_reminder_at ?? '')
        setCheckoutReminderAt(data.checkout_reminder_at ?? '')
        setOff(
          new Set(
            Array.isArray(data.notification_categories_off)
              ? data.notification_categories_off.filter(isNotificationCategory)
              : [],
          ),
        )
        setLoad('ready')
      })
      .catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [slug, reloadKey])

  function setCategoryOn(key: NotificationCategory, on: boolean) {
    setOff((prev) => {
      const next = new Set(prev)
      if (on) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    // Unreachable from the UI - the form is not rendered unless the real values
    // are in hand - but stated here so it can never become reachable by accident.
    if (load !== 'ready') return
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Sent exactly as loaded. No control on this screen changes them any
          // more; they are here so the PATCH restates the workspace's own
          // values rather than omitting fields the route would read as a
          // clear. See the state declaration above.
          checkinReminderAt: checkinReminderAt || null,
          checkoutReminderAt: checkoutReminderAt || null,
          // `serialiseCategoriesOff()` drops anything not switchable, so this
          // cannot smuggle `reminders` or `presence` back into the column even
          // if a stale value arrived in the GET.
          notificationCategoriesOff: [...off],
        }),
      })
      setStatus(res.ok ? { text: t.saveSuccess, ok: true } : { text: t.saveError, ok: false })
    } finally {
      setSaving(false)
    }
  }

  // Two rows, matching the two switches that land. A skeleton promising five
  // and resolving to two is a layout jump, not a loading state.
  if (load === 'loading') {
    return (
      <Card className="fx-spring">
        <div className="stack">
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
          <p className="t-eyebrow text-danger mb-8">
            {s.notifLoadFailedTitle}
          </p>
          <p className="t-muted mb-12">{s.notifLoadFailedBody}</p>
        </div>
        <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
          {s.notifLoadFailedRetry}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="fx-spring">
      <p className="t-eyebrow mb-8">{s.notifPageTitle}</p>
      <p className="t-muted mb-12">{s.notifPageHint}</p>

      {/*
        Only what this workspace decides. The filter is the same shape as the
        one on `/me/settings`, and the opposite half of it: a category the
        workspace cannot switch is not rendered here locked, it is not rendered
        - it belongs to the member and appears on their screen instead. So
        nothing in this loop is ever disabled for being locked, only for
        `!canWrite`.
      */}
      <div className="mb-16">
        {ALL_CATEGORIES.filter((key) => CATEGORY_DEFS[key].workspaceSwitchable).map((key) => {
          const copy = s.notifCategories[key]
          return (
            <div key={key} className="switch-row">
              <div className="switch-row-body">
                <p className="switch-row-title">{copy.label}</p>
                <p className="t-muted">{copy.hint}</p>
              </div>
              <Toggle
                label={copy.label}
                checked={!off.has(key)}
                disabled={!canWrite}
                onChange={(next) => setCategoryOn(key, next)}
              />
            </div>
          )
        })}
      </div>

      {canWrite && (
        <Button onClick={save} loading={saving}>
          {t.saveButton}
        </Button>
      )}

      {status && (
        <p role="status" className={status.ok ? 'form-status is-ok' : 'form-status is-error'}>
          {status.text}
        </p>
      )}
    </Card>
  )
}
