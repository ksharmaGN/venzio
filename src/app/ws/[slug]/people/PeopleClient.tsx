'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Lock, Search, Trash2 } from 'lucide-react'
import type { ApprovalItem } from '@/lib/approvals'
import { ApprovalRow } from '@/components/ws/ApprovalRow'
import {
  Avatar, Button, Card, Chip, DataTable, EmptyState, Field, IconButton, Input, Modal,
  Select, SkeletonText,
  type ChipTone, type Column,
} from '@/components/ui'
import { en } from '@/locales/en'
import { wsPeopleUi } from '@/locales/en/ws-people'
import { canManage } from '@/lib/permissions/ranks'

interface Member {
  member_id: string
  email: string
  full_name: string | null
  role: string
  status: string
  added_at: string
  user_id: string | null
  employee_record_id: string | null
  employee_id: string | null
  designation: string | null
  department: string | null
  work_mode: string | null
  date_of_joining: string | null
  probation_end_date: string | null
}

interface RoleOption {
  key: string
  name: string
  description: string | null
  /**
   * Not a plain role assignment. Today only `owner`, which routes into the
   * OTP-gated transfer flow rather than PATCH .../role. Rendered greyed with a
   * padlock so it reads as special before it is picked.
   */
  restricted?: boolean
}

/**
 * What the VIEWER may do, resolved server-side from their role grid and
 * returned by GET /api/ws/[slug]/members. Deny-by-default until it loads, so
 * an owner-only action never flashes for an admin on first paint.
 */
interface ViewerPermissions {
  transferOwnership: boolean
  removeMembers: boolean
}

const AVATAR_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4']
function avatarColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const WM_LABEL: Record<string, string> = {
  office: en.wsPeople.workModeOffice,
  remote: en.wsPeople.workModeRemote,
  hybrid: en.wsPeople.workModeHybrid,
}

function empStatus(doj: string | null, probEnd: string | null): { label: string; tone: ChipTone } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (doj && new Date(doj) > today) return { label: en.wsPeople.statusOnboarding, tone: 'override' }
  if (probEnd && new Date(probEnd) >= today) return { label: en.wsPeople.statusProbation, tone: 'partial' }
  return { label: en.wsPeople.statusActive, tone: 'verified' }
}

function formatDateOfJoining(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  slug: string
  /** The signed-in user, so their own row never offers a role dropdown. */
  viewerUserId: string
}

// ─── Transfer Ownership Modal ─────────────────────────────────────────────────

interface TransferModalProps {
  slug: string
  target: Member
  onDone: () => void
  onCancel: () => void
}

