import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

const toDate = (value) => {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

export const fmtDate = (value, pattern = 'd MMM yyyy') => {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}

export const fmtDateTime = (value) => {
  const d = toDate(value)
  return d ? format(d, "d MMM yyyy 'at' h:mmaaa") : '—'
}

export const fmtTime = (value) => {
  const d = toDate(value)
  return d ? format(d, 'h:mmaaa') : '—'
}

export const fmtRelative = (value) => {
  const d = toDate(value)
  return d ? `${formatDistanceToNow(d)} ago` : '—'
}

export const fmtBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

/** SCREAMING_SNAKE -> Title Case */
export const humanise = (value) =>
  !value ? '—' : String(value).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Maps a domain status onto one of the shared badge tones. */
export const statusTone = (status) => {
  const s = String(status || '').toUpperCase()
  if (['CARRIED', 'APPROVED', 'ACCEPTED', 'COMPLETED', 'CONNECTED', 'FOR', 'PRESENT'].includes(s)) return 'success'
  if (['PENDING', 'SCHEDULED', 'DRAFT', 'PERCEIVED'].includes(s)) return 'warning'
  if (['LOST', 'DECLINED', 'AGAINST', 'CANCELLED', 'DISCONNECTED', 'MATERIAL_PERSONAL'].includes(s)) return 'danger'
  if (['ABSTAIN', 'DECLARE_ONLY', 'IN_PERSON', 'VIDEO'].includes(s)) return 'info'
  return 'neutral'
}
