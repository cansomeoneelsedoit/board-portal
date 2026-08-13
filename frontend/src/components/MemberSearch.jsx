import { useEffect, useRef, useState } from 'react'
import { Search, Loader2, Check, X } from 'lucide-react'
import api from '../lib/api'
import { Avatar } from './ui'
import { humanise } from '../lib/format'

/**
 * Type-ahead picker over the people in the directory.
 *
 * Multi-select, because inviting a board is one action rather than nine. Passing
 * `excludeMeetingId` asks the server to leave out anyone already invited, so the
 * list never offers a duplicate.
 */
export default function MemberSearch({
  excludeMeetingId = null,
  onConfirm,
  confirmLabel = 'Add',
  placeholder = 'Search by name or email…',
  // Optional per-person note next to a result — e.g. "served before, retired
  // 2023" when picking members for a board they once sat on.
  annotate = null,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [picked, setPicked] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const debounce = useRef(null)

  useEffect(() => {
    clearTimeout(debounce.current)
    // Wait for a pause in typing rather than firing per keystroke.
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = { take: 8 }
        if (query.trim()) params.search = query.trim()
        if (excludeMeetingId) params.notInMeeting = excludeMeetingId
        const { data } = await api.get('/users', { params })
        setResults(data)
        setError(null)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(debounce.current)
  }, [query, excludeMeetingId])

  const toggle = (user) =>
    setPicked((p) => (p.some((u) => u.id === user.id) ? p.filter((u) => u.id !== user.id) : [...p, user]))

  const confirm = async () => {
    if (!picked.length) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(picked.map((u) => u.id))
      setPicked([])
      setQuery('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const isPicked = (u) => picked.some((p) => p.id === u.id)

  return (
    <div className="space-y-3">
      <div className="bp-card flex items-center gap-2 px-3 py-2">
        <Search size={15} className="bp-subtle shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {loading && <Loader2 size={14} className="animate-spin bp-subtle" />}
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((u) => (
            <span
              key={u.id}
              className="bp-badge bp-badge--info gap-1.5 py-1"
              style={{ paddingLeft: '0.5rem' }}
            >
              {u.name}
              <button onClick={() => toggle(u)} title="Remove"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--bp-danger-fg)' }}>{error}</p>}

      <div className="bp-card bp-divide max-h-64 overflow-y-auto">
        {results.length === 0 && !loading && (
          <p className="p-3 text-sm bp-muted">
            {query ? 'Nobody matches that.' : 'Everyone is already invited.'}
          </p>
        )}
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => toggle(u)}
            className="w-full text-left p-3 flex items-center gap-3 transition-colors hover:bg-[var(--bp-neutral-bg)]"
          >
            <Avatar name={u.name} initials={u.initials} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium truncate">{u.name}</span>
              <span className="block text-xs bp-muted truncate">
                {u.email} · {humanise(u.role)}
              </span>
            </span>
            {annotate?.(u)}
            {isPicked(u) && <Check size={16} style={{ color: 'var(--bp-success-fg)' }} />}
          </button>
        ))}
      </div>

      <button
        onClick={confirm}
        disabled={!picked.length || busy}
        className="bp-btn bp-btn-primary w-full justify-center"
      >
        {busy ? 'Working…' : `${confirmLabel}${picked.length ? ` ${picked.length}` : ''}`}
      </button>
    </div>
  )
}
