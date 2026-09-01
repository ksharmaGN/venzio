'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, EmptyState, Field, Select, TabBar,
  type ChipTone,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { EmployeePublic } from '@/lib/types/employees'
import EmployeeProfileView from '@/components/ws/employee/EmployeeProfileView'
import EmployeeFormHost from '@/components/ws/employee/EmployeeFormHost'
import EmployeeDocuments from '@/components/ws/employee/EmployeeDocuments'
import { displayValue } from '@/components/ws/employee/employee-form'
import { en } from '@/locales/en'
import { wsEmployees, wsPeopleUi } from '@/locales/en/ws-people'
import { canManage } from '@/lib/permissions/ranks'
import { personColor } from '@/lib/workspace-color'
import TransferOwnershipModal from '../../TransferOwnershipModal'

interface MemberSummary {
  member_id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: string
  status: string
}

interface ManagerOption { userId: string; name: string; email: string }
interface RoleOption { key: string; name: string; restricted: boolean }
interface OpeningBalance { id: string; user_id: string; leave_type_name: string; balance_days: number }

interface Props {
  slug: string
  /** Deep link from the approvals queue, which lands on Documents. */
  initialTab?: 'documents' | 'access'
  viewerUserId: string
  viewerRoleKey: string
  member: MemberSummary
  employee: EmployeePublic | null
  canReadEmployees: boolean
  canWriteEmployees: boolean
  canReadDocuments: boolean
  canWriteDocuments: boolean
  canReadLeaves: boolean
  canRemoveMembers: boolean
  canTransferOwnership: boolean
  assignableRoles: RoleOption[]
  roleNames: Record<string, string>
  /** Already excludes this person and their own subtree, so no option can loop. */
  managerOptions: ManagerOption[]
  currentManagerUserId: string | null
}

const STATUS_TONE: Record<string, ChipTone> = {
  active: 'verified',
  notice_period: 'none',
  on_leave: 'leave',
  suspended: 'partial',
  terminated: 'roadmap',
}

/**
 * Everything about one person, in three tabs.
 *
 * This screen exists because the directory row lost its dropdowns. Changing
 * somebody's role from a `<select>` inside a table row made a consequential
 * change feel like sorting a column, and there was nowhere to say what it
 * costs. Here the consequence gets a sentence.
 *
 * Three permissions, three tabs, resolved independently on the server:
 * Profile needs `employees:read`, Documents `documents:read`, Access is always
 * present because `members:read` is what opened the page.
 */
