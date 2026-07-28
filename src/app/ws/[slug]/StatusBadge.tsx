'use client'

import type { DashboardMember } from '@/app/api/ws/[slug]/dashboard/route'
import { resolvePresenceTag, PRESENCE_TAG_CONFIG } from '@/lib/client/presence'

export function StatusBadge({ member }: { member: DashboardMember }) {
  const hasTrust = (member.latest_event?.trust_flags?.length ?? 0) > 0
  if (hasTrust) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px',
        borderRadius: '5px', fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
        background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
        color: 'var(--danger)', letterSpacing: '0.04em',
        border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
      }}>
        SUSPICIOUS
      </span>
    )
  }
  const tag = resolvePresenceTag(member.presence_status, member.latest_event?.matched_by, member.latest_event?.event_type)
  const { label, color } = PRESENCE_TAG_CONFIG[tag]
  const isMuted = tag === 'not_in'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px',
      borderRadius: '5px', fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
      background: isMuted ? 'var(--surface-2)' : `color-mix(in srgb, ${color} 12%, transparent)`,
      color, letterSpacing: '0.04em',
      border: isMuted ? 'none' : `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>
      {label.toUpperCase()}
    </span>
  )
}
