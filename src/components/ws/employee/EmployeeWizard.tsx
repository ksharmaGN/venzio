'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  Button, Card, Field, Input, Select, Textarea, WizardSteps,
  type SelectOption, type WizardStep,
} from '@/components/ui'
import { wsEmployees } from '@/locales/en/ws-people'
import {
  EMPLOYEE_STEPS, FIELD_LABELS,
  EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, GENDER_LABELS,
  MARITAL_LABELS, SOURCE_OF_HIRE_LABELS, WORK_MODE_LABELS,
  displayValue, validateStep, validateAll,
  type EmployeeFormData, type EmployeeFormKey, type FieldErrors,
} from './employee-form'

// ─── Field descriptors ────────────────────────────────────────────────────────
//
// Purely presentational: which control a key renders as. The rules about what
// a key MEANS (required, format, masking) live in employee-form.ts, so this
// table can be reordered or restyled without touching validation.

type ControlKind = 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select' | 'sensitive'

interface Descriptor {
  kind: ControlKind
  placeholder?: string
  required?: boolean
  full?: boolean
  maxLength?: number
  labels?: Record<string, string>
}

function optionsFrom(labels: Record<string, string>): SelectOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const DESCRIPTORS: Record<EmployeeFormKey, Descriptor> = {
  first_name: { kind: 'text', required: true },
  last_name: { kind: 'text', required: true },
  work_email: { kind: 'email', required: true, placeholder: 'name@company.in' },
  personal_email: { kind: 'email' },
  phone: { kind: 'tel', placeholder: '10-digit mobile number', maxLength: 10 },
  alternate_phone: { kind: 'tel', maxLength: 10 },
  gender: { kind: 'select', labels: GENDER_LABELS },
  date_of_birth: { kind: 'date' },
  marital_status: { kind: 'select', labels: MARITAL_LABELS },
  number_of_children: { kind: 'number', placeholder: '0' },
  blood_group: { kind: 'select', labels: Object.fromEntries(BLOOD_GROUPS.map(g => [g, g])) },
  current_address: { kind: 'textarea', full: true, placeholder: 'Street, City, State, PIN' },
  permanent_address: { kind: 'textarea', full: true, placeholder: 'Same as current or different' },

  employee_id: { kind: 'text', placeholder: 'e.g. EMP-001' },
  designation: { kind: 'text', placeholder: 'e.g. Software Engineer' },
  department: { kind: 'text', placeholder: 'e.g. Engineering' },
  employment_type: { kind: 'select', labels: EMPLOYMENT_TYPE_LABELS },
  work_mode: { kind: 'select', labels: WORK_MODE_LABELS },
  work_location: { kind: 'text', placeholder: 'e.g. Mumbai HQ' },
  date_of_joining: { kind: 'date' },
  confirmation_date: { kind: 'date' },
  probation_end_date: { kind: 'date' },
  source_of_hire: { kind: 'select', labels: SOURCE_OF_HIRE_LABELS },
  total_work_experience: { kind: 'number', placeholder: '0' },
  employee_status: { kind: 'select', labels: EMPLOYEE_STATUS_LABELS },

  pan: { kind: 'sensitive', placeholder: 'ABCDE1234F', maxLength: 10 },
  aadhaar: { kind: 'sensitive', placeholder: '12-digit number', maxLength: 12 },
  uan: { kind: 'sensitive', placeholder: 'Universal Account Number', maxLength: 12 },
  passport_number: { kind: 'sensitive', placeholder: 'A1234567', maxLength: 8 },
  bank_account: { kind: 'sensitive', full: true, placeholder: 'Account number', maxLength: 18 },
  bank_ifsc: { kind: 'sensitive', placeholder: 'IFSC code' },
  bank_name: { kind: 'text', placeholder: 'e.g. HDFC Bank' },

  emergency_contact_name: { kind: 'text', full: true, placeholder: 'Full name' },
  emergency_contact_relationship: { kind: 'text', placeholder: 'e.g. Spouse, Parent' },
  emergency_contact_phone: { kind: 'tel', placeholder: '10-digit mobile number', maxLength: 10 },
}

// ─── Sensitive input ──────────────────────────────────────────────────────────

