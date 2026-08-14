import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Trash2, Users, X } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { humanise, fmtDate } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState } from './ui'
import MemberSearch from './MemberSearch'

const BOARD_ROLES = ['CHAIR', 'SECRETARY', 'TREASURER', 'DIRECTOR', 'COMMITTEE_MEMBER', 'OBSERVER', 'INVITEE', 'GUEST']
const END_STATUSES = ['RESIGNED', 'RETIRED', 'TERM_ENDED', 'REMOVED', 'DECEASED']

/**
 * Who sits on ONE board — the service register, scoped to the board whose
 * settings page this card sits on.
 *
 * Standing someone down ends their tenure rather than deleting it, so past
 * members stay on the record with their status, remain choosable, and their
 * profile reads like a service history.
 */
export default function BoardMembersCard({ boardId }) {
  const { data, loading, error, refetch } = useApi(boardId ? `/board-members?boardId=${boardId}` : null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const members = data || []
  const current = members.filter((m) => !m.endedAt)
  const past = members.filter((m) => m.endedAt)
  const pastByUser = new Map(past.map((m) => [m.userId, m]))

  const run = async (id, fn) => {
    setBusy(id)
    setNotice(null)
    try {
      await fn()
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const add = async (userIds) => {
    await api.post('/board-members', { userIds, boardId })
    setAdding(false)
    await refetch()
  }

  const setRole = (m, role) => run(m.id, () => api.put(`/board-members/${m.id}`, { role }))
  const standDown = (m, status) => run(m.id, () => api.put(`/board-members/${m.id}`, { status }))
  const reappoint = (m) =>
    run(m.id, () => api.post('/board-members', { userIds: [m.userId], boardId: m.boardId, role: m.role }))
  const erase = (m) => run(m.id, () => api.delete(`/board-members/${m.id}`))

  const since = (m) => (m.startedAt ? fmtDate(m.startedAt) : null)

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Users size={16} /> Members ({current.length})</span>}
        action={
          <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
            {adding ? <X size={14} /> : <UserPlus size={14} />} {adding ? 'Close' : 'Appoint'}
          </button>
        }
      />

      {adding && (
        <div className="p-4" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <MemberSearch
            onConfirm={add}
            confirmLabel="Appoint"
            annotate={(u) =>
              pastByUser.has(u.id) ? (
                <Badge tone="warning">
                  served before · {humanise(pastByUser.get(u.id).status)}
                </Badge>
              ) : null
            }
          />
        </div>
      )}

      {notice && (
        <p className="px-4 pt-3 text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
      )}

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && members.length === 0}
        emptyLabel="Nobody appointed yet"
        onRetry={refetch}
      />

      {current.length > 0 && (
        <div className="bp-divide">
          {current.map((m) => (
            <div key={m.id} className="p-3 flex items-center gap-3 flex-wrap">
              <Avatar name={m.user?.name} initials={m.user?.initials} size={32} />
              <div className="min-w-0 flex-1">
                <Link to={`/people/${m.userId}`} className="text-sm font-medium truncate block hover:underline"
                  style={{ color: 'var(--bp-primary)' }} title="Open their profile">
                  {m.user?.name || 'Unknown'}
                </Link>
                <p className="text-xs bp-muted truncate">
                  {m.user?.email}
                  {since(m) ? ` · since ${since(m)}` : ''}
                </p>
              </div>
              <select
                value={m.role}
                onChange={(e) => setRole(m, e.target.value)}
                disabled={busy === m.id}
                className="bp-input text-xs py-1"
              >
                {BOARD_ROLES.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
              </select>
              <select
                value=""
                onChange={(e) => e.target.value && standDown(m, e.target.value)}
                disabled={busy === m.id}
                className="bp-input text-xs py-1"
                title="End this tenure — it stays on their record"
              >
                <option value="">Stand down…</option>
                {END_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
              </select>
              <button
                onClick={() => erase(m)}
                disabled={busy === m.id}
                className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5"
                title="Remove this row entirely — only for rows added by mistake"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide bp-subtle">
            Served before
          </p>
          <div className="bp-divide">
            {past.map((m) => (
              <div key={m.id} className="p-3 flex items-center gap-3 flex-wrap">
                <Avatar name={m.user?.name} initials={m.user?.initials} size={32} />
                <div className="min-w-0 flex-1">
                  <Link to={`/people/${m.userId}`} className="text-sm font-medium truncate block hover:underline"
                    style={{ color: 'var(--bp-primary)' }} title="Open their profile">
                    {m.user?.name || 'Unknown'}
                  </Link>
                  <p className="text-xs bp-muted truncate">
                    {humanise(m.role)}
                    {m.startedAt ? ` · ${fmtDate(m.startedAt)}` : ''} – {fmtDate(m.endedAt)}
                  </p>
                </div>
                <Badge tone="danger">{humanise(m.status)}</Badge>
                <button
                  onClick={() => reappoint(m)}
                  disabled={busy === m.id}
                  className="bp-btn bp-btn-secondary"
                  title="Appoint them again — a new tenure alongside the old one"
                >
                  <UserPlus size={13} /> Reappoint
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
