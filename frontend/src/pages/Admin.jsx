import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Trash2, Plus, Users, Building2, ShieldAlert, X, Pencil, Check } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { humanise, fmtDate } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, PageHeader } from '../components/ui'
import MemberSearch from '../components/MemberSearch'
import SharePointSetup from '../components/SharePointSetup'
import BoardPackBrowser from '../components/BoardPackBrowser'
import { useSession } from '../lib/useSession'

const BOARD_ROLES = ['CHAIR', 'SECRETARY', 'TREASURER', 'DIRECTOR', 'COMMITTEE_MEMBER', 'OBSERVER', 'INVITEE', 'GUEST']

/**
 * Board setup — everything an administrator configures in one place.
 *
 * Members never see this page (it is not in their navigation), and every action
 * on it is guarded server-side as well, so hiding it is convenience rather than
 * the control itself.
 */
export default function Admin() {
  const { role, capabilities, loading: sessionLoading } = useSession()

  if (sessionLoading) return <DataState loading />

  if (!capabilities?.manageMeetings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Board Settings" />
        <Card className="p-6 flex items-start gap-3">
          <span className="bp-chip bp-chip--warning w-10 h-10 shrink-0"><ShieldAlert size={18} /></span>
          <div className="text-sm">
            <p className="font-medium">You do not have board administrator access</p>
            <p className="bp-muted mt-1">
              Signed in as {humanise(role)}. Ask a board administrator if you need to change these
              settings.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board Settings"
        subtitle="Board details, who sits on it, and where the papers live"
      />
      <Bodies />
      <Directory />
      <Card>
        <CardHeader
          title="Library"
          action={<span className="text-xs bp-muted">The whole SharePoint library — members see packs per meeting</span>}
        />
        <BoardPackBrowser emptyLabel="Link a SharePoint folder below to browse the library" />
      </Card>
      <SharePointSetup />
    </div>
  )
}

/* ----------------------------------------------------------------- bodies */

const KINDS = [
  { id: 'BOARD', label: 'Board' },
  { id: 'COMMITTEE', label: 'Committee' },
  { id: 'SUBCOMMITTEE', label: 'Sub-committee' },
]

/**
 * Boards and committees.
 *
 * A committee is a board with a parent, so one list covers both and the
 * hierarchy is visible at a glance.
 */