/**
 * A PAN or bank account typed in an open-plan office. Masked by default with
 * an explicit reveal, so the value is never on screen unless someone asked for
 * it. `tabIndex={-1}` on the eye keeps the toggle out of the tab order - it is
 * a convenience, not a step in filling the form.
 */
function SensitiveInput({
  id, value, onChange, placeholder, maxLength, invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  invalid?: boolean
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Input
        id={id}
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        invalid={invalid}
        style={{ paddingRight: '44px' }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setReveal(r => !r)}
        aria-label={reveal ? 'Hide value' : 'Show value'}
        className="icon-btn icon-btn-plain"
        style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', minWidth: 38, width: 38, height: 38 }}
      >
        {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// ─── One field ────────────────────────────────────────────────────────────────

function WizardField({
  fieldKey, form, errors, onChange,
}: {
  fieldKey: EmployeeFormKey
  form: EmployeeFormData
  errors: FieldErrors
  onChange: (key: EmployeeFormKey, value: string) => void
}) {
  const reactId = useId()
  const id = `emp-${fieldKey}-${reactId}`
  const d = DESCRIPTORS[fieldKey]
  const value = form[fieldKey]
  const error = errors[fieldKey]
  const set = (v: string) => onChange(fieldKey, v)

  let control
  if (d.kind === 'select') {
    control = (
      <Select
        id={id}
        value={value}
        onChange={e => set(e.target.value)}
        invalid={!!error}
        options={[{ value: '', label: 'Select' }, ...optionsFrom(d.labels ?? {})]}
      />
    )
  } else if (d.kind === 'textarea') {
    control = (
      <Textarea
        id={id}
        value={value}
        onChange={e => set(e.target.value)}
        placeholder={d.placeholder}
        invalid={!!error}
      />
    )
  } else if (d.kind === 'sensitive') {
    control = (
      <SensitiveInput
        id={id}
        value={value}
        onChange={set}
        placeholder={d.placeholder}
        maxLength={d.maxLength}
        invalid={!!error}
      />
    )
  } else {
    control = (
      <Input
        id={id}
        type={d.kind}
        value={value}
        onChange={e => set(e.target.value)}
        placeholder={d.placeholder}
        maxLength={d.maxLength}
        invalid={!!error}
      />
    )
  }

  return (
    <Field
      label={FIELD_LABELS[fieldKey]}
      htmlFor={id}
      required={d.required}
      error={error}
      style={d.full ? { gridColumn: '1 / -1' } : undefined}
    >
      {control}
    </Field>
  )
}

// ─── Review ───────────────────────────────────────────────────────────────────

function ReviewSummary({ form }: { form: EmployeeFormData }) {
  return (
    <div className="stack" style={{ gap: '22px' }}>
      {EMPLOYEE_STEPS.slice(0, -1).map(step => {
        const filled = step.fields.filter(k => form[k].trim())
        if (filled.length === 0) return null
        return (
          <div key={step.key}>
            <p className="t-eyebrow" style={{ marginBottom: '10px' }}>{step.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 16px' }}>
              {filled.map(k => (
                <div key={k}>
                  <p className="t-muted" style={{ fontSize: '11px', marginBottom: '2px' }}>{FIELD_LABELS[k]}</p>
                  <p style={{ fontSize: '13.5px', fontWeight: 500, overflowWrap: 'anywhere' }}>
                    {DESCRIPTORS[k].kind === 'sensitive'
                      ? '•'.repeat(Math.max(0, form[k].trim().length - 4)) + form[k].trim().slice(-4)
                      : displayValue(k, form[k].trim())}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── The wizard ───────────────────────────────────────────────────────────────

const STEP_LABELS: WizardStep[] = EMPLOYEE_STEPS.map(s => ({ key: s.key, label: s.label }))

interface Props {
  mode: 'add' | 'edit'
  subject: string
  initial: EmployeeFormData
  saving: boolean
  /** Server-side field errors, already mapped to messages. */
  serverErrors: FieldErrors
  error: string | null
  onCancel: () => void
  onSubmit: (form: EmployeeFormData) => void
}

/**
 * The 5-step employee form. Owns only the step cursor and the draft - the
 * caller owns the request, so the same wizard drives both POST and PATCH.
 *
 * Every step is reachable from every other by clicking its number. Per-step
 * validation is a MONITOR, not a gate: it marks the dots, while submit()'s
 * validateAll is what actually refuses. Editing an existing record therefore
 * does not mean clicking Continue four times to reach the bank details.
 */
export default function EmployeeWizard({
  mode, subject, initial, saving, serverErrors, error, onCancel, onSubmit,
}: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<EmployeeFormData>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})

  const current = EMPLOYEE_STEPS[step]
  const isReview = step === EMPLOYEE_STEPS.length - 1
  const merged: FieldErrors = { ...serverErrors, ...errors }

  function change(key: EmployeeFormKey, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  function next() {
    const found = validateStep(step, form)
    if (Object.keys(found).length > 0) { setErrors(found); return }
    setErrors({})
    setStep(s => s + 1)
  }

  /**
   * Jump straight to any step by clicking its number.
   *
   * Continue still gates - this does not. Validation of the step being LEFT is
   * merged in rather than blocking, so the dot can be marked and the user can
   * still go and fix something else first. Nothing is lost by allowing it:
   * submit() re-runs validateAll and refuses, landing on the earliest broken
   * step, so the guarantee lives at the submit boundary rather than on every
   * forward edge.
   */
  function jumpTo(target: number) {
    if (target === step) return
    const found = validateStep(step, form)
    setErrors(prev => ({ ...prev, ...found }))
    setStep(target)
  }

  // Which dots to mark. Recomputed from `merged`, so clearing a field's error
  // un-marks its step without any extra bookkeeping.
  const invalidSteps = EMPLOYEE_STEPS.reduce<number[]>((acc, s, i) => {
    if (s.fields.some(k => merged[k])) acc.push(i)
    return acc
  }, [])

  function submit() {
    // Re-run every step: a user can walk back and empty a required field, and
    // per-step validation alone would never see it again.
    const found = validateAll(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      // Land them on the earliest step that actually has a problem.
      const bad = EMPLOYEE_STEPS.findIndex(s => s.fields.some(k => found[k]))
      if (bad >= 0) setStep(bad)
      return
    }
    onSubmit(form)
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onCancel} style={{ paddingLeft: 0 }}>
        ← {wsEmployees.backToStep}
      </Button>

      <h1 className="t-h1" style={{ marginTop: '8px' }}>
        {mode === 'edit' ? wsEmployees.wizardEditTitle : wsEmployees.wizardAddTitle}
      </h1>
      <p className="t-secondary" style={{ margin: '2px 0 18px' }}>{subject}</p>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 16px', borderBottom: '1px solid var(--border)' }}>
          <p className="t-h2">{current.label}</p>
          <p className="t-muted" style={{ marginBottom: '14px' }}>{current.subtitle}</p>
          <div style={{ overflowX: 'auto' }}>
            <WizardSteps
              steps={STEP_LABELS}
              currentIndex={step}
              onStepClick={jumpTo}
              invalidIndexes={invalidSteps}
            />
          </div>
        </div>

        <div style={{ padding: '22px' }}>
          {isReview ? (
            <ReviewSummary form={form} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {current.fields.map(k => (
                <WizardField key={k} fieldKey={k} form={form} errors={merged} onChange={change} />
              ))}
            </div>
          )}
          {error && <p className="field-error" role="alert" style={{ marginTop: '14px' }}>{error}</p>}
        </div>

        <div className="row-between" style={{ padding: '16px 22px', borderTop: '1px solid var(--border)' }}>
          <Button variant="secondary" onClick={() => (step === 0 ? onCancel() : setStep(s => s - 1))}>
            {step === 0 ? wsEmployees.wizardCancel : wsEmployees.backToStep}
          </Button>
          <Button onClick={isReview ? submit : next} loading={saving}>
            {isReview
              ? saving
                ? wsEmployees.wizardSaving
                : mode === 'edit' ? wsEmployees.wizardSaveEdit : wsEmployees.wizardSaveAdd
              : wsEmployees.wizardContinue}
          </Button>
        </div>
      </Card>
    </div>
  )
}
