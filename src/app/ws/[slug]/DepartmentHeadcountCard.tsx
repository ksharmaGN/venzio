'use client'

import type { DepartmentHeadcount } from '@/lib/db/queries/employees-list'
import { WidgetCard } from './WidgetCard'

const DEPARTMENT_COLORS = ['#1d9e75', '#0EA5E9', '#00D4AA', '#8B5CF6', '#F59E0B', '#EF4444', '#7aab92']

export function DepartmentHeadcountCard({ data, loading }: { data: DepartmentHeadcount[]; loading: boolean }) {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '4px',
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <WidgetCard title="Headcount by department">
      {loading ? (
        [1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: '14px' }}>
            <div style={{ ...sk, height: '11px', width: '100px', marginBottom: '6px' }} />
            <div style={{ ...sk, height: '8px', width: '100%' }} />
          </div>
        ))
      ) : data.length === 0 ? (
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          No employee records yet.
        </div>
      ) : (
        data.map((d, i) => {
          const pct = Math.round((d.count / maxCount) * 100)
          const color = DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length]
          return (
            <div key={d.department} style={{ marginBottom: i < data.length - 1 ? '12px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {d.department}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {d.count}
                </span>
              </div>
              <div style={{ height: '8px', background: '#e4f5ec', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )
        })
      )}
    </WidgetCard>
  )
}
