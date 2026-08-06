import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { humanise, statusTone } from '../lib/format'

/** Page title block. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="bp-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function Card({ className, children, ...rest }) {
  return (
    <div className={clsx('bp-card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action }) {
  return (
    <div
      className="px-5 py-4 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--bp-card-border)' }}
    >
      <h2 className="font-semibold text-sm">{title}</h2>
      {action}
    </div>
  )
}

/** Status pill. Pass `tone` to override the mapping in format.js. */
export function Badge({ status, tone, children }) {
  const t = tone || statusTone(status)
  return <span className={`bp-badge bp-badge--${t}`}>{children ?? humanise(status)}</span>
}

/** Dashboard-style metric tile with a pastel icon chip. */
export function StatTile({ label, value, sub, icon: Icon, tone = 'primary' }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium bp-muted">{label}</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs bp-subtle mt-1 truncate">{sub}</p>}
        </div>
        {Icon && (
          <span className={`bp-chip bp-chip--${tone} w-10 h-10 shrink-0`}>
            <Icon size={20} />
          </span>
        )}
      </div>
    </Card>
  )
}

/**
 * Renders loading / error / empty states so every page handles them the same
 * way. Returns null once there is data, letting the caller render normally.
 */
export function DataState({ loading, error, empty, emptyLabel = 'Nothing here yet', onRetry }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 bp-muted text-sm">
        <Loader2 size={18} className="animate-spin" />
        Loading…
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="bp-chip bp-chip--danger w-10 h-10"><AlertCircle size={20} /></span>
        <div>
          <p className="text-sm font-medium">Couldn’t load this data</p>
          <p className="text-xs bp-muted mt-1">{error}</p>
        </div>
        {onRetry && (
          <button className="bp-btn bp-btn-secondary" onClick={onRetry}>Try again</button>
        )}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="bp-chip bp-chip--info w-10 h-10"><Inbox size={20} /></span>
        <p className="text-sm bp-muted">{emptyLabel}</p>
      </div>
    )
  }
  return null
}

/** Small label/value pair used in detail panes. */
export function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide bp-subtle font-medium">{label}</p>
      <p className="text-sm mt-1">{children ?? '—'}</p>
    </div>
  )
}

export function Avatar({ name, initials, size = 32 }) {
  const text =
    initials ||
    (name || '?')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  return (
    <span
      className="bp-chip bp-chip--primary font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, borderRadius: '9999px' }}
      title={name}
    >
      {text}
    </span>
  )
}
