const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function getInitials(s: string): string {
  const parts = s.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

/** 'YYYY-MM-DD' -> 'D Mon' for compact display in the celebrations widget. */
export function fmtShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d, 10)} ${MONTH_NAMES[parseInt(m, 10) - 1]}`
}

/** 'YYYY-MM-DD','YYYY-MM-DD' -> '18–19 Jul' (same day collapses to a single 'D Mon'). */
export function fmtDateRange(start: string, end: string): string {
  if (start === end) return fmtShortDate(start)
  const [, sm, sd] = start.split('-')
  const [, em, ed] = end.split('-')
  return sm === em
    ? `${parseInt(sd, 10)}–${parseInt(ed, 10)} ${MONTH_NAMES[parseInt(em, 10) - 1]}`
    : `${fmtShortDate(start)} – ${fmtShortDate(end)}`
}

const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
export function avatarColor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
