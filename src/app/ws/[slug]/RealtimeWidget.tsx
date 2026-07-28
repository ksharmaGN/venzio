'use client'

import type { RealtimeResponse } from '@/app/api/ws/[slug]/realtime/route'

export function RealtimeWidget({ data, loading, activeCount, locationCounts }: {
  data: RealtimeResponse | null
  loading: boolean
  activeCount?: number
  locationCounts?: { label: string; count: number }[]
}) {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '3px',
  }

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      boxSizing: 'border-box',
    }}>
      <div>
        <div style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', fontWeight: 700,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: '6px',
        }}>
          Current Active Members
        </div>
        {loading ? (
          <div style={{ ...sk, height: '32px', width: '48px' }} />
        ) : (
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '32px', fontWeight: 700, lineHeight: 1, color: 'var(--navy)' }}>
            {activeCount ?? data?.active_count ?? 0}
          </div>
        )}
      </div>

      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px',
        }}>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Location</span>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Members</span>
        </div>
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ ...sk, height: '11px', width: '100px' }} />
              <div style={{ ...sk, height: '11px', width: '16px' }} />
            </div>
          ))
        ) : (locationCounts ?? data?.locations ?? []).length === 0 ? (
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
            No activity
          </div>
        ) : (
          (locationCounts ?? data?.locations ?? []).map((loc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: i < (locationCounts ?? data?.locations ?? []).length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px',
                color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '75%',
              }}>
                {loc.label}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: 'var(--brand)' }}>
                {loc.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
