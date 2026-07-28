'use client'

export function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid rgba(29,158,117,0.18)',
      borderRadius: '16px',
      padding: '18px 20px',
      height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 700,
        color: 'var(--text-primary)', marginBottom: '14px',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
