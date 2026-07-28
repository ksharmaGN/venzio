'use client'

import type { RealtimeResponse } from '@/app/api/ws/[slug]/realtime/route'

export function CurrentActiveMembersCard({ data, loading }: { data: RealtimeResponse | null; loading: boolean }) {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '4px',
  }
  const locations = data?.locations ?? []

  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid rgba(29,158,117,0.18)',
      borderRadius: '16px', padding: '18px 20px', height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10.5px', fontWeight: 700,
        color: '#7aab92', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px',
      }}>
        Current Active Members
      </div>
      {loading ? (
        <div style={{ ...sk, height: '32px', width: '56px', marginBottom: '16px' }} />
      ) : (
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: '32px', fontWeight: 700,
          lineHeight: 1, color: 'var(--navy)', marginBottom: '16px',
        }}>
          {data?.active_count ?? 0}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(29,158,117,0.14)', paddingBottom: '6px', marginBottom: '4px',
      }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10.5px', fontWeight: 700, color: '#7aab92', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Location
        </span>
        <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10.5px', fontWeight: 700, color: '#7aab92', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Members
        </span>
      </div>

      {loading ? (
        [1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <div style={{ ...sk, height: '11px', width: '110px' }} />
            <div style={{ ...sk, height: '11px', width: '18px' }} />
          </div>
        ))
      ) : locations.length === 0 ? (
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          No activity
        </div>
      ) : (
        locations.map((loc, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: i < locations.length - 1 ? '1px solid rgba(29,158,117,0.1)' : 'none',
          }}>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%',
            }}>
              {loc.label}
            </span>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 700, color: '#1d9e75' }}>
              {loc.count}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
