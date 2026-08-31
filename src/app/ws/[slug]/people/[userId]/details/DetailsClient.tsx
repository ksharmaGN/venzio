'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import type { EmployeePublic } from '@/lib/types/employees'
import EmployeeWizard from '../../../employees/EmployeeWizard'
import {
  EMPTY_EMPLOYEE_FORM, buildEmployeeBody, formFromEmployee, serverFieldErrors,
  type EmployeeFormData, type FieldErrors,
} from '../../../employees/employee-form'
import { en } from '@/locales/en'
import { wsEmployees } from '@/locales/en/ws-people'

interface Props {
  slug: string
  member: MemberWithUser
  employee: EmployeePublic | null
}

/**
 * Set up (or edit) the employee record attached to ONE workspace member.
 *
 * The form itself is the shared 5-step wizard from /ws/:slug/employees - same
 * steps, same client-side rules, same review screen. What differs is only the
 * endpoint: this screen posts to .../members/:userId/employee, which links the
 * new record to that member's user_id. Keeping the form in one place is why
 * the two screens cannot validate a PAN differently.
 */
export default function DetailsClient({ slug, member, employee }: Props) {
  const router = useRouter()
  const isEdit = employee !== null

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})

  // Seed a brand-new record from what membership already knows, so an admin is
  // not retyping a name and an email the invite already carried.
  const parts = (member.full_name ?? '').trim().split(/\s+/).filter(Boolean)
  const initial: EmployeeFormData = employee
    ? formFromEmployee(employee)
    : {
        ...EMPTY_EMPLOYEE_FORM,
        first_name: parts[0] ?? '',
        last_name: parts.slice(1).join(' '),
        work_email: member.email,
      }

  async function submit(form: EmployeeFormData) {
    setSaving(true)
    setError(null)
    setServerErrors({})
    try {
      // 'create' semantics for both verbs: this endpoint has always omitted
      // blanks rather than nulling columns, and a PATCH that clears every
      // untouched field would be a data-loss bug, not a re-skin.
      const res = await fetch(`/api/ws/${slug}/members/${member.user_id}/employee`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmployeeBody(form, 'create')),
      })
      const data = await res.json().catch(() => ({})) as {
        error?: string
        fields?: Record<string, string>
      }
      if (res.ok) {
        router.push(`/ws/${slug}/people`)
        return
      }
      setServerErrors(serverFieldErrors(data.fields))
      setError(data.error ?? wsEmployees.wizardGenericError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link
        href={`/ws/${slug}/people`}
        className="btn btn-ghost btn-sm pressable"
        style={{ textDecoration: 'none', paddingLeft: 0, marginBottom: '8px' }}
      >
        <ArrowLeft size={14} aria-hidden />
        {en.wsPeople.pageTitle}
      </Link>

      <EmployeeWizard
        mode={isEdit ? 'edit' : 'add'}
        subject={member.full_name ?? member.email}
        initial={initial}
        saving={saving}
        serverErrors={serverErrors}
        error={error}
        onCancel={() => router.push(`/ws/${slug}/people`)}
        onSubmit={form => void submit(form)}
      />
    </div>
  )
}
