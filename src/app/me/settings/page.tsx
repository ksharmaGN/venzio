'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button, Card, Divider, Field, Input } from '@/components/ui'
import { en } from '@/locales/en'
import { meSettings } from '@/locales/en/me-settings'

const t = meSettings.settings

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="t-h2" style={{ color: 'var(--navy)', margin: '0 0 14px' }}>{title}</h2>
      {children}
    </Card>
  )
}

type Status = { text: string; ok: boolean } | null

function StatusMsg({ msg }: { msg: Status }) {
  if (!msg) return null
  return (
    <p
      role="status"
      className={msg.ok ? 'field-hint' : 'field-error'}
      style={{ color: msg.ok ? 'var(--teal)' : undefined }}
    >
      {msg.text}
    </p>
  )
}

/** Read-only "label above value" pair, used where a field isn't being edited. */
function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <p className="t-secondary" style={{ margin: 0 }}>{value}</p>
    </div>
  )
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection({ initialName, email }: { initialName: string; email: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)

  useEffect(() => {
    setName(initialName)
    setSavedName(initialName)
  }, [initialName])

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function handleSave() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { setSavedName(name); setIsEditing(false); setStatus({ text: t.profile.saved, ok: true }) }
      else { setStatus({ text: data.error ?? t.profile.saveError, ok: false }) }
    } finally { setLoading(false) }
  }

  function handleCancel() { setName(savedName); setIsEditing(false); setStatus(null) }

  return (
    <SectionCard title={t.profile.title}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <ReadonlyValue label={t.profile.emailLabel} value={email} />

          {isEditing ? (
            <Field label={t.profile.nameLabel} htmlFor="profile-name">
              <Input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
          ) : (
            <ReadonlyValue label={t.profile.nameLabel} value={savedName || t.profile.nameEmpty} />
          )}
        </div>

        {!isEditing && (
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            {t.profile.edit}
          </Button>
        )}
      </div>

      {isEditing && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <Button loading={loading} onClick={handleSave}>{t.profile.save}</Button>
          <Button variant="secondary" onClick={handleCancel}>{t.profile.cancel}</Button>
        </div>
      )}

      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── Email change section ──────────────────────────────────────────────────────

