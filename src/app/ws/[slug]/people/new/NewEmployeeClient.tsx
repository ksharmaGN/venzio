'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { EmployeePublic } from '@/lib/types/employees'
import EmployeeFormHost from '@/components/ws/employee/EmployeeFormHost'
import { wsPeopleUi } from '@/locales/en/ws-people'

interface Props {
  slug: string
  canInvite: boolean
  /** An add already part-way through, resolved from `?draft=` on the server. */
  draft: EmployeePublic | null
}

/**
 * The record is created FIRST, and the invitation is offered second.
 *
 * Order matters. The record is the artefact worth keeping - it carries the
 * joining date, the department, the emergency contact - and asking about the
 * invitation before saving would mean a cancelled dialog throws a five-step
 * form away. Declining the invite here costs nothing: it can be sent later from
 * their profile, and the modal says so.
 */
export default function NewEmployeeClient({ slug, canInvite, draft }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()

  const [created, setCreated] = useState<EmployeePublic | null>(null)
  const [sending, setSending] = useState(false)

  /**
   * The row behind an add that is part-way through. Seeded from `?draft=` and
   * set again when step 1 creates it, because Cancel means something different
   * once a record exists - it leaves a person in the directory.
   */
  const [draftRecord, setDraftRecord] = useState<EmployeePublic | null>(draft)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  // The details page is keyed on a MEMBERSHIP id, which does not exist until
  // they are invited, so the directory is the only place a finished create can
  // land. Their new row is on it either way.
  function backToDirectory() {
    router.push(`/ws/${slug}/people`)
    router.refresh()
  }

  /**
   * Cancel, after at least one step has been saved.
   *
   * Deleting is offered rather than assumed: the likelier reason for leaving a
   * half-filled record is "I will finish this after lunch", and silently
   * throwing away what HR typed is worse than a row they can complete later.
   */
  async function discardDraft() {
    if (!draftRecord) return
    setDiscarding(true)
    try {
      const res = await fetch(`/api/ws/${slug}/employees/${draftRecord.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast(wsPeopleUi.draftDiscardFailed, 'error')
        return
      }
      backToDirectory()
    } finally {
      setDiscarding(false)
    }
  }

  async function sendInvite() {
    if (!created) return
    setSending(true)
    try {
      const res = await fetch(`/api/ws/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: created.work_email }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string }

      if (res.ok) {
        toast(wsPeopleUi.inviteSent(created.work_email), 'success')
      } else if (data.code === 'DOMAIN_AUTO_ENROL') {
        // Not a failure. Their domain is verified, so they join on signup and an
        // invitation would be noise - say the good news rather than an error.
        toast(wsPeopleUi.inviteAutoEnrol, 'success')
      } else if (data.code === 'ALREADY_MEMBER' || data.code === 'INVITE_PENDING') {
        toast(data.error ?? wsPeopleUi.inviteFailed, 'success')
      } else {
        toast(data.error ?? wsPeopleUi.inviteFailed, 'error')
        return
      }
      router.push(`/ws/${slug}/people`)
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  const name = created ? `${created.first_name} ${created.last_name}`.trim() : ''

  return (
    <div>
      <Link href={`/ws/${slug}/people`} className="btn btn-ghost btn-sm pressable link-plain btn-flush">
        <ArrowLeft size={14} aria-hidden />
        {wsPeopleUi.detailsBack}
      </Link>

      {draft && <p className="t-muted mb-12">{wsPeopleUi.draftResumed}</p>}

      <EmployeeFormHost
        slug={slug}
        employee={null}
        member={null}
        draft={draft}
        // Stamp the new record's id into the URL the moment step 1 saves, so a
        // refresh, a crash or a stray back-button lands on the filled form
        // instead of an empty one. `replace`, not `push`: Back should still
        // leave the wizard, not step through its own autosaves.
        onDraftCreated={(employee) => {
          setDraftRecord(employee)
          router.replace(`/ws/${slug}/people/new?draft=${encodeURIComponent(employee.id)}`)
        }}
        onCancel={() => {
          if (draftRecord) setConfirmingCancel(true)
          else router.push(`/ws/${slug}/people`)
        }}
        onSaved={(employee) => {
          if (canInvite) setCreated(employee)
          else backToDirectory()
        }}
      />

      {confirmingCancel && draftRecord && (
        <Modal
          open
          onClose={() => setConfirmingCancel(false)}
          title={wsPeopleUi.draftCancelTitle}
          maxWidth={460}
          footer={
            <>
              <Button variant="secondary" onClick={backToDirectory}>
                {wsPeopleUi.draftCancelKeep}
              </Button>
              <Button variant="danger" loading={discarding} onClick={() => void discardDraft()}>
                {discarding ? wsPeopleUi.draftCancelDiscarding : wsPeopleUi.draftCancelDiscard}
              </Button>
            </>
          }
        >
          <p className="t-secondary modal-body">
            {wsPeopleUi.draftCancelBody(
              `${draftRecord.first_name} ${draftRecord.last_name}`.trim() || draftRecord.work_email,
            )}
          </p>
        </Modal>
      )}

      {created && (
        <Modal
          open
          onClose={backToDirectory}
          title={wsPeopleUi.inviteModalTitle}
          maxWidth={460}
          footer={
            <>
              <Button variant="secondary" onClick={backToDirectory}>
                {wsPeopleUi.inviteModalSkip}
              </Button>
              <Button loading={sending} onClick={() => void sendInvite()}>
                {sending ? wsPeopleUi.inviteModalSending : wsPeopleUi.inviteModalSend}
              </Button>
            </>
          }
        >
          <p className="t-secondary modal-body">
            {wsPeopleUi.inviteModalBody(name || created.work_email, created.work_email)}
          </p>
          <p className="t-muted">{wsPeopleUi.inviteModalNote}</p>
        </Modal>
      )}
    </div>
  )
}