function TransferOwnershipModal({ slug, target, onDone, onCancel }: TransferModalProps) {
  const [step, setStep] = useState<'confirm' | 'otp'>('confirm')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Factor 1: the account password. The server re-checks it and only then
  // issues the code, so a hijacked session with inbox access is not enough.
  async function requestOtp() {
    if (!password) {
      setError(en.wsTransferOwnership.errorPasswordRequired)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', targetMemberId: target.member_id, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setAdminEmail(data.email)
        // Don't keep it in state while the OTP step is open.
        setPassword('')
        setStep('otp')
      } else {
        setError(data.error || en.wsTransferOwnership.errorRequestFailed)
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirmTransfer() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', targetMemberId: target.member_id, code: code.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(en.wsTransferOwnership.successMsg(data.new_admin))
        setTimeout(() => {
          onDone()
          // Not /ws: the outgoing owner is now a plain member, so they no longer
          // match getAdminWorkspacesForUser and would land on an empty picker
          // with no explanation. /me is the surface they still have.
          window.location.href = '/me'
        }, 2000)
      } else {
        setError(data.error || en.wsTransferOwnership.errorTransferFailed)
      }
    } finally {
      setLoading(false)
    }
  }

  const footer = success ? null : step === 'confirm' ? (
    <>
      <Button variant="secondary" onClick={onCancel}>{en.wsTransferOwnership.cancelBtn}</Button>
      <Button variant="danger" loading={loading} disabled={!password} onClick={requestOtp}>
        {loading ? en.wsTransferOwnership.continuingBtn : en.wsTransferOwnership.continueBtn}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onCancel}>{en.wsTransferOwnership.cancelBtn}</Button>
      <Button variant="danger" loading={loading} disabled={code.length < 6} onClick={confirmTransfer}>
        {loading ? en.wsTransferOwnership.transferringBtn : en.wsTransferOwnership.confirmBtn}
      </Button>
    </>
  )

  return (
    <Modal open onClose={onCancel} title={en.wsTransferOwnership.title} maxWidth={440} footer={footer}>
      {success ? (
        <p style={{ fontSize: '14px', color: 'var(--teal)', lineHeight: 1.5 }}>{success}</p>
      ) : step === 'confirm' ? (
        <>
          <p className="t-secondary" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
            {en.wsTransferOwnership.confirmBodyPrefix}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{target.full_name ?? target.email}</strong>.
          </p>

          {/* Destructive warning - stays on screen while they type the
              password, so the consequence is visible at the moment they
              authorise it rather than on a screen they already clicked past. */}
          <div
            style={{
              border: '1px solid var(--danger)',
              background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
              {en.wsTransferOwnership.warningTitle}
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px' }} className="stack-sm">
              {[
                en.wsTransferOwnership.warningTheyGain,
                en.wsTransferOwnership.warningYouLose,
                en.wsTransferOwnership.warningNoUndo,
              ].map((line) => (
                <li key={line} className="t-secondary" style={{ lineHeight: 1.5 }}>{line}</li>
              ))}
            </ul>
          </div>

          <Field label={en.wsTransferOwnership.passwordLabel} htmlFor="transfer-password" error={error ?? undefined}>
            <Input
              id="transfer-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={en.wsTransferOwnership.passwordPlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
              autoComplete="current-password"
              invalid={!!error}
              autoFocus
            />
          </Field>
        </>
      ) : (
        <>
          <p className="t-secondary" style={{ marginBottom: '20px', lineHeight: 1.5 }}>
            {en.wsTransferOwnership.otpBodyPrefix}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong>{' '}
            {en.wsTransferOwnership.otpBodySuffix}
          </p>
          <Field label={en.wsTransferOwnership.title} htmlFor="transfer-otp" error={error ?? undefined}>
            <Input
              id="transfer-otp"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={en.wsTransferOwnership.otpPlaceholder}
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && confirmTransfer()}
              invalid={!!error}
              style={{ letterSpacing: '0.15em', fontSize: '18px', textAlign: 'center' }}
              autoFocus
            />
          </Field>
        </>
      )}
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PeopleClient({ slug, viewerUserId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagination, setPagination] = useState<{ nextOffset: number | null; total: number } | null>(null)
  const paginationNextRef = useRef<number | null>(null)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState<Member | null>(null)

  // Role assignment. `assignableRoles` is server-filtered to roles the viewer
  // is allowed to grant, so the dropdown can never offer something the API
  // would reject - the API re-checks regardless.
  const [roleOptions, setRoleOptions] = useState<{ assignableRoles: RoleOption[]; roleNames: Record<string, string> }>({ assignableRoles: [], roleNames: {} })
  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions>({ transferOwnership: false, removeMembers: false })
  const [viewerRoleKey, setViewerRoleKey] = useState<string>('member')
  const [roleModal, setRoleModal] = useState<{ member: Member; roleKey: string; saving: boolean; error: string | null } | null>(null)

  const loadMembers = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append
      if (append) setLoadingMore(true)
      else setLoading(true)

      if (!append) paginationNextRef.current = null
      const nextOffset = append ? (paginationNextRef.current ?? 0) : 0
      const res = await fetch(
        `/api/ws/${slug}/members?limit=10&offset=${nextOffset}&search=${encodeURIComponent(search)}`,
      )
      if (res.ok) {
        const data = await res.json()
        const nextMembers = (data.members ?? []) as Member[]
        const nextCursor = data.pagination?.nextOffset ?? null
        paginationNextRef.current = nextCursor
        setMembers((prev) => (append ? [...prev, ...nextMembers] : nextMembers))
        setPagination((prev) => ({
          nextOffset: nextCursor,
          total: data.total ?? prev?.total ?? 0,
        }))
        setRoleOptions({
          assignableRoles: (data.assignableRoles ?? []) as RoleOption[],
          roleNames: (data.roleNames ?? {}) as Record<string, string>,
        })
        setViewerPermissions({
          transferOwnership: data.permissions?.transferOwnership === true,
          removeMembers: data.permissions?.removeMembers === true,
        })
        setViewerRoleKey(data.viewerRole?.key ?? 'member')
      }
      if (append) setLoadingMore(false)
      else setLoading(false)
    },
    [slug, search],
  )

  useEffect(() => {
    setMembers([])
    setPagination(null)
    paginationNextRef.current = null
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, search])

  function applySearch() {
    const next = searchDraft.trim()
    if (next !== search) setSearch(next)
  }

  async function invite() {
    const e = email.trim().toLowerCase()
    if (!e) return
    setInviting(true)
    setInviteStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmail('')
        setInviteStatus({ text: en.wsPeople.inviteSuccess(e), ok: true })
        await loadMembers()
      } else {
        setInviteStatus({ text: data.error || en.wsPeople.inviteError, ok: false })
      }
    } finally {
      setInviting(false)
    }
  }

  async function remove(memberId: string) {
    if (!confirm(en.wsPeople.removeConfirm)) return
    setRemovingId(memberId)
    const res = await fetch(`/api/ws/${slug}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.member_id !== memberId))
    }
    setRemovingId(null)
  }

  async function saveRole() {
    if (!roleModal) return
    setRoleModal((prev) => (prev ? { ...prev, saving: true, error: null } : prev))
    const res = await fetch(`/api/ws/${slug}/members/${roleModal.member.member_id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleModal.roleKey }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const key = roleModal.roleKey
      setMembers((prev) =>
        prev.map((m) => (m.member_id === roleModal.member.member_id ? { ...m, role: key } : m)),
      )
      setRoleModal(null)
    } else {
      setRoleModal((prev) => (prev ? { ...prev, saving: false, error: data.error ?? en.wsPeople.roleChangeFailed } : prev))
    }
  }

  const canViewMore = pagination?.nextOffset != null

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<Member>[] = [
    {
      key: 'employee',
      header: en.wsPeople.colEmployee,
      render: (m) => {
        const name = m.full_name ?? m.email
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar name={name} color={avatarColor(m.user_id ?? m.email)} />
            <div style={{ minWidth: 0 }}>
              {m.user_id ? (
                <Link
                  href={`/ws/${slug}/members/${m.user_id}`}
                  style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}
                >
                  {name}
                </Link>
              ) : (
                <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{name}</span>
              )}
              <p className="t-muted" style={{ fontSize: '11px', overflowWrap: 'anywhere' }}>
                {m.employee_id ?? m.email}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'designation',
      header: en.wsPeople.colDesignation,
      render: m => <span className="t-secondary">{m.designation ?? '—'}</span>,
    },
    {
      key: 'department',
      header: en.wsPeople.colDepartment,
      render: m => <span className="t-secondary">{m.department ?? '—'}</span>,
    },
    {
      key: 'work_mode',
      header: en.wsPeople.colWorkMode,
      render: m => <span className="t-secondary">{m.work_mode ? (WM_LABEL[m.work_mode] ?? m.work_mode) : '—'}</span>,
    },
    {
      key: 'joined',
      header: en.wsPeople.colJoined,
      render: m => <span className="t-secondary">{formatDateOfJoining(m.date_of_joining)}</span>,
    },
    {
      key: 'role',
      header: en.wsPeople.roleColumn,
      // A dropdown when this viewer may reassign this person, otherwise a
      // plain locked label.
      render: (m) => {
        const isSelf = !!m.user_id && m.user_id === viewerUserId
        const canReassign =
          roleOptions.assignableRoles.length > 0 &&
          m.status === 'active' &&
          !isSelf &&
          m.role !== 'owner' &&
          roleOptions.assignableRoles.some((r) => r.key === m.role)
        const label = roleOptions.roleNames[m.role] ?? m.role

        if (!canReassign) {
          return (
            <Chip tone={m.role === 'owner' ? 'owner' : 'leave'}>
              {label}
              {m.role === 'owner' && <Lock size={11} aria-hidden />}
            </Chip>
          )
        }

        return (
          <Select
            value={m.role}
            onChange={(e) => {
              const next = e.target.value
              if (next === m.role) return
              // Ownership is a TRANSFER, not an assignment: it swaps two rows
              // and demotes the person doing it, so it goes through the OTP
              // flow instead of the role-change modal. PATCH .../role rejects
              // 'owner' outright, so this is the only path. The select is
              // controlled by m.role, so it snaps back on the re-render if the
              // modal is cancelled.
              if (next === 'owner') {
                if (viewerPermissions.transferOwnership) setTransferTarget(m)
                return
              }
              setRoleModal({ member: m, roleKey: next, saving: false, error: null })
            }}
            aria-label={en.wsPeople.roleSelectAria}
            style={{ height: '36px', minWidth: '116px', fontSize: '12.5px' }}
            options={roleOptions.assignableRoles.map((r) => ({
              value: r.key,
              // A native <option> cannot host an SVG, so the padlock is a text
              // glyph on the restricted entry.
              label: r.restricted ? en.wsPeople.restrictedRoleOption(r.name) : r.name,
            }))}
          />
        )
      },
    },
    {
      key: 'status',
      header: en.wsPeople.colStatus,
      render: (m) => {
        const st = m.employee_record_id
          ? empStatus(m.date_of_joining, m.probation_end_date)
          : m.status === 'pending_consent'
            ? { label: en.wsPeople.statusInviteSent, tone: 'partial' as ChipTone }
            : m.status === 'declined'
              ? { label: en.wsPeople.statusDeclined, tone: 'none' as ChipTone }
              : { label: en.wsPeople.statusActive, tone: 'verified' as ChipTone }
        return <Chip tone={st.tone}>{st.label}</Chip>
      },
    },
    {
      key: 'actions',
      header: wsPeopleUi.actionsLabel,
      align: 'right',
      render: (m) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          {m.user_id && m.status === 'active' && (
            <Link
              href={`/ws/${slug}/people/${m.user_id}/details`}
              className="btn btn-ghost btn-sm pressable"
              style={{ textDecoration: 'none' }}
            >
              {m.employee_record_id ? en.wsPeople.editLink : en.wsPeople.setUpLink}
            </Link>
          )}
          {/* Two independent conditions, both required: does this viewer hold
              members:delete at all, and does rank let them act on THIS person?
              Testing the target's role alone showed the button to roles that
              cannot use it, and hid it from roles that can. DELETE re-checks
              both. */}
          {viewerPermissions.removeMembers &&
            canManage(viewerRoleKey, m.role) &&
            m.user_id !== viewerUserId && (
              <IconButton
                variant="plain"
                label={en.wsPeople.removeTitle}
                icon={<Trash2 size={14} />}
                disabled={removingId === m.member_id}
                onClick={() => remove(m.member_id)}
                style={{ color: 'var(--danger)' }}
              />
            )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {transferTarget && (
        <TransferOwnershipModal
          slug={slug}
          target={transferTarget}
          onDone={() => setTransferTarget(null)}
          onCancel={() => setTransferTarget(null)}
        />
      )}

      {roleModal && (() => {
        const name = roleModal.member.full_name ?? roleModal.member.email
        const roleName = roleOptions.roleNames[roleModal.roleKey] ?? roleModal.roleKey
        return (
          <Modal
            open
            onClose={() => setRoleModal(null)}
            title={en.wsPeople.roleModalTitle(name)}
            maxWidth={440}
            footer={
              <>
                <Button variant="secondary" onClick={() => setRoleModal(null)}>
                  {en.wsPeople.roleCancelButton}
                </Button>
                <Button loading={roleModal.saving} onClick={saveRole}>
                  {roleModal.saving ? en.wsPeople.roleSavingButton : en.wsPeople.roleConfirmButton}
                </Button>
              </>
            }
          >
            <p className="t-secondary" style={{ marginBottom: '12px' }}>
              {en.wsPeople.roleModalTo(roleName)}
            </p>

            {/* Name the consequence, not the mechanism. */}
            <div
              style={{
                border: '1px solid var(--border)', background: 'var(--surface-1)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px',
                fontSize: '13px', lineHeight: 1.55,
              }}
            >
              {roleModal.roleKey === 'admin' ? (
                <>
                  <div style={{ color: 'var(--teal)', marginBottom: '6px' }}>+ {en.wsPeople.roleAdminGains}</div>
                  <div style={{ color: 'var(--danger)' }}>− {en.wsPeople.roleAdminLimits}</div>
                </>
              ) : (
                <div style={{ color: 'var(--danger)' }}>− {en.wsPeople.roleMemberEffect}</div>
              )}
            </div>

            <p className="t-muted">{en.wsPeople.roleAppliesImmediately}</p>

            {roleModal.error && (
              <p className="field-error" role="alert" style={{ marginTop: '12px' }}>{roleModal.error}</p>
            )}
          </Modal>
        )
      })()}

      {/* Invite */}
      <Card>
        <p className="t-h2">{en.wsPeople.inviteSectionTitle}</p>
        <p className="t-secondary" style={{ margin: '6px 0 12px' }}>{en.wsPeople.inviteHelperText}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={en.wsPeople.invitePlaceholder}
            aria-label={en.wsPeople.inviteSectionTitle}
            onKeyDown={(e) => e.key === 'Enter' && invite()}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <Button loading={inviting} onClick={invite}>
            {inviting ? en.wsPeople.inviteSubmitting : en.wsPeople.inviteSubmit}
          </Button>
        </div>
        {inviteStatus && (
          <p style={{ marginTop: '8px', fontSize: '13px', color: inviteStatus.ok ? 'var(--teal)' : 'var(--danger)' }}>
            {inviteStatus.text}
          </p>
        )}
      </Card>

      {/* Members */}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div className="row-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <p className="t-h2">{en.wsPeople.peopleCount(pagination?.total ?? members.length)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Input
              type="search"
              placeholder={en.wsPeople.searchPlaceholder}
              aria-label={en.wsPeople.searchPlaceholder}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              style={{ minWidth: '220px' }}
            />
            <IconButton
              variant="plain"
              label={en.wsPeople.searchButtonTitle}
              icon={<Search size={16} />}
              onClick={applySearch}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '18px 20px' }}><SkeletonText lines={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={members}
            rowKey={m => m.member_id}
            minWidth={1040}
            empty={<EmptyState title={en.wsPeople.emptyTitle} hint={en.wsPeople.emptyBody} />}
          />
        )}
      </Card>

      {canViewMore && (
        <Button
          variant="secondary"
          block
          loading={loadingMore}
          onClick={() => loadMembers({ append: true })}
          style={{ marginTop: '12px' }}
        >
          {loadingMore ? en.wsPeople.loadingMore : en.wsPeople.viewMore}
        </Button>
      )}

      <RegularizationRequestsSection slug={slug} />
    </div>
  )
}

// ─── Regularization requests (pending queue, echoed from the Approvals page) ──

function RegularizationRequestsSection({ slug }: { slug: string }) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals?type=regularization`)
      if (res.ok) {
        const data = await res.json()
        setItems((data.items ?? []) as ApprovalItem[])
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  async function action(id: string, act: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/regularization/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, rejection_reason: rejectionReason }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
        setDecliningId(null)
      }
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && items.length === 0) return null

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <div className="row-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <p className="t-h2">{en.wsPeople.regularizationSectionTitle}</p>
        {!!items.length && <Chip tone="partial">{items.length}</Chip>}
      </div>
      {loading ? (
        <div style={{ padding: '16px 20px' }}><SkeletonText lines={2} /></div>
      ) : (
        items.map((item) => (
          <ApprovalRow
            key={item.id}
            item={item}
            busy={busyId === item.id}
            declining={decliningId === item.id}
            onApprove={() => action(item.id, 'approve')}
            onDeclineStart={() => setDecliningId(item.id)}
            onDeclineCancel={() => setDecliningId(null)}
            onDeclineConfirm={(reason) => action(item.id, 'reject', reason)}
          />
        ))
      )}
    </Card>
  )
}
