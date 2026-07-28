'use client'

import type { PendingApprovalEntry } from '@/app/api/ws/[slug]/dashboard/route'
import { en } from '@/locales/en'
import { Check, X } from 'lucide-react'
import { getInitials, avatarColor, fmtDateRange } from './TodayHelpers'

export function PendingApprovalsCard({
  data, total, loading, actioningId, onApprove, onDecline,
}: {
  data: PendingApprovalEntry[]
  total: number
  loading: boolean
  actioningId: string | null
  onApprove: (id: string) => void
  onDecline: (id: string) => void
}) {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '4px',
  }

  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid rgba(29,158,117,0.18)',
      borderRadius: '16px', overflow: 'hidden', height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '15px 20px', borderBottom: '1px solid rgba(29,158,117,0.14)',
      }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Pending approvals
        </span>
        {total > 0 && (
          <span style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700,
            color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
            borderRadius: '20px', padding: '3px 10px',
          }}>
            {total}
          </span>
        )}
      </div>

      {loading ? (
        [1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 20px', borderBottom: '1px solid rgba(29,158,117,0.1)' }}>
            <div style={{ ...sk, width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...sk, height: '11px', width: '110px', marginBottom: '6px' }} />
              <div style={{ ...sk, height: '10px', width: '140px' }} />
            </div>
          </div>
        ))
      ) : data.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Inbox zero 🎉
          </div>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Every request has been actioned.
          </div>
        </div>
      ) : (
        data.map((a) => {
          const isActioning = actioningId === a.id
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '13px 20px', borderBottom: '1px solid rgba(29,158,117,0.1)',
              opacity: isActioning ? 0.6 : 1,
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11.5px', fontWeight: 700, color: '#fff',
                fontFamily: 'Plus Jakarta Sans, sans-serif', background: avatarColor(a.user_id),
              }}>
                {getInitials(a.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                  color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {a.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px', minWidth: 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: '18px', padding: '0 7px',
                    borderRadius: '4px', fontSize: '10px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0,
                  }}>
                    Leave
                  </span>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11.5px', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.leave_type_name} · {fmtDateRange(a.start_date, a.end_date)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  title={en.wsLeaves.rejectBtn}
                  disabled={isActioning}
                  onClick={() => onDecline(a.id)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', background: 'transparent',
                    border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', color: 'var(--danger)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isActioning ? 'not-allowed' : 'pointer',
                  }}
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  title={en.wsLeaves.approveBtn}
                  disabled={isActioning}
                  onClick={() => onApprove(a.id)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', background: '#1d9e75',
                    border: 'none', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isActioning ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Check size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