export default function DetailsClient({
  slug, initialTab, viewerUserId, viewerRoleKey, member, employee,
  canReadEmployees, canWriteEmployees, canReadDocuments, canWriteDocuments, canReadLeaves,
  canRemoveMembers, canTransferOwnership, assignableRoles, roleNames,
  managerOptions, currentManagerUserId,
}: Props) {
  const router = useRouter()
  const { show: toast } = useToast()

  const [record, setRecord] = useState<EmployeePublic | null>(employee)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'profile' | 'documents' | 'access'>(
    initialTab ?? (canReadEmployees ? 'profile' : 'access'),
  )
  const [balances, setBalances] = useState<OpeningBalance[] | null>(null)

  useEffect(() => {
    if (!canReadLeaves || !member.user_id) return
    const userId = member.user_id
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/ws/${slug}/leave-balances`)
      if (!res.ok || cancelled) return
      const data = await res.json() as { balances: OpeningBalance[] }
      if (!cancelled) setBalances((data.balances ?? []).filter(b => b.user_id === userId))
    })()
    return () => { cancelled = true }
  }, [slug, canReadLeaves, member.user_id])

  const name = record
    ? `${record.first_name} ${record.last_name}`.trim() || record.work_email
    : member.full_name ?? member.email

  const back = (
    <Link href={`/ws/${slug}/people`} className="btn btn-ghost btn-sm pressable link-plain btn-flush">
      <ArrowLeft size={14} aria-hidden />
      {wsPeopleUi.detailsBack}
    </Link>
  )

  // The wizard takes over the whole screen: it is a five-step form, and
  // shrinking it into a tab panel beside a header is how a form gets filled in
  // wrong.
  if (editing) {
    return (
      <div>
        {back}
        <EmployeeFormHost
          slug={slug}
          employee={record}
          member={{ userId: member.user_id, email: member.email, fullName: member.full_name }}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => { setRecord(saved); setEditing(false); router.refresh() }}
        />
      </div>
    )
  }

  const tabs = [
    ...(canReadEmployees ? [{ key: 'profile', label: wsPeopleUi.tabProfile }] : []),
    ...(canReadDocuments && record ? [{ key: 'documents', label: wsPeopleUi.tabDocuments }] : []),
    { key: 'access', label: wsPeopleUi.tabAccess },
  ]

  return (
    <div>
      {back}

      <Card className="person-header">
        <Avatar name={name} size={64} color={personColor(member.user_id ?? member.email)} />
        <div className="person-header-main">
          <div className="person-header-titles">
            <h1 className="t-h1 person-header-name">{name}</h1>
            <Chip tone={member.role === 'owner' ? 'owner' : 'leave'}>
              {roleNames[member.role] ?? member.role}
            </Chip>
          </div>
          <p className="t-secondary person-header-sub">
            {record
              ? [record.employment.designation, record.employment.department].filter(Boolean).join(' · ') || wsEmployees.noValue
              : wsEmployees.noValue}
          </p>
          <p className="t-muted person-header-meta">
            {[member.email, record?.employee_id].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="person-header-side">
          {member.status === 'pending_consent' ? (
            <Chip tone="partial">{wsPeopleUi.statusInvited}</Chip>
          ) : member.status === 'declined' ? (
            <Chip tone="none">{wsPeopleUi.statusDeclined}</Chip>
          ) : record ? (
            <Chip tone={STATUS_TONE[record.employee_status] ?? 'leave'}>
              {displayValue('employee_status', record.employee_status)}
            </Chip>
          ) : (
            <Chip tone="verified">{en.wsPeople.statusActive}</Chip>
          )}
          {canWriteEmployees && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={13} />}
              onClick={() => setEditing(true)}
            >
              {record ? wsEmployees.editButton : wsPeopleUi.createRecordButton}
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-16">
        <TabBar
          tabs={tabs}
          active={tab}
          onChange={(k) => setTab(k as 'profile' | 'documents' | 'access')}
        />
      </div>

      {tab === 'profile' && (
        record
          ? <EmployeeProfileView employee={record} balances={canReadLeaves ? (balances ?? []) : null} />
          : (
            <Card className="mt-16">
              <EmptyState title={wsPeopleUi.noRecordTitle} hint={wsPeopleUi.noRecordHint} />
            </Card>
          )
      )}

      {tab === 'documents' && record && (
        <EmployeeDocuments slug={slug} employeeId={record.id} canWrite={canWriteDocuments} />
      )}

      {tab === 'access' && (
        <AccessPanel
          slug={slug}
          member={member}
          viewerUserId={viewerUserId}
          viewerRoleKey={viewerRoleKey}
          canWriteEmployees={canWriteEmployees}
          canRemoveMembers={canRemoveMembers}
          canTransferOwnership={canTransferOwnership}
          assignableRoles={assignableRoles}
          roleNames={roleNames}
          managerOptions={managerOptions}
          currentManagerUserId={currentManagerUserId}
          onChanged={() => router.refresh()}
          onRemoved={() => router.push(`/ws/${slug}/people`)}
          toast={toast}
        />
      )}
    </div>
  )
}

// ─── Access ───────────────────────────────────────────────────────────────────

/**
 * Role, reporting line and removal.
 *
 * Three writes, three endpoints, three permissions - deliberately not one
 * "save" button. They land in different tables (`workspace_members.role`,
 * `workspace_members.manager_user_id`, and a DELETE), and each one already has
 * its own server-side guard. A single form would have to invent a combined
 * success state for three things that can fail independently.
 */
function AccessPanel({
  slug, member, viewerUserId, viewerRoleKey, canWriteEmployees, canRemoveMembers,
  canTransferOwnership, assignableRoles, roleNames, managerOptions, currentManagerUserId,
  onChanged, onRemoved, toast,
}: {
  slug: string
  member: MemberSummary
  viewerUserId: string
  viewerRoleKey: string
  canWriteEmployees: boolean
  canRemoveMembers: boolean
  canTransferOwnership: boolean
  assignableRoles: RoleOption[]
  roleNames: Record<string, string>
  managerOptions: ManagerOption[]
  currentManagerUserId: string | null
  onChanged: () => void
  onRemoved: () => void
  toast: (message: string, tone?: 'success' | 'error') => void
}) {
  const [managerUserId, setManagerUserId] = useState(currentManagerUserId ?? '')
  const [savingManager, setSavingManager] = useState(false)
  const [roleDraft, setRoleDraft] = useState(member.role)
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)

  const isSelf = !!member.user_id && member.user_id === viewerUserId
  const canReassignRole =
    assignableRoles.length > 0 &&
    member.status === 'active' &&
    !isSelf &&
    member.role !== 'owner'

  async function saveRole(next: string) {
    // Ownership is a TRANSFER, not an assignment: it swaps two rows and demotes
    // the person doing it, so it goes through the OTP flow. PATCH .../role
    // rejects 'owner' outright, so this is the only path.
    if (next === 'owner') {
      if (canTransferOwnership) setTransferOpen(true)
      setRoleDraft(member.role)
      return
    }
    setSavingRole(true)
    setRoleError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/members/${member.member_id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(en.wsPeople.roleConfirmButton, 'success')
        onChanged()
      } else {
        setRoleDraft(member.role)
        setRoleError(data.error ?? en.wsPeople.roleChangeFailed)
      }
    } finally {
      setSavingRole(false)
    }
  }

  async function saveManager(next: string) {
    setSavingManager(true)
    try {
      const res = await fetch(`/api/ws/${slug}/hierarchy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, managerUserId: next || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(wsPeopleUi.accessManagerSaved, 'success')
        onChanged()
      } else {
        setManagerUserId(currentManagerUserId ?? '')
        toast(data.error ?? wsPeopleUi.accessManagerFailed, 'error')
      }
    } finally {
      setSavingManager(false)
    }
  }

  async function remove() {
    if (!confirm(en.wsPeople.removeConfirm)) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/ws/${slug}/members/${member.member_id}`, { method: 'DELETE' })
      if (res.ok) onRemoved()
      else toast(wsPeopleUi.accessRemoveFailed, 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className="mt-16 access-section">
      {transferOpen && (
        <TransferOwnershipModal
          slug={slug}
          target={member}
          onDone={() => setTransferOpen(false)}
          onCancel={() => setTransferOpen(false)}
        />
      )}

      <p className="t-h2">{wsPeopleUi.accessTitle}</p>
      <p className="t-secondary page-subtitle">{wsPeopleUi.accessHint}</p>

      <Field label={wsPeopleUi.accessRoleLabel} error={roleError ?? undefined}>
        <Select
          value={roleDraft}
          disabled={!canReassignRole || savingRole}
          onChange={(e) => {
            const next = e.target.value
            if (next === roleDraft) return
            setRoleDraft(next)
            void saveRole(next)
          }}
          aria-label={en.wsPeople.roleSelectAria}
          options={
            canReassignRole
              ? assignableRoles.map(r => ({
                  value: r.key,
                  // A native <option> cannot host an SVG, so the padlock on the
                  // restricted entry is a text glyph.
                  label: r.restricted ? en.wsPeople.restrictedRoleOption(r.name) : r.name,
                }))
              : [{ value: member.role, label: roleNames[member.role] ?? member.role }]
          }
        />
      </Field>

      {/* Reporting line. Hidden entirely for an invitation that has not been
          accepted: setManager filters on an active membership with a user id,
          so offering the control would only ever produce NOT_A_MEMBER. */}
      {canWriteEmployees && (
        <Field
          label={wsPeopleUi.accessManagerLabel}
          hint={member.user_id ? wsPeopleUi.accessManagerHint : wsPeopleUi.accessManagerPendingHint}
        >
          <Select
            value={managerUserId}
            disabled={!member.user_id || savingManager}
            onChange={(e) => {
              const next = e.target.value
              setManagerUserId(next)
              void saveManager(next)
            }}
            options={[
              { value: '', label: wsPeopleUi.accessManagerNone },
              ...managerOptions.map(m => ({
                value: m.userId,
                label: m.name === m.email ? m.email : `${m.name} — ${m.email}`,
              })),
            ]}
          />
        </Field>
      )}

      {/* Two independent conditions, both required: does this viewer hold
          members:delete at all, and does rank let them act on THIS person?
          DELETE re-checks both. */}
      {canRemoveMembers && canManage(viewerRoleKey, member.role) && !isSelf && (
        <>
          <p className="t-eyebrow mt-16">{wsPeopleUi.accessRemoveTitle}</p>
          <p className="t-muted field-note">{wsPeopleUi.accessRemoveHint}</p>
          <Button variant="danger" size="sm" className="mt-12" loading={removing} onClick={() => void remove()}>
            {wsPeopleUi.accessRemoveButton}
          </Button>
        </>
      )}
    </Card>
  )
}
