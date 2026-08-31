'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, DataTable, EmptyState, Input, Select, SkeletonText,
  type ChipTone, type Column,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsEmployees } from '@/locales/en/ws-people'
import { EmployeeStatus } from '@/lib/constants/employees'
import type { EmployeePublic } from '@/lib/types/employees'
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
  | { mode: 'wizard'; kind: 'add' }
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

  const [rows, setRows] = useState<EmployeePublic[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')

  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({})

  // ── Directory ──────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (offset: number) => {
    const qs = new URLSearchParams({ limit: '25', offset: String(offset) })
    if (department) qs.set('department', department)
    if (status) qs.set('status', status)
    const res = await fetch(`/api/ws/${slug}/employees?${qs.toString()}`)
    if (!res.ok) return null
    return res.json() as Promise<{
      employees: EmployeePublic[]
      total: number
      pagination: { nextOffset: number | null }
    }>
  }, [slug, department, status])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPage(0)
      if (!data) { toast(wsEmployees.loadFailed, 'error'); return }
      setRows(data.employees)
      setTotal(data.total)
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
      setRows(prev => [...prev, ...data.employees])
      setTotal(data.total)
      setNextOffset(data.pagination.nextOffset)
    } finally {
      setLoadingMore(false)
    }
  }

  // The list endpoint has no `search` param, so the query filters what is
  // already loaded rather than pretending to be a server search.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(e =>
      fullName(e).toLowerCase().includes(q) ||
      (e.employment.designation ?? '').toLowerCase().includes(q) ||
      e.work_email.toLowerCase().includes(q),
    )
  }, [rows, search])

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const e of rows) if (e.employment.department) set.add(e.employment.department)
    return [...set].sort()
  }, [rows])

  const activeCount = rows.filter(e => e.employee_status === EmployeeStatus.Active).length

  // ── Detail / wizard ────────────────────────────────────────────────────────

  // Only the id is handed over: the list response omits the encrypted columns
  // (PAN, Aadhaar, bank account), and only GET /employees/[id] decrypts them,
  // so the detail view fetches the full record itself rather than being
  // handed a row that is missing half of what it shows.
  function openEmployee(id: string) {
    setView({ mode: 'detail', id })
  }

  if (view.mode === 'wizard') {
    return (
      <WizardHost
        slug={slug}
        kind={view.kind}
        employee={view.kind === 'edit' ? view.employee : null}
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

  const columns: Column<EmployeePublic>[] = [
    {
      key: 'employee',
      header: wsEmployees.colEmployee,
      render: (e) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar name={fullName(e)} color={avatarColor(e.id)} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: '13px' }}>{fullName(e)}</p>
            <p className="t-muted" style={{ fontSize: '10.5px', overflowWrap: 'anywhere' }}>{e.work_email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      header: wsEmployees.colJobTitle,
      render: e => <span className="t-secondary">{e.employment.designation ?? wsEmployees.noValue}</span>,
    },
    {
      key: 'role',
      header: wsEmployees.colRole,
      render: (e) => {
        const role = e.user_id ? roleByUser[e.user_id] : undefined
        if (!role) return <span className="t-muted">{wsEmployees.noValue}</span>
        return <Chip tone={ROLE_TONE[role] ?? 'leave'}>{role}</Chip>
      },
    },
    {
      key: 'department',
      header: wsEmployees.colDepartment,
      render: e => <span className="t-secondary">{e.employment.department ?? wsEmployees.noValue}</span>,
    },
    {
      key: 'employment_type',
      header: wsEmployees.colType,
      render: e => (
        <span className="t-secondary">
          {e.employment.employment_type ? displayValue('employment_type', e.employment.employment_type) : wsEmployees.noValue}
        </span>
      ),
    },
    {
      key: 'joined',
      header: wsEmployees.colJoined,
      render: e => <span className="t-muted">{fmtDate(e.employment.date_of_joining)}</span>,
    },
    {
      key: 'status',
      header: wsEmployees.colStatus,
      render: e => (
        <Chip tone={STATUS_TONE[e.employee_status] ?? 'leave'}>
          {EMPLOYEE_STATUS_LABELS[e.employee_status] ?? e.employee_status}
        </Chip>
      ),
    },
  ]

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1">{wsEmployees.title}</h1>
          <p className="t-secondary" style={{ marginTop: '4px' }}>
            {wsEmployees.subtitle(total, activeCount)}
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

        {loading ? (
          <div style={{ padding: '18px 20px' }}><SkeletonText lines={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={e => e.id}
            minWidth={900}
            onRowClick={e => openEmployee(e.id)}
            empty={
              rows.length === 0
                ? <EmptyState title={wsEmployees.emptyDirectoryTitle} hint={wsEmployees.emptyDirectoryHint} />
                : <EmptyState title={wsEmployees.emptyTitle} hint={wsEmployees.emptyHint} />
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
 * Owns the request half of the wizard: which verb, which URL, and what to do
 * with a 422. The wizard itself stays a pure form.
 */
function WizardHost({
  slug, kind, employee, onCancel, onSaved,
}: {
  slug: string
  kind: 'add' | 'edit'
  employee: EmployeePublic | null
  onCancel: () => void
  onSaved: (id: string) => void | Promise<void>
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})

  const initial: EmployeeFormData = employee ? formFromEmployee(employee) : EMPTY_EMPLOYEE_FORM

  async function submit(form: EmployeeFormData) {
    setSaving(true)
    setError(null)
    setServerErrors({})
    try {
      const url = employee
        ? `/api/ws/${slug}/employees/${employee.id}`
        : `/api/ws/${slug}/employees`
      const res = await fetch(url, {
        method: employee ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmployeeBody(form, employee ? 'update' : 'create')),
      })
      const data = await res.json().catch(() => ({})) as {
        employee?: EmployeePublic
        error?: string
        fields?: Record<string, string>
      }
      if (res.ok && data.employee) {
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

  return (
    <EmployeeWizard
      mode={kind}
      subject={employee ? `${employee.first_name} ${employee.last_name}`.trim() : wsEmployees.wizardNewSubject}
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
