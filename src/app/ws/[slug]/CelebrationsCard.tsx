'use client'

import type { CelebrationEntry } from '@/app/api/ws/[slug]/dashboard/route'
import { WidgetCard } from './WidgetCard'
import { fmtShortDate } from './TodayHelpers'

const CELEBRATION_ICON: Record<CelebrationEntry['type'], string> = {
  birthday: '🎂',
  anniversary: '🎉',
  new_joiner: '👋',
  holiday: '📅',
}

export function CelebrationsCard({ data, loading }: { data: CelebrationEntry[]; loading: boolean }) {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '4px',
  }

  return (
    <WidgetCard title="This week">
      {loading ? (
        [1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ ...sk, width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...sk, height: '11px', width: '120px', marginBottom: '5px' }} />
              <div style={{ ...sk, height: '10px', width: '80px' }} />
            </div>
          </div>
        ))
      ) : data.length === 0 ? (
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          Nothing to celebrate this week.
        </div>
      ) : (
        data.map((c, i) => (
          <div
            key={`${c.type}-${c.name}-${c.date}-${i}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 0',
              borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
            }}>
              {CELEBRATION_ICON[c.type]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 600,
                color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.name}
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.label}
              </div>
            </div>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {fmtShortDate(c.date)}
            </span>
          </div>
        ))
      )}
    </WidgetCard>
  )
}