function EmailSection() {
  const [step, setStep] = useState<'idle' | 'otp'>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function requestOtp() {
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setStep('otp')
        setStatus({ text: t.email.codeSent(newEmail), ok: true })
      } else {
        setStatus({ text: data.error || t.email.sendError, ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirmChange() {
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, code }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ text: t.email.updated, ok: true })
        setTimeout(() => { window.location.href = '/login' }, 1500)
      } else {
        setStatus({ text: data.error || t.email.verifyError, ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title={t.email.title}>
      <div className="stack">
        <Field label={t.email.newLabel} htmlFor="new-email">
          <Input
            id="new-email"
            type="email"
            value={newEmail}
            placeholder={t.email.newPlaceholder}
            onChange={(e) => { setNewEmail(e.target.value); setStep('idle'); setStatus(null) }}
          />
        </Field>

        {step === 'idle' && (
          <div>
            <Button loading={loading} onClick={requestOtp}>{t.email.sendCode}</Button>
          </div>
        )}

        {step === 'otp' && (
          <>
            <Field label={t.email.codeLabel} htmlFor="email-otp">
              <Input
                id="email-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                placeholder={t.email.codePlaceholder}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button loading={loading} onClick={confirmChange}>{t.email.confirm}</Button>
              <Button
                variant="secondary"
                onClick={() => { setStep('idle'); setCode(''); setStatus(null) }}
              >
                {t.email.resend}
              </Button>
            </div>
          </>
        )}
      </div>

      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [isEditing, setIsEditing] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  function handleCancel() { setCurrent(''); setNext(''); setConfirm(''); setIsEditing(false); setStatus(null) }

  async function handleSave() {
    if (next.length < 8) { setStatus({ text: t.password.tooShort, ok: false }); return }
    if (next !== confirm) { setStatus({ text: t.password.mismatch, ok: false }); return }
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { handleCancel(); setStatus({ text: t.password.updated, ok: true }) }
      else { setStatus({ text: data.error ?? t.password.saveError, ok: false }) }
    } finally { setLoading(false) }
  }

  return (
    <SectionCard title={t.password.title}>
      {!isEditing && (
        <div className="row-between">
          <p className="t-secondary" style={{ margin: 0 }}>{t.password.masked}</p>
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            {t.password.edit}
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="stack">
          <Field label={t.password.currentLabel} htmlFor="pw-current">
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label={t.password.newLabel} htmlFor="pw-new">
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label={t.password.confirmLabel} htmlFor="pw-confirm">
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button loading={loading} onClick={handleSave}>{t.password.save}</Button>
            <Button variant="secondary" onClick={handleCancel}>{t.password.cancel}</Button>
          </div>
        </div>
      )}

      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── API Tokens section ───────────────────────────────────────────────────────

interface ApiToken {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

function TokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => {})
  }, [])

  async function create() {
    if (!newName.trim()) return
    setCreating(true)
    setStatus(null)
    setNewToken(null)
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setTokens((prev) => [data.token, ...prev])
        setNewToken(data.plain_token)
        setNewName('')
      } else {
        setStatus({ text: data.error || t.tokens.createError, ok: false })
      }
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm(t.tokens.revokeConfirm)) return
    const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    if (res.ok) setTokens((prev) => prev.filter((token) => token.id !== id))
  }

  return (
    <SectionCard title={t.tokens.title}>
      <p className="t-secondary" style={{ margin: '0 0 14px' }}>{t.tokens.intro}</p>

      {/* The plaintext token, shown exactly once. */}
      {newToken && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--teal) 10%, transparent)',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <p className="t-muted" style={{ color: 'var(--teal)', margin: '0 0 6px' }}>
            {t.tokens.revealWarning}
          </p>
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
            }}
          >
            {newToken}
          </code>
        </div>
      )}

      <Field label={t.tokens.nameLabel} htmlFor="token-name">
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input
            id="token-name"
            type="text"
            value={newName}
            placeholder={t.tokens.namePlaceholder}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          />
          <Button loading={creating} disabled={!newName.trim()} onClick={create}>
            {t.tokens.create}
          </Button>
        </div>
      </Field>

      <StatusMsg msg={status} />

      {tokens.length === 0 ? (
        <p className="t-muted" style={{ margin: '14px 0 0' }}>{t.tokens.empty}</p>
      ) : (
        <>
          <Divider />
          <div className="stack-sm">
            {tokens.map((token) => (
              <div key={token.id} className="row-between">
                <div style={{ minWidth: 0 }}>
                  <p className="t-secondary" style={{ margin: 0, fontWeight: 600 }}>{token.name}</p>
                  <p
                    className="t-muted"
                    style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    {t.tokens.created(new Date(token.created_at).toLocaleDateString())}
                    {token.last_used_at &&
                      ` · ${t.tokens.lastUsed(new Date(token.last_used_at).toLocaleDateString())}`}
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => revoke(token.id)}>
                  {t.tokens.revoke}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ─── Organisation features section ────────────────────────────────────────────

function OrgSection() {
  const [activeWs, setActiveWs] = useState<{ id: string; slug: string; name: string }[] | null>(null)

  useEffect(() => {
    fetch('/api/workspace')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setActiveWs(d.active ?? []) })
      .catch(() => setActiveWs([]))
  }, [])

  // Still loading - render nothing to avoid flash
  if (activeWs === null) return null

  // Has active workspace - don't show "Switch" prompt
  if (activeWs.length > 0) return null

  return (
    <SectionCard title={t.org.title}>
      <p className="t-secondary" style={{ margin: '0 0 14px' }}>{t.org.body}</p>
      <Link href="/ws" className="btn btn-primary pressable" style={{ textDecoration: 'none' }}>
        {t.org.cta}
      </Link>
    </SectionCard>
  )
}

// ─── Logout section ───────────────────────────────────────────────────────────

function LogoutSection() {
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <SectionCard title={t.session.title}>
      <p className="t-secondary" style={{ margin: '0 0 14px' }}>{en.auth.sessionLogoutText}</p>
      <Button variant="secondary" loading={loading} onClick={logout}>
        {t.session.signOut}
      </Button>
    </SectionCard>
  )
}

// ─── Danger zone (collapsed accordion) ────────────────────────────────────────

function DeactivateCard() {
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [blockedBy, setBlockedBy] = useState<{ slug: string; name: string }[] | null>(null)

  async function deactivateAccount() {
    setLoading(true)
    setBlockedBy(null)
    try {
      const res = await fetch('/api/me', { method: 'DELETE' })
      if (res.ok) {
        window.location.href = '/login'
      } else if (res.status === 409) {
        // Sole admin of at least one active workspace - the server lists them.
        const data = await res.json()
        setBlockedBy(data.workspaces ?? [])
        setConfirming(false)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--danger) 4%, transparent)',
      }}
    >
      <p className="t-h2" style={{ margin: '0 0 4px', fontSize: '13.5px' }}>
        {t.danger.deactivateTitle}
      </p>
      <p className="t-secondary" style={{ margin: '0 0 12px' }}>{t.danger.deactivateBody}</p>

      {/* Sole-admin blocker */}
      {blockedBy && blockedBy.length > 0 && (
        <div
          role="alert"
          style={{
            background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginBottom: '12px',
          }}
        >
          <p className="t-secondary" style={{ margin: '0 0 4px', fontWeight: 700 }}>
            {t.danger.blockedTitle(blockedBy.length)}
          </p>
          <p className="t-secondary" style={{ margin: '0 0 8px' }}>{t.danger.blockedBody}</p>

          <div className="stack-sm">
            {blockedBy.map((ws) => (
              <div key={ws.slug} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={`/ws/${ws.slug}/people`} className="t-muted" style={{ color: 'var(--brand)' }}>
                  {t.danger.blockedPromote(ws.name)}
                </a>
                <span className="t-muted">{t.danger.blockedOr}</span>
                <a href={`/ws/${ws.slug}/settings`} className="t-muted">
                  {t.danger.blockedArchive}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!confirming ? (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {t.danger.deactivateCta}
        </Button>
      ) : (
        <div className="stack-sm">
          <p className="field-error" style={{ margin: 0 }}>{t.danger.confirmPrompt}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="sm"
              loading={loading}
              onClick={deactivateAccount}
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {loading ? t.danger.confirmBusy : t.danger.confirmYes}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              {t.danger.confirmNo}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DangerSection() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {/* Accordion trigger - intentionally quiet */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t.danger.collapse : t.danger.expand}
        className="pressable"
        style={{
          width: '100%',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{t.danger.title}</span>
        <span
          aria-hidden
          style={{
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 160ms var(--ease-out)',
            display: 'inline-block',
            lineHeight: 1,
            color: 'var(--text-muted)',
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            padding: '14px',
            background: 'var(--surface-0)',
          }}
        >
          <DeactivateCard />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setProfileName(d.user?.full_name ?? '')
        setProfileEmail(d.user?.email ?? '')
      })
      .catch(() => {})
  }, [])

  return (
    <div className="stack">
      <h1 className="t-h1" style={{ color: 'var(--navy)', margin: 0 }}>{t.title}</h1>

      <div>
        <ProfileSection initialName={profileName} email={profileEmail} />
        <EmailSection />
        <PasswordSection />
        <TokensSection />
        <OrgSection />
        <LogoutSection />
      </div>

      <DangerSection />
    </div>
  )
}
