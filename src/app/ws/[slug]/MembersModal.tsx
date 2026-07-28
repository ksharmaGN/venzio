'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { DashboardMember } from '@/app/api/ws/[slug]/dashboard/route'
import { getInitials } from './TodayHelpers'
import { StatusBadge } from './StatusBadge'

export function MembersModal({
  title, members, slug, onClose,
}: {
  title: string
  members: DashboardMember[]
  slug: string
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-0)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          width: '100%', maxWidth: '480px',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0,
          }}>
            {title}
            <span style={{
              marginLeft: '8px', fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)',
            }}>
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '28px', height: '28px', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--surface-1)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div className="no-scrollbar" style={{ overflowY: 'auto', flex: 1, maxHeight: '600px', scrollbarWidth: 'none' } as React.CSSProperties}>
          {members.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                No people to show
              </p>
            </div>
          ) : (
            members.map((m) => {
              const name = m.full_name ?? m.email
              const isPresent = m.presence_status === 'present'
              const isVisited = m.presence_status === 'visited'
              const avatarBg = isPresent
                ? 'color-mix(in srgb, var(--brand) 15%, transparent)'
                : isVisited
                ? 'color-mix(in srgb, var(--amber) 15%, transparent)'
                : 'var(--surface-2)'
              const avatarColor = isPresent ? 'var(--brand)' : isVisited ? 'var(--amber)' : 'var(--text-muted)'
              return (
                <Link key={m.member_id} href={`/ws/${slug}/members/${m.user_id}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 20px', borderBottom: '1px solid var(--border)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: avatarBg, color: avatarColor,
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: m.presence_status !== 'notIn'
                        ? `0 0 0 2px ${isPresent ? 'var(--brand)' : 'var(--amber)'}` : 'none',
                    }}>
                      {getInitials(name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                        color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </div>
                      {m.full_name && (
                        <div style={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.email}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <StatusBadge member={m} />
                      {m.latest_event?.checkout_location_mismatch != null && m.latest_event.checkout_location_mismatch > 0 && (
                        <span
                          title={`Checked out from a different location (${Math.round(m.latest_event.checkout_location_mismatch)}m away from office). Hours may not count as in-office.`}
                          style={{
                            fontSize: '11px',
                            color: 'var(--amber)',
                            fontFamily: 'var(--font-mono, monospace)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'default',
                          }}
                        >
                          ⚠ Left from different location
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
