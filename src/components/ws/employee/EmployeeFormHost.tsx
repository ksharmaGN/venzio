'use client'

import { useState } from 'react'
import { useToast } from '@/components/shared/Toast'
import { wsEmployees } from '@/locales/en/ws-people'
import type { EmployeePublic } from '@/lib/types/employees'
import EmployeeWizard from './EmployeeWizard'
import {
  EMPLOYEE_STEPS, EMPTY_EMPLOYEE_FORM, buildEmployeeBody, formFromEmployee, serverFieldErrors,
  type EmployeeFormData, type FieldErrors,
} from './employee-form'

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

/** Membership facts the seed needs. `userId` null means an invite not yet accepted. */
export interface MemberSeed {
  userId: string | null
  email: string
  fullName: string | null
}

interface Props {
  slug: string
  /** The record being edited, or null when this is a create. */
  employee: EmployeePublic | null
  /** The membership behind it, when there is one. */
  member: MemberSeed | null
  /**
   * A create that is already part-way through - the record was written when the
   * admin left step 1 and this is what a refresh resumes from. Distinct from
   * `employee`, which puts the wizard in `edit` mode with edit titles and no
   * invitation offer at the end; a resumed draft is still an ADD.
   */
  draft?: EmployeePublic | null
  /** Fired once, when the step-1 save creates the record. */
  onDraftCreated?: (employee: EmployeePublic) => void
  onCancel: () => void
  onSaved: (employee: EmployeePublic) => void | Promise<void>
}

/**
 * Owns the request half of the wizard: which verb, which URL, and what to do
 * with a 422. The wizard itself stays a pure form.
 *
 * Three shapes, one form:
 *  - edit            PATCH /employees/:id               - an existing record
 *  - member, joined  POST  /members/:userId/employee     - the only route that
 *                    links `employees.user_id` at insert time
 *  - no account yet  POST  /employees                    - a standalone record,
 *                    used both for a brand-new hire and for somebody who has
 *                    been invited but has no user row to link to. The link is
 *                    made later, by work email, when they accept.
 */
export default function EmployeeFormHost({
  slug, employee, member, draft = null, onDraftCreated, onCancel, onSaved,
}: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not.
  const { show: toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})

  /**
   * The record id once step 1 has been saved. Seeded from `draft` so a refresh
   * carries on PATCHing the same row instead of trying to create a second one -
   * which `idx_employees_ws_work_email` (UNIQUE per workspace) would refuse
   * anyway, but as a duplicate-email error rather than something intelligible.
   */
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null)

  /**
   * Autosave applies to the STANDALONE create only.
   *
   * Not in `edit`: an existing record must not be mutated field-by-field just
   * because somebody opened the form and clicked through it - Cancel has to
   * still mean cancel.
   *
   * Not on the member-linked create either: that route's insert honours only
   * `MEMBER_POST_HONOURS` and drops the rest, so a step-1 create there would
   * silently lose half of step 1 and need a second request to repair it. That
   * path already saves once, at the end, through `fillRemainder`.
   */
  const autosaves = !employee && !member

  // Seed a new record from what membership already knows, so an admin is not
  // retyping a name and an email the invite already carried. A single-word
  // display name lands entirely in `first_name` and leaves the surname blank
  // for a human to supply - `employees.last_name` is NOT NULL, and inventing
  // one next to somebody's PAN is not ours to do.
  const nameParts = (member?.fullName ?? '').trim().split(/\s+/).filter(Boolean)
  const initial: EmployeeFormData = employee
    ? formFromEmployee(employee)
    : draft
      ? formFromEmployee(draft)
      : member
      ? {
          ...EMPTY_EMPLOYEE_FORM,
          first_name: nameParts[0] ?? '',
          last_name: nameParts.slice(1).join(' '),
          work_email: member.email,
        }
      : EMPTY_EMPLOYEE_FORM

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

  /**
   * Save the step the admin is leaving. Returns whether the wizard may advance.
   *
   * The first call CREATES the record from step 1's answers; every later call
   * PATCHes it with **only that step's fields**. The narrowing is not an
   * optimisation - `buildEmployeeBody(form,'update')` turns every blank into an
   * explicit `null`, so a full-form PATCH from step 2 would clear the bank and
   * emergency answers the admin has not reached yet.
   *
   * A failure returns false and leaves the error on screen. Advancing on a
   * failed save is the exact bug this replaces: the admin walks on believing
   * their work is safe.
   */
  async function saveStep(form: EmployeeFormData, stepIndex: number): Promise<boolean> {
    setError(null)
    setServerErrors({})
    const keys = EMPLOYEE_STEPS[stepIndex].fields
    if (keys.length === 0) return true

    const creating = draftId === null
    const res = await fetch(
      creating ? `/api/ws/${slug}/employees` : `/api/ws/${slug}/employees/${draftId}`,
      {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmployeeBody(form, creating ? 'create' : 'update', keys)),
      },
    ).catch(() => null)

    if (!res) {
      setError(wsEmployees.wizardGenericError)
      return false
    }
    const data = await res.json().catch(() => ({})) as {
      employee?: EmployeePublic
      error?: string
      fields?: Record<string, string>
    }
    if (!res.ok) {
      setServerErrors(serverFieldErrors(data.fields))
      setError(data.error ?? wsEmployees.wizardGenericError)
      return false
    }
    if (creating && data.employee) {
      setDraftId(data.employee.id)
      onDraftCreated?.(data.employee)
    }
    return true
  }

  async function submit(form: EmployeeFormData) {
    setSaving(true)
    setError(null)
    setServerErrors({})
    try {
      // A resumed or autosaved create already HAS a row, so the final action is
      // a PATCH of the whole form, not a second POST - which the unique work
      // email would refuse. Full body here, not step-scoped: by the review
      // screen every step has been seen, so a blank really does mean "empty".
      if (draftId) {
        const res = await fetch(`/api/ws/${slug}/employees/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildEmployeeBody(form, 'update')),
        })
        const data = await res.json().catch(() => ({})) as {
          employee?: EmployeePublic
          error?: string
          fields?: Record<string, string>
        }
        if (res.ok && data.employee) {
          toast(wsEmployees.wizardSavedAdd, 'success')
          await onSaved(data.employee)
          return
        }
        setServerErrors(serverFieldErrors(data.fields))
        setError(data.error ?? wsEmployees.wizardGenericError)
        return
      }

      const body = buildEmployeeBody(form, employee ? 'update' : 'create')
      const linkedUserId = employee ? null : member?.userId ?? null
      const url = employee
        ? `/api/ws/${slug}/employees/${employee.id}`
        : linkedUserId
          ? `/api/ws/${slug}/members/${linkedUserId}/employee`
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
        if (linkedUserId) await fillRemainder(linkedUserId, body)
        toast(employee ? wsEmployees.wizardSavedEdit : wsEmployees.wizardSavedAdd, 'success')
        await onSaved(data.employee)
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
      mode={employee ? 'edit' : 'add'}
      subject={
        employee
          ? `${employee.first_name} ${employee.last_name}`.trim()
          : draft
            ? `${draft.first_name} ${draft.last_name}`.trim()
            : member
              ? (member.fullName?.trim() || member.email)
              : wsEmployees.wizardNewSubject
      }
      initial={initial}
      saving={saving}
      serverErrors={serverErrors}
      error={error}
      onCancel={onCancel}
      onSubmit={form => void submit(form)}
      onStepSave={autosaves ? saveStep : undefined}
    />
  )
}
