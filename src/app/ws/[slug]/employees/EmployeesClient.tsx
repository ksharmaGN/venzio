'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Pencil, Plus, UserPlus } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, DataTable, EmptyState, Input, Select, SkeletonText,
  type ChipTone, type Column,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsEmployees } from '@/locales/en/ws-people'
import { EmployeeStatus } from '@/lib/constants/employees'
import type { EmployeePublic } from '@/lib/types/employees'
import type { DirectoryPerson } from '@/lib/db/queries/employees-list'
import EmployeeDocuments from './EmployeeDocuments'
import EmployeeWizard from './EmployeeWizard'
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STEPS, EMPTY_EMPLOYEE_FORM, FIELD_LABELS,
  buildEmployeeBody, displayValue, formFromEmployee, maskIfSensitive, serverFieldErrors,
  type EmployeeFormData, type FieldErrors,
} from './employee-form'

// ─── Presentation helpers ─────────────────────────────────────────────────────

const STATUS_TONE: Record<string, ChipTone> = {
  [EmployeeStatus.Active]: 'verified',
  [EmployeeStatus.NoticePeriod]: 'none',
  [EmployeeStatus.OnLeave]: 'leave',
  [EmployeeStatus.Suspended]: 'partial',
  [EmployeeStatus.Terminated]: 'roadmap',
}

const ROLE_TONE: Record<string, ChipTone> = { owner: 'owner', admin: 'verified' }

const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function fullName(e: EmployeePublic) {
  return `${e.first_name} ${e.last_name}`.trim() || e.work_email
}

/**
 * The name to put on a directory row.
 *
 * HR wins when there is a record, because that is the name payroll and the
 * documents are filed under. Membership is the fallback, and the email is the
 * last resort - a member who signed up without ever setting a display name is
 * still a person who has to appear in the list.
 */
function personName(p: DirectoryPerson): string {
  if (p.employee) return fullName(p.employee)
  return p.full_name?.trim() || p.email
}

function personEmail(p: DirectoryPerson): string {
  return p.employee?.work_email ?? p.email
}

/** Muted em-dash-equivalent for a column that has no record behind it. */
function NoRecord() {
  return <span className="t-muted" style={{ fontSize: '12px' }}>{wsEmployees.noValue}</span>
}

