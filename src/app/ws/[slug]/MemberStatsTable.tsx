'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MemberStatsResponse, StatsInterval } from '@/app/api/ws/[slug]/member-stats/route'
import { fmtHours } from '@/lib/client/format-time'

/** First letters of the first two words (or first two chars) of a name, upper-cased. */
function getInitials(s: string): string {
  const parts = s.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
        {value}
      </span>
    </div>
  )
}

const STATS_INTERVALS: { key: StatsInterval; label: string }[] = [
  { key: 'week',   label: 'Week' },
  { key: 'month',  label: 'Month' },
  { key: '3month', label: '3 Months' },
  { key: 'custom', label: 'Custom' },
]

export function MemberStatsTable({ slug, statsData, loading, interval, onIntervalChange, customRange, onCustomApply, minDate }: {
  slug: string
  statsData: MemberStatsResponse | null
  loading: boolean
  interval: StatsInterval
  onIntervalChange: (iv: StatsInterval) => void
  customRange: { start: string; end: string }
  onCustomApply: (range: { start: string; end: string }) => void
  minDate: string
}) {
  const today = new Date().toISOString().split('T')[0]
  const [localStart, setLocalStart] = useState(customRange.start)
  const [localEnd, setLocalEnd]     = useState(customRange.end)
  const [search, setSearch] = useState('')

  const th: React.CSSProperties = {
    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em',
  }
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '600px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '5px',
  }

  const allMembers = statsData?.members ?? []
  const members = search.trim()
    ? allMembers.filter((m) => {
        const q = search.toLowerCase()
        return (m.full_name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      })
    : allMembers
  const totalDays = statsData?.total_working_days ?? 1

  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <h2 style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', fontWeight: 700,
          color: 'var(--text-primary)', margin: 0, flex: 1,
        }}>
          Employee{' '}
          <em style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontWeight: 700, color: 'var(--brand)' }}>
            Attendance
          </em>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              height: '30px', padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif',
              background: 'var(--surface-1)', color: 'var(--text-primary)',
              outline: 'none', width: '200px',
            }}
          />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            {STATS_INTERVALS.map((iv) => (
              <button
                key={iv.key}
                type="button"
                onClick={() => onIntervalChange(iv.key)}
                style={{
                  height: '30px', padding: '0 12px',
                  background: interval === iv.key ? 'var(--brand)' : 'var(--surface-0)',
                  color: interval === iv.key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${interval === iv.key ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontWeight: interval === iv.key ? 600 : 400,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date range row */}
      {interval === 'custom' && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-0)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap',
        }}>
          {/* From */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              From
            </label>
            <input
              type="date"
              value={localStart}
              min={minDate}
              max={localEnd || today}
              onChange={(e) => setLocalStart(e.target.value)}
              style={{
                height: '34px', padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                background: 'var(--surface-1)', color: 'var(--text-primary)',
                outline: 'none', minWidth: '140px',
              }}
            />
          </div>

          {/* Arrow separator */}
          <div style={{
            height: '34px', display: 'flex', alignItems: 'center',
            color: 'var(--text-muted)', fontSize: '16px', paddingBottom: '0',
          }}>→</div>

          {/* To */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              To
            </label>
            <input
              type="date"
              value={localEnd}
              min={minDate}
              max={today}
              onChange={(e) => setLocalEnd(e.target.value)}
              style={{
                height: '34px', padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                background: 'var(--surface-1)', color: 'var(--text-primary)',
                outline: 'none', minWidth: '140px',
              }}
            />
          </div>

          {/* Apply */}
          <button
            type="button"
            onClick={() => { if (localStart && localEnd) onCustomApply({ start: localStart, end: localEnd }) }}
            disabled={!localStart || !localEnd}
            style={{
              height: '34px', padding: '0 20px',
              background: localStart && localEnd ? 'var(--brand)' : 'var(--surface-2)',
              color: localStart && localEnd ? '#fff' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600,
              cursor: localStart && localEnd ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            Apply
          </button>
        </div>
      )}

      <div className="dash-table-scroll"><div className="dash-table-min">
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 90px 1.4fr 1.4fr 1.4fr 100px 100px',
        gap: '12px', padding: '10px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--surface-1)',
      }}>
        <span style={th}>Member</span>
        <span style={th}>Joined</span>
        <span style={th}>Office</span>
        <span style={th}>Remote</span>
        <span style={th}>Absent</span>
        <span style={{ ...th, textAlign: 'right' }}>Total Hrs</span>
        <span style={{ ...th, textAlign: 'right' }}>Avg/Day</span>
      </div>

      {loading ? (
        [1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 90px 1.4fr 1.4fr 1.4fr 100px 100px',
            gap: '12px', alignItems: 'center', padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ ...sk, width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
              <div>
                <div style={{ ...sk, height: '12px', width: '90px', marginBottom: '5px' }} />
                <div style={{ ...sk, height: '10px', width: '120px' }} />
              </div>
            </div>
            <div style={{ ...sk, height: '12px', width: '60px' }} />
            <div style={{ ...sk, height: '8px', width: '100%' }} />
            <div style={{ ...sk, height: '8px', width: '100%' }} />
            <div style={{ ...sk, height: '8px', width: '100%' }} />
            <div style={{ ...sk, height: '12px', width: '60px', marginLeft: 'auto' }} />
            <div style={{ ...sk, height: '12px', width: '60px', marginLeft: 'auto' }} />
          </div>
        ))
      ) : members.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {search.trim() ? 'No members match your search.' : 'No attendance data for this period.'}
          </p>
        </div>
      ) : (
        <div className="no-scrollbar" style={{ maxHeight: '580px', overflowY: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
        {members.map((m) => {
          const name = m.full_name ?? m.email
          return (
            <Link key={m.member_id} href={`/ws/${slug}/members/${m.user_id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 90px 1.4fr 1.4fr 1.4fr 100px 100px',
                  gap: '12px', alignItems: 'center',
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    background: 'color-mix(in srgb, var(--brand) 12%, transparent)',
                    color: 'var(--brand)',
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {getInitials(name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                      color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.full_name ? m.email : m.role}
                    </div>
                  </div>
                </div>
                {/* Joined date */}
                <div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {m.joined_at.slice(8, 10)}{' '}
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m.joined_at.slice(5, 7)) - 1]}
                  </div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {m.joined_at.slice(0, 4)}
                  </div>
                </div>
                <div>
                  <StatBar value={m.office_days} max={totalDays} color="var(--teal)" />
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>office</div>
                </div>
                <div>
                  <StatBar value={m.remote_days} max={totalDays} color="var(--amber)" />
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>remote</div>
                </div>
                <div>
                  <StatBar value={m.absent_days} max={totalDays} color="var(--danger)" />
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>absent</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmtHours(m.total_hours)}
                  </div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>total</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmtHours(m.avg_hours_per_day)}
                  </div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>avg/day</div>
                  {m.multi_loc_days > 0 && (
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: 'var(--amber)', marginTop: '2px' }}>
                      {m.multi_loc_days} multi-loc
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
        </div>
      )}

      {members.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            Multi-loc: days where checkout was recorded more than 1km from check-in location (field force / site visits).
          </p>
        </div>
      )}
      </div></div>
    </div>
  )
}
