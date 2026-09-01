'use client'

import { Card } from '@/components/ui'
import { wsEmployees } from '@/locales/en/ws-people'
import type { EmployeePublic } from '@/lib/types/employees'
import {
  EMPLOYEE_STEPS, FIELD_LABELS, displayValue, formFromEmployee, maskIfSensitive,
} from './employee-form'

interface OpeningBalance {
  id: string
  leave_type_name: string
  balance_days: number
}

interface Props {
  employee: EmployeePublic
  /** Omitted when the viewer cannot read leave - the card is then absent, not empty. */
  balances?: OpeningBalance[] | null
}

/**
 * The read-only employee record: one card per wizard step, same order, same
 * labels, sensitive values masked.
 *
 * Driven off `EMPLOYEE_STEPS` rather than its own field list, so a field added
 * to the wizard appears here without a second edit. That is the whole reason
 * the step table lives in `employee-form.ts` and not inside the wizard.
 *
 * Pure presentation - it fetches nothing. The page that renders it already had
 * to load the record to decide what to show, and a component that re-fetches
 * what its parent holds is how a detail view ends up with two sources of truth.
 */
export default function EmployeeProfileView({ employee, balances }: Props) {
  const form = formFromEmployee(employee)

  return (
    <div className="card-grid">
      {EMPLOYEE_STEPS.slice(0, -1).map(step => (
        <Card key={step.key} className="mt-0">
          <p className="t-eyebrow mb-12">{step.label}</p>
          <div className="field-grid">
            {step.fields.map(k => {
              const raw = form[k].trim()
              return (
                <div key={k}>
                  <p className="t-muted field-label">{FIELD_LABELS[k]}</p>
                  <p className="field-value">
                    {raw ? maskIfSensitive(k, displayValue(k, raw)) : wsEmployees.noValue}
                  </p>
                </div>
              )
            })}
          </div>
          {step.key === 'bank' && (
            <p className="t-muted field-note">{wsEmployees.maskedHint}</p>
          )}
        </Card>
      ))}

      {balances && (
        <Card className="mt-0">
          <p className="t-eyebrow mb-12">{wsEmployees.sectionLeaveBalance}</p>
          {balances.length === 0 ? (
            <p className="t-muted">{wsEmployees.leaveBalanceEmpty}</p>
          ) : (
            <div className="stack-sm">
              {balances.map(b => (
                <div key={b.id} className="row-between">
                  <span className="t-secondary field-row-label">{b.leave_type_name}</span>
                  <span className="t-secondary field-row-value">{b.balance_days}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