function fmtDate(value: string | null): string {
  if (!value) return wsEmployees.noValue
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberRow { user_id: string | null; role: string }

type View =
  | { mode: 'list' }
  | { mode: 'detail'; id: string }
  /** A standalone record, not tied to any account. */
  | { mode: 'wizard'; kind: 'add' }
  /** The first HR record for someone who is already a member. */
  | { mode: 'wizard'; kind: 'member'; person: DirectoryPerson }
  | { mode: 'wizard'; kind: 'edit'; employee: EmployeePublic }

interface Props {
  slug: string
  canWrite: boolean
  /** documents:write - gates the document upload/verify controls. */
  canWriteDocuments: boolean
  canReadDocuments: boolean
  /** members:read - without it the org-role column has no source. */
  canReadMembers: boolean
  /** leaves:read - without it the balance card has no source. */
  canReadLeaves: boolean
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EmployeesClient({
  slug, canWrite, canWriteDocuments, canReadDocuments, canReadMembers, canReadLeaves,
}: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()

  // Deep link from the approvals queue: `Review ›` on a pending document links
  // to `/ws/{slug}/employees?employee={employees.id}` (the FK the document row
  // carries, which is exactly what the detail fetch takes). Read as a lazy
  // useState initialiser rather than in an effect, so the detail view is the
  // first thing rendered - no list flash, and no set-state-in-effect. Only the
  // initial mount consults it, so `Back` returns to the directory and stays
  // there even though the param is still in the URL.
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>(() => {
    const id = searchParams.get('employee')
    return id ? { mode: 'detail', id } : { mode: 'list' }
  })

  const [rows, setRows] = useState<DirectoryPerson[]>([])
  const [total, setTotal] = useState(0)
  const [withRecord, setWithRecord] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')

  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({})

  // ── Directory ──────────────────────────────────────────────────────────────

  // Search runs on the SERVER now. It used to filter the array already in
  // memory, which was survivable while the directory was a handful of HR
  // records; a directory of every member is longer than one page, so a
  // client-side filter would simply fail to find anyone on page two.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const fetchPage = useCallback(async (offset: number) => {
    const qs = new URLSearchParams({ limit: '25', offset: String(offset) })
    if (debouncedSearch) qs.set('search', debouncedSearch)
    if (department) qs.set('department', department)
    if (status) qs.set('status', status)
    const res = await fetch(`/api/ws/${slug}/employees?${qs.toString()}`)
    if (!res.ok) return null
    return res.json() as Promise<{
      people: DirectoryPerson[]
      total: number
      withRecord: number
      pagination: { nextOffset: number | null }
    }>
  }, [slug, debouncedSearch, department, status])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPage(0)
      if (!data) { toast(wsEmployees.loadFailed, 'error'); return }
      setRows(data.people)
      setTotal(data.total)
      setWithRecord(data.withRecord)
      setNextOffset(data.pagination.nextOffset)
    } finally {
      setLoading(false)
    }
  }, [fetchPage, toast])

  useEffect(() => { void load() }, [load])

  // The org-role badge is membership data, not employee data, so it comes from
  // a second endpoint and is simply absent for a role that cannot read members.
  useEffect(() => {
    if (!canReadMembers) return
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/ws/${slug}/members?limit=200`)
      if (!res.ok || cancelled) return
      const data = await res.json() as { members: MemberRow[] }
      const map: Record<string, string> = {}
      for (const m of data.members ?? []) if (m.user_id) map[m.user_id] = m.role
      if (!cancelled) setRoleByUser(map)
    })()
    return () => { cancelled = true }
  }, [slug, canReadMembers])

  async function loadMore() {
    if (nextOffset == null) return
    setLoadingMore(true)
    try {
      const data = await fetchPage(nextOffset)
      if (!data) return
      setRows(prev => [...prev, ...data.people])
      setTotal(data.total)
      setWithRecord(data.withRecord)
      setNextOffset(data.pagination.nextOffset)
    } finally {
      setLoadingMore(false)
    }
  }

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const p of rows) if (p.employee?.employment.department) set.add(p.employee.employment.department)
    return [...set].sort()
  }, [rows])

  // Both of these read a column only an HR record carries, so switching one on
  // necessarily hides everyone without a record. The note below the filter bar
  // says so, rather than letting the list silently shrink.
  const recordOnlyFilterOn = department !== '' || status !== ''

  // ── Detail / wizard ────────────────────────────────────────────────────────

  // Only the id is handed over: the list response omits the encrypted columns
  // (PAN, Aadhaar, bank account), and only GET /employees/[id] decrypts them,
  // so the detail view fetches the full record itself rather than being
  // handed a row that is missing half of what it shows.
  function openEmployee(id: string) {
    setView({ mode: 'detail', id })
  }

  /**
   * A row without a record has nothing to open, so clicking it starts the one
   * thing that would give it something to open - but only for a role that may
   * write. Read-only roles get an inert row rather than a dead end.
   */
  function openPerson(p: DirectoryPerson) {
    if (p.employee) { openEmployee(p.employee.id); return }
    if (canWrite) setView({ mode: 'wizard', kind: 'member', person: p })
  }

  if (view.mode === 'wizard') {
    return (
      <WizardHost
        slug={slug}
        kind={view.kind}
        employee={view.kind === 'edit' ? view.employee : null}
        person={view.kind === 'member' ? view.person : null}
        onCancel={() => setView({ mode: 'list' })}
        onSaved={async (id) => { await load(); setView({ mode: 'detail', id }) }}
      />
    )
  }

  if (view.mode === 'detail') {
    return (
      <EmployeeDetail
        slug={slug}
        employeeId={view.id}
        canWrite={canWrite}
        canWriteDocuments={canWriteDocuments}
        canReadDocuments={canReadDocuments}
        canReadLeaves={canReadLeaves}
        roleByUser={roleByUser}
        onBack={() => setView({ mode: 'list' })}
        onEdit={(employee) => setView({ mode: 'wizard', kind: 'edit', employee })}
      />
    )
  }

  const columns: Column<DirectoryPerson>[] = [
    {
      key: 'employee',
      header: wsEmployees.colEmployee,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar name={personName(p)} color={avatarColor(p.user_id)} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: '13px' }}>{personName(p)}</p>
            <p className="t-muted" style={{ fontSize: '10.5px', overflowWrap: 'anywhere' }}>{personEmail(p)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      header: wsEmployees.colJobTitle,
      // The one column that names the state out loud. Everything else is a
      // plain em-dash: a member without HR details is normal, not an error, so
      // it is a muted secondary label and never a warning colour.
      render: p => p.employee
        ? <span className="t-secondary">{p.employee.employment.designation ?? wsEmployees.noValue}</span>
        : <span className="t-muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>{wsEmployees.noRecordLabel}</span>,
    },
    {
      key: 'role',
      header: wsEmployees.colRole,
      // Membership data, so it is simply absent for a role the server did not
      // hand it to - see the `showRole` gate in the GET handler.
      render: p => p.role
        ? <Chip tone={ROLE_TONE[p.role] ?? 'leave'}>{p.role}</Chip>
        : <NoRecord />,
    },
    {
      key: 'department',
      header: wsEmployees.colDepartment,
      render: p => p.employee
        ? <span className="t-secondary">{p.employee.employment.department ?? wsEmployees.noValue}</span>
        : <NoRecord />,
    },
    {
      key: 'employment_type',
      header: wsEmployees.colType,
      render: (p) => {
        const type = p.employee?.employment.employment_type
        if (!p.employee) return <NoRecord />
        return (
          <span className="t-secondary">
            {type ? displayValue('employment_type', type) : wsEmployees.noValue}
          </span>
        )
      },
    },
    {
      key: 'joined',
      header: wsEmployees.colJoined,
      render: p => p.employee
        ? <span className="t-muted">{fmtDate(p.employee.employment.date_of_joining)}</span>
        : <NoRecord />,
    },
    {
      key: 'status',
      header: wsEmployees.colStatus,
      render: (p) => {
        if (!p.employee) {
          return canWrite ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<UserPlus size={13} />}
              aria-label={wsEmployees.addDetailsFor(personName(p))}
              onClick={(ev) => { ev.stopPropagation(); setView({ mode: 'wizard', kind: 'member', person: p }) }}
            >
              {wsEmployees.addDetails}
            </Button>
          ) : <NoRecord />
        }
        return (
          <Chip tone={STATUS_TONE[p.employee.employee_status] ?? 'leave'}>
            {EMPLOYEE_STATUS_LABELS[p.employee.employee_status] ?? p.employee.employee_status}
          </Chip>
        )
      },
    },
  ]

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1">{wsEmployees.title}</h1>
          <p className="t-secondary" style={{ marginTop: '4px' }}>
            {wsEmployees.subtitle(total, withRecord)}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setView({ mode: 'wizard', kind: 'add' })}>
            {wsEmployees.addButton}
          </Button>
        )}
      </div>

      <Card padded={false} style={{ marginTop: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <Input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={wsEmployees.searchPlaceholder}
            aria-label={wsEmployees.searchPlaceholder}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <Select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            aria-label={wsEmployees.departmentLabel}
            style={{ width: '180px' }}
            options={[
              { value: '', label: wsEmployees.departmentAll },
              ...departments.map(d => ({ value: d, label: d })),
            ]}
          />
          <Select
            value={status}
            onChange={e => setStatus(e.target.value)}
            aria-label={wsEmployees.statusLabel}
            style={{ width: '170px' }}
            options={[
              { value: '', label: wsEmployees.statusAll },
              ...Object.values(EmployeeStatus).map(s => ({ value: s, label: EMPLOYEE_STATUS_LABELS[s] })),
            ]}
          />
        </div>

        {recordOnlyFilterOn && (
          <p
            className="t-muted"
            style={{ fontSize: '11.5px', padding: '10px 18px', borderBottom: '1px solid var(--border)' }}
          >
            {wsEmployees.recordOnlyFilterNote}
          </p>
        )}

        {loading ? (
          <div style={{ padding: '18px 20px' }}><SkeletonText lines={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={p => p.member_id}
            minWidth={900}
            onRowClick={openPerson}
            empty={
              debouncedSearch || recordOnlyFilterOn
                ? <EmptyState title={wsEmployees.emptyTitle} hint={wsEmployees.emptyHint} />
                : <EmptyState title={wsEmployees.emptyDirectoryTitle} hint={wsEmployees.emptyDirectoryHint} />
            }
          />
        )}
      </Card>

      {nextOffset != null && (
        <Button
          variant="secondary"
          block
          loading={loadingMore}
          onClick={() => void loadMore()}
          style={{ marginTop: '12px' }}
        >
          {loadingMore ? wsEmployees.loadingMore : wsEmployees.loadMore}
        </Button>
      )}
    </div>
  )
}

// ─── Wizard host ──────────────────────────────────────────────────────────────

/**
 * Fields the member-scoped POST is known to ignore.
 *
 * `POST /members/[memberId]/employee` builds its insert from a fixed shortlist
 * of columns, so the bank, statutory and emergency answers the wizard collects
 * would be dropped on the floor. Rather than opening a second creation path -
 * which is what put a member and an employee out of step in the first place -
 * the create is followed by a PATCH to the SAME endpoint carrying only what
 * the insert could not take.
 */
const MEMBER_POST_HONOURS: ReadonlySet<string> = new Set([
  'first_name', 'last_name', 'work_email', 'designation', 'department',
  'employment_type', 'date_of_joining', 'work_location', 'work_mode',
  'employee_id', 'phone',
])

/**
 * Owns the request half of the wizard: which verb, which URL, and what to do
 * with a 422. The wizard itself stays a pure form.
 *
 * Three shapes, one form:
 *  - `edit`   PATCH /employees/:id       - an existing record
 *  - `member` POST  /members/:userId/employee - the first record for a member,
 *             which is the only route that links `employees.user_id`
 *  - `add`    POST  /employees           - a record with no account behind it
 */
function WizardHost({
  slug, kind, employee, person, onCancel, onSaved,
}: {
  slug: string
  kind: 'add' | 'edit' | 'member'
  employee: EmployeePublic | null
  person: DirectoryPerson | null
  onCancel: () => void
  onSaved: (id: string) => void | Promise<void>
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})

  // Seed a new member record from what membership already knows, so an admin
  // is not retyping a name and an email the invite already carried. A
  // single-word display name lands entirely in `first_name` and leaves the
  // surname blank for a human to supply - `employees.last_name` is NOT NULL,
  // and inventing one next to somebody's PAN is not ours to do.
  const nameParts = (person?.full_name ?? '').trim().split(/\s+/).filter(Boolean)
  const initial: EmployeeFormData = employee
    ? formFromEmployee(employee)
    : person
      ? {
          ...EMPTY_EMPLOYEE_FORM,
          first_name: nameParts[0] ?? '',
          last_name: nameParts.slice(1).join(' '),
          work_email: person.email,
        }
      : EMPTY_EMPLOYEE_FORM

  async function submit(form: EmployeeFormData) {
    setSaving(true)
    setError(null)
    setServerErrors({})
    try {
      const body = buildEmployeeBody(form, employee ? 'update' : 'create')
      const url = employee
        ? `/api/ws/${slug}/employees/${employee.id}`
        : person
          ? `/api/ws/${slug}/members/${person.user_id}/employee`
          : `/api/ws/${slug}/employees`
      const res = await fetch(url, {
        method: employee ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({})) as {
        employee?: EmployeePublic
        error?: string
        fields?: Record<string, string>
      }
      if (res.ok && data.employee) {
        if (person) await fillRemainder(person.user_id, body)
        toast(employee ? wsEmployees.wizardSavedEdit : wsEmployees.wizardSavedAdd, 'success')
        await onSaved(data.employee.id)
        return
      }
      setServerErrors(serverFieldErrors(data.fields))
      setError(data.error ?? wsEmployees.wizardGenericError)
    } finally {
      setSaving(false)
    }
  }

  /** Persist the answers the member-scoped insert cannot carry. */
  async function fillRemainder(userId: string, body: Record<string, unknown>) {
    const rest = Object.fromEntries(
      Object.entries(body).filter(([k, v]) => !MEMBER_POST_HONOURS.has(k) && v != null && v !== ''),
    )
    if (Object.keys(rest).length === 0) return
    // A failure here loses the extra fields, not the record: the person is in
    // the directory either way and the edit wizard can finish the job, so it
    // must not read as "nothing was saved".
    await fetch(`/api/ws/${slug}/members/${userId}/employee`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rest),
    }).catch(() => undefined)
  }

  return (
    <EmployeeWizard
      mode={kind === 'edit' ? 'edit' : 'add'}
      subject={
        employee
          ? `${employee.first_name} ${employee.last_name}`.trim()
          : person
            ? (person.full_name?.trim() || person.email)
            : wsEmployees.wizardNewSubject
      }
      initial={initial}
      saving={saving}
      serverErrors={serverErrors}
      error={error}
      onCancel={onCancel}
      onSubmit={form => void submit(form)}
    />
  )
}

// ─── Detail ───────────────────────────────────────────────────────────────────

interface OpeningBalance {
  id: string
  user_id: string
  leave_type_name: string
  balance_days: number
}

function EmployeeDetail({
  slug, employeeId, canWrite, canWriteDocuments, canReadDocuments, canReadLeaves, roleByUser, onBack, onEdit,
}: {
  slug: string
  employeeId: string
  canWrite: boolean
  canWriteDocuments: boolean
  canReadDocuments: boolean
  canReadLeaves: boolean
  roleByUser: Record<string, string>
  onBack: () => void
  onEdit: (employee: EmployeePublic) => void
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [employee, setEmployee] = useState<EmployeePublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<OpeningBalance[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await fetch(`/api/ws/${slug}/employees/${employeeId}`)
      if (cancelled) return
      if (res.ok) {
        const data = await res.json() as { employee: EmployeePublic }
        setEmployee(data.employee)
      } else {
        toast(wsEmployees.notFound, 'error')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [slug, employeeId, toast])

  useEffect(() => {
    if (!canReadLeaves || !employee?.user_id) return
    const userId = employee.user_id
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/ws/${slug}/leave-balances`)
      if (!res.ok || cancelled) return
      const data = await res.json() as { balances: OpeningBalance[] }
      setBalances((data.balances ?? []).filter(b => b.user_id === userId))
    })()
    return () => { cancelled = true }
  }, [slug, canReadLeaves, employee?.user_id])

  if (loading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ paddingLeft: 0 }}>
          ← {wsEmployees.backToDirectory}
        </Button>
        <Card style={{ marginTop: '10px' }}><SkeletonText lines={4} /></Card>
      </div>
    )
  }

  if (!employee) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ paddingLeft: 0 }}>
          ← {wsEmployees.backToDirectory}
        </Button>
        <EmptyState title={wsEmployees.notFound} />
      </div>
    )
  }

  const name = fullName(employee)
  const form = formFromEmployee(employee)
  const role = employee.user_id ? roleByUser[employee.user_id] : undefined

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} style={{ paddingLeft: 0 }}>
        ← {wsEmployees.backToDirectory}
      </Button>

      <Card style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Avatar name={name} size={64} color={avatarColor(employee.id)} />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 className="t-h1" style={{ fontSize: '20px' }}>{name}</h2>
            {role && <Chip tone={ROLE_TONE[role] ?? 'leave'}>{role}</Chip>}
          </div>
          <p className="t-secondary" style={{ marginTop: '2px' }}>
            {[employee.employment.designation, employee.employment.department].filter(Boolean).join(' · ') || wsEmployees.noValue}
          </p>
          <p className="t-muted" style={{ marginTop: '4px', overflowWrap: 'anywhere' }}>
            {[employee.work_email, employee.employee_id].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <Chip tone={STATUS_TONE[employee.employee_status] ?? 'leave'}>
            {EMPLOYEE_STATUS_LABELS[employee.employee_status] ?? employee.employee_status}
          </Chip>
          <p className="t-muted" style={{ fontSize: '11.5px' }}>
            {[
              employee.employment.employment_type
                ? displayValue('employment_type', employee.employment.employment_type)
                : null,
              employee.employment.date_of_joining
                ? wsEmployees.joinedOn(fmtDate(employee.employment.date_of_joining))
                : null,
            ].filter(Boolean).join(' · ')}
          </p>
          {canWrite && (
            <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => onEdit(employee)}>
              {wsEmployees.editButton}
            </Button>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginTop: '14px' }}>
        {EMPLOYEE_STEPS.slice(0, -1).map(step => (
          <Card key={step.key} style={{ marginTop: 0 }}>
            <p className="t-eyebrow" style={{ marginBottom: '12px' }}>{step.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px 16px' }}>
              {step.fields.map(k => {
                const raw = form[k].trim()
                return (
                  <div key={k}>
                    <p className="t-muted" style={{ fontSize: '11px', marginBottom: '2px' }}>{FIELD_LABELS[k]}</p>
                    <p style={{ fontSize: '13.5px', fontWeight: 500, overflowWrap: 'anywhere' }}>
                      {raw ? maskIfSensitive(k, displayValue(k, raw)) : wsEmployees.noValue}
                    </p>
                  </div>
                )
              })}
            </div>
            {step.key === 'bank' && (
              <p className="t-muted" style={{ marginTop: '12px', fontSize: '11.5px' }}>{wsEmployees.maskedHint}</p>
            )}
          </Card>
        ))}

        {canReadLeaves && (
          <Card style={{ marginTop: 0 }}>
            <p className="t-eyebrow" style={{ marginBottom: '12px' }}>{wsEmployees.sectionLeaveBalance}</p>
            {balances.length === 0 ? (
              <p className="t-muted">{wsEmployees.leaveBalanceEmpty}</p>
            ) : (
              <div className="stack-sm">
                {balances.map(b => (
                  <div key={b.id} className="row-between">
                    <span className="t-secondary" style={{ fontSize: '12.5px' }}>{b.leave_type_name}</span>
                    <span className="t-secondary" style={{ fontSize: '12.5px', fontWeight: 600 }}>{b.balance_days}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {canReadDocuments && (
        <EmployeeDocuments slug={slug} employeeId={employee.id} canWrite={canWriteDocuments} />
      )}
    </div>
  )
}