function Bodies() {
  const { data, loading, error, refetch } = useApi('/boards')
  const [form, setForm] = useState({ name: '', shortName: '', kind: 'BOARD', parentId: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(null)

  const bodies = data || []
  const parents = bodies.filter((b) => b.kind === 'BOARD' || b.kind === 'COMMITTEE')

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      await api.post('/boards', { ...form, parentId: form.parentId || null })
      setForm({ name: '', shortName: '', kind: 'BOARD', parentId: '', description: '' })
      setNotice({ tone: 'success', text: 'Created' })
      await refetch()
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (body) => {
    setBusy(body.id)
    setNotice(null)
    try {
      await api.delete(`/boards/${body.id}`)
      await refetch()
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Building2 size={16} /> Boards & committees ({bodies.length})</span>}
        action={<span className="text-xs bp-muted">Conflicts are declared against one of these</span>}
      />

      <form onSubmit={create} className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
        <label className="block lg:col-span-2">
          <span className="text-sm font-medium">Name</span>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="bp-input w-full mt-1" placeholder="Audit & Risk Committee" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Short name</span>
          <input value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
            className="bp-input w-full mt-1" placeholder="ARC" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Type</span>
          <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            className="bp-input w-full mt-1">
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        {form.kind !== 'BOARD' ? (
          <label className="block">
            <span className="text-sm font-medium">Reports to</span>
            <select required value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className="bp-input w-full mt-1">
              <option value="">Choose…</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        ) : <div />}
        <button type="submit" disabled={saving} className="bp-btn bp-btn-primary lg:col-start-5">
          <Plus size={15} /> {saving ? 'Creating…' : 'Create'}
        </button>
      </form>

      {notice && (
        <p className="px-4 pt-3 text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
      )}

      <DataState loading={loading} error={error}
        empty={!loading && !error && bodies.length === 0}
        emptyLabel="No boards or committees yet" onRetry={refetch} />

      {bodies.length > 0 && (
        <div className="bp-divide">
          {bodies.map((b) => (
            <BodyRow key={b.id} body={b} busy={busy} onRemove={remove} onSaved={refetch} />
          ))}
        </div>
      )}
    </Card>
  )
}

function BodyRow({ body: b, busy, onRemove, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: b.name, shortName: b.shortName || '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      await api.put(`/boards/${b.id}`, { name: draft.name, shortName: draft.shortName || null })
      setEditing(false)
      await onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-3 flex items-center gap-3">
      <span className="bp-chip bp-chip--primary w-8 h-8 shrink-0 text-xs font-semibold">
        {(b.shortName || b.name).slice(0, 3).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="bp-input text-sm py-1 flex-1 min-w-[12rem]" />
            <input value={draft.shortName} onChange={(e) => setDraft((d) => ({ ...d, shortName: e.target.value }))}
              placeholder="Short name" className="bp-input text-sm py-1 w-28" />
            {err && <span className="text-xs" style={{ color: 'var(--bp-danger-fg)' }}>{err}</span>}
          </div>
        ) : (
          <>
            <Link to={`/admin/boards/${b.id}`} className="text-sm font-medium truncate block hover:underline"
              style={{ color: 'var(--bp-primary)' }}
              title="Open this body's settings — its quorum rule, constitution and members">
              {b.name}
            </Link>
            <p className="text-xs bp-muted truncate">
              {humanise(b.kind)}
              {b.parent ? ` · reports to ${b.parent.name}` : ''}
              {` · ${b.meetingCount} meeting${b.meetingCount === 1 ? '' : 's'}`}
            </p>
          </>
        )}
      </div>
      {editing ? (
        <>
          <button onClick={save} disabled={saving} className="bp-btn bp-btn-primary" title="Save">
            <Check size={14} /> Save
          </button>
          <button onClick={() => { setEditing(false); setDraft({ name: b.name, shortName: b.shortName || '' }) }}
            className="bp-subtle hover:text-[var(--bp-fg)] p-1.5" title="Cancel">
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(true)}
            className="bp-subtle hover:text-[var(--bp-fg)] p-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onRemove(b)} disabled={busy === b.id}
            className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5" title="Remove">
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- quorum rules */

/**
 * Each body's standing quorum rule, applied automatically when a meeting is
 * scheduled for it (and still overridable on the meeting itself).
 *
 * A rule can work two ways, or both: by NUMBERS AND OFFICES (minimum count,
 * must include the Chair/Treasurer), or by NAMING PEOPLE who must be present
 * regardless of office. Ticking members below adds them as named requirements.
 */
function QuorumRules() {
  const { data: bodies } = useApi('/boards')
  const [boardId, setBoardId] = useState('')
  const board = (bodies || []).find((b) => b.id === boardId) || (bodies || [])[0]
  const membersPath = board ? `/board-members?boardId=${board.id}` : null
  const { data: members } = useApi(membersPath)

  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  // Load the selected board's rule into the editor whenever the board changes.
  useEffect(() => {
    if (!board) return
    const roles = String(board.quorumRequiredRoles || '').toUpperCase()
    const ex = String(board.quorumExOfficioRoles || '').toUpperCase()
    setDraft({
      boardId: board.id,
      minimum: board.quorumMinimum ?? 4,
      requireChair: roles.includes('CHAIR'),
      requireTreasurer: roles.includes('TREASURER'),
      secretaryExOfficio: ex.includes('SECRETARY'),
      mandatory: new Set(String(board.quorumMandatoryUserIds || '').split(',').map((s) => s.trim()).filter(Boolean)),
    })
    setNotice(null)
  }, [board?.id, board?.quorumMinimum, board?.quorumRequiredRoles, board?.quorumMandatoryUserIds])

  const toggleMandatory = (userId) =>
    setDraft((d) => {
      const next = new Set(d.mandatory)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return { ...d, mandatory: next }
    })

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setNotice(null)
    try {
      await api.put(`/boards/${draft.boardId}`, {
        quorumMinimum: Number(draft.minimum) || 1,
        quorumRequiredRoles: [
          draft.requireChair ? 'CHAIR' : null,
          draft.requireTreasurer ? 'TREASURER' : null,
        ].filter(Boolean).join(','),
        quorumExOfficioRoles: draft.secretaryExOfficio ? 'SECRETARY' : '',
        quorumMandatoryUserIds: [...draft.mandatory].join(','),
      })
      setNotice({ tone: 'success', text: 'Quorum rule saved — new meetings for this body start from it.' })
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const currentMembers = (members || []).filter((m) => !m.endedAt)

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><ShieldAlert size={16} /> Quorum rules</span>}
        action={
          <select
            value={board?.id || ''}
            onChange={(e) => setBoardId(e.target.value)}
            className="bp-input text-xs py-1.5"
            title="Which body this rule belongs to"
          >
            {(bodies || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        }
      />

      {draft && (
        <div className="p-4 space-y-3">
          <p className="text-xs bp-muted">
            Applied automatically when a meeting is scheduled for {board?.name} — each sitting can still
            override it on the schedule form.
          </p>

          <label className="flex items-center justify-between gap-3 max-w-md">
            <span className="text-sm">Minimum counting members</span>
            <input type="number" min="1" max="50" value={draft.minimum}
              onChange={(e) => setDraft((d) => ({ ...d, minimum: e.target.value }))}
              className="bp-input w-20 text-center" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.requireChair}
              onChange={(e) => setDraft((d) => ({ ...d, requireChair: e.target.checked }))} />
            Must include the Chair
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.requireTreasurer}
              onChange={(e) => setDraft((d) => ({ ...d, requireTreasurer: e.target.checked }))} />
            Must include the Treasurer
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.secretaryExOfficio}
              onChange={(e) => setDraft((d) => ({ ...d, secretaryExOfficio: e.target.checked }))} />
            Secretary attends ex officio (not counted)
          </label>

          <div>
            <p className="text-sm font-medium mt-2">Named members who must be present</p>
            <p className="text-xs bp-muted mb-2">
              For rules that name people rather than offices — tick anyone whose presence is required.
            </p>
            {currentMembers.length === 0 && (
              <p className="text-sm bp-muted">Nobody is appointed to this body yet.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {currentMembers.map((m) => (
                <label key={m.id}
                  className="flex items-center gap-2 text-sm bp-card px-2.5 py-1.5 cursor-pointer"
                  style={draft.mandatory.has(m.userId)
                    ? { background: 'var(--bp-success-bg)', color: 'var(--bp-success-fg)' }
                    : undefined}>
                  <input type="checkbox" checked={draft.mandatory.has(m.userId)}
                    onChange={() => toggleMandatory(m.userId)} />
                  {m.user?.name}
                </label>
              ))}
            </div>
          </div>

          {notice && (
            <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
          )}

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="bp-btn bp-btn-primary">
              {saving ? 'Saving…' : 'Save quorum rule'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- members */

const END_STATUSES = ['RESIGNED', 'RETIRED', 'TERM_ENDED', 'REMOVED', 'DECEASED']

/**
 * Who sits on each board and committee — the service register.
 *
 * Standing someone down ends their tenure rather than deleting it, so past
 * members stay on the record with their status, remain choosable for that
 * board, and their profile reads like a service history.
 */
function BoardMembers() {
  const { data: bodies } = useApi('/boards')
  const [boardId, setBoardId] = useState('')
  const membersPath = boardId ? `/board-members?boardId=${boardId}` : '/board-members'
  const { data, loading, error, refetch } = useApi(membersPath)
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
    await api.post('/board-members', { userIds, ...(boardId ? { boardId } : {}) })
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
        title={<span className="flex items-center gap-2"><Users size={16} /> Board members ({current.length})</span>}
        action={
          <div className="flex items-center gap-2">
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="bp-input text-xs py-1.5"
              title="Which board or committee"
            >
              {(bodies || []).map((b, i) => (
                <option key={b.id} value={i === 0 ? '' : b.id}>{b.name}</option>
              ))}
            </select>
            <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
              {adding ? <X size={14} /> : <UserPlus size={14} />} {adding ? 'Close' : 'Appoint'}
            </button>
          </div>
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

/* -------------------------------------------------------------- directory */

function Directory() {
  const { data, loading, error, refetch } = useApi('/users')
  const [form, setForm] = useState({ name: '', email: '', role: 'DIRECTOR' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const users = data || []

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      await api.post('/users', form)
      setForm({ name: '', email: '', role: 'DIRECTOR' })
      setNotice({ tone: 'success', text: 'Added' })
      await refetch()
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Users size={16} /> People ({users.length})</span>}
        action={<span className="text-xs bp-muted">Anyone who can be invited to a meeting</span>}
      />

      <form onSubmit={create} className="p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="bp-input w-full mt-1"
            placeholder="Margaret Whitlock"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="bp-input w-full mt-1"
            placeholder="name@example.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Role</span>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="bp-input mt-1"
          >
            {BOARD_ROLES.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
          </select>
        </label>
        <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
          <UserPlus size={15} /> {saving ? 'Adding…' : 'Add'}
        </button>
      </form>

      {notice && (
        <p className="px-4 pt-3 text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
      )}

      <DataState loading={loading} error={error} onRetry={refetch} />

      {users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="bp-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <PersonRow key={u.id} person={u} onSaved={refetch} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}


function PersonRow({ person: u, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: u.name, email: u.email, role: u.role })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      await api.put(`/users/${u.id}`, draft)
      setEditing(false)
      await onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <tr>
        <td>
          <Link to={`/people/${u.id}`} className="flex items-center gap-2.5 hover:underline"
            title="Open their profile — service history and disclosures">
            <Avatar name={u.name} initials={u.initials} size={26} />
            <span className="font-medium" style={{ color: 'var(--bp-primary)' }}>{u.name}</span>
          </Link>
        </td>
        <td className="bp-muted">{u.email}</td>
        <td><Badge status={u.role} tone="neutral" /></td>
        <td>
          <button onClick={() => setEditing(true)} className="bp-subtle hover:text-[var(--bp-fg)] p-1.5" title="Edit">
            <Pencil size={14} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="bp-input text-sm py-1 w-full" />
      </td>
      <td>
        <input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          className="bp-input text-sm py-1 w-full" />
        {err && <p className="text-xs mt-1" style={{ color: 'var(--bp-danger-fg)' }}>{err}</p>}
      </td>
      <td>
        <select value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          className="bp-input text-sm py-1">
          {BOARD_ROLES.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
        </select>
      </td>
      <td>
        <span className="flex items-center gap-1">
          <button onClick={save} disabled={saving} className="bp-btn bp-btn-primary" title="Save">
            <Check size={13} />
          </button>
          <button onClick={() => setEditing(false)} className="bp-subtle p-1.5" title="Cancel">
            <X size={13} />
          </button>
        </span>
      </td>
    </tr>
  )
}
