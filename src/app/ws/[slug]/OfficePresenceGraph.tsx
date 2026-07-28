'use client'

import { useState } from 'react'
import { Activity } from 'lucide-react'
import type { InsightBucket } from '@/app/api/ws/[slug]/insights/route'

export function OfficePresenceGraph({ buckets, loading }: { buckets: InsightBucket[]; loading: boolean }) {
  const [hovered, setHovered] = useState<{ x: number; y: number; label: string; count: number } | null>(null)

  const hourBuckets = [...buckets].sort((a, b) => parseInt(a.key) - parseInt(b.key))
  const rawMax = Math.max(...hourBuckets.map((b) => b.unique_users), 0)
  const yMax = Math.max(rawMax, 4)
  const tickStep = Math.max(1, Math.ceil(yMax / 4))

  const W = 600, H = 190, padL = 36, padR = 16, padT = 16, padB = 40
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const pts = hourBuckets.map((b, i) => {
    const x = padL + (i / Math.max(hourBuckets.length - 1, 1)) * chartW
    const y = padT + chartH - (b.unique_users / yMax) * chartH
    const h = parseInt(b.key, 10)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return { x, y, label: `${h12}${ampm}`, count: b.unique_users, showLabel: h % 2 === 0 }
  })

  const smoothLinePath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    const d: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`]
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(i + 2, points.length - 1)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
    }
    return d.join(' ')
  }
  const pathD = smoothLinePath(pts)
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`
    : ''
  const yTicks = Array.from({ length: Math.floor(yMax / tickStep) + 1 }, (_, i) => ({
    val: i * tickStep,
    y: padT + chartH - ((i * tickStep) / yMax) * chartH,
  }))

  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid rgba(29,158,117,0.18)',
      borderRadius: '16px', padding: '18px 20px', height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: 'rgba(29,158,117,0.12)', color: '#1d9e75',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Activity size={14} />
        </div>
        <div>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Office Presence
          </span>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: '#7aab92', marginLeft: '8px' }}>
            people in office by hour · today
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</span>
        </div>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible', display: 'block', cursor: 'crosshair' }}
          aria-label="Office presence by hour"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const svgX = ((e.clientX - rect.left) / rect.width) * W
            if (pts.length === 0) return
            const nearest = pts.reduce((a, b) => Math.abs(b.x - svgX) < Math.abs(a.x - svgX) ? b : a)
            setHovered(nearest)
          }}
          onMouseLeave={() => setHovered(null)}
        >
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y.toFixed(1)} x2={W - padR} y2={t.y.toFixed(1)} stroke="rgba(29,158,117,0.16)" strokeWidth="1" strokeDasharray="4 3" />
              <text x={padL - 6} y={(t.y + 4).toFixed(1)} textAnchor="end" fontSize="10" fill="#7aab92" fontFamily="JetBrains Mono, monospace">{t.val}</text>
            </g>
          ))}
          {areaD && <path d={areaD} fill="color-mix(in srgb, #1d9e75 10%, transparent)" />}
          {pathD && <path d={pathD} fill="none" stroke="#1d9e75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {hovered && (
            <g>
              <line x1={hovered.x.toFixed(1)} y1={padT.toFixed(1)} x2={hovered.x.toFixed(1)} y2={(padT + chartH).toFixed(1)} stroke="#1d9e75" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hovered.x.toFixed(1)} cy={hovered.y.toFixed(1)} r="5" fill="#1d9e75" stroke="var(--surface-0)" strokeWidth="2" />
              <rect x={(hovered.x - 28).toFixed(1)} y={(hovered.y - 34).toFixed(1)} width="56" height="22" rx="5" fill="var(--navy)" opacity="0.9" />
              <text x={hovered.x.toFixed(1)} y={(hovered.y - 18).toFixed(1)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Plus Jakarta Sans, sans-serif">
                {hovered.count} {hovered.count === 1 ? 'person' : 'people'}
              </text>
            </g>
          )}
          {pts.map((p, i) => (
            p.showLabel && (
              <text key={i} x={p.x.toFixed(1)} y={(padT + chartH + 18).toFixed(1)} textAnchor="middle" fontSize="9" fill="#7aab92" fontFamily="Plus Jakarta Sans, sans-serif">
                {p.label}
              </text>
            )
          ))}
          <line x1={padL} y1={padT} x2={padL} y2={(padT + chartH)} stroke="rgba(29,158,117,0.25)" strokeWidth="1" />
          <line x1={padL} y1={(padT + chartH)} x2={W - padR} y2={(padT + chartH)} stroke="rgba(29,158,117,0.25)" strokeWidth="1" />
        </svg>
      )}
    </div>
  )
}
