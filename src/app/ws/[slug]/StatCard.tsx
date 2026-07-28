'use client'

export function StatCard({
  title, value, sub, accentColor, neutralValue, icon, onClick, className,
}: {
  title: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** Accent used for the top border + icon badge, and (unless neutralValue) the big number. */
  accentColor: string
  /** When true, the big number uses the neutral navy ink instead of the accent color. */
  neutralValue?: boolean
  icon: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${accentColor}`,
        borderRadius: '12px',
        padding: '17px',
        flex: '1 1 0',
        minWidth: '140px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.boxShadow = `0 4px 16px color-mix(in srgb, ${accentColor} 15%, transparent)` } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.boxShadow = '' } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {title}
        </span>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, color: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: '31px', fontWeight: 700, lineHeight: 1,
          marginTop: '10px',
          color: neutralValue ? 'var(--navy)' : accentColor,
        }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
