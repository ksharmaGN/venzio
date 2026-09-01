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
export default function NewEmployeeClient({ slug, canInvite }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()

  const [created, setCreated] = useState<EmployeePublic | null>(null)
  const [sending, setSending] = useState(false)

  // The details page is keyed on a MEMBERSHIP id, which does not exist until
  // they are invited, so the directory is the only place a finished create can
  // land. Their new row is on it either way.
  function backToDirectory() {
    router.push(`/ws/${slug}/people`)
    router.refresh()
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

      <EmployeeFormHost
        slug={slug}
        employee={null}
        member={null}
        onCancel={() => router.push(`/ws/${slug}/people`)}
        onSaved={(employee) => {
          if (canInvite) setCreated(employee)
          else backToDirectory()
        }}
      />

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
