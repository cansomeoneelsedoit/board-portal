import { useEffect, useState } from 'react'
import { UserPlus, Trash2, Plus, Users, Building2, ShieldAlert, X, Pencil, Check } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { humanise } from '../lib/format'
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
      <BoardMembers />
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
            <p className="text-sm font-medium truncate">{b.name}</p>
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

/* ---------------------------------------------------------------- members */

function BoardMembers() {
  const { data, loading, error, refetch } = useApi('/board-members')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const members = data || []

  const add = async (userIds) => {
    await api.post('/board-members', { userIds })
    setAdding(false)
    await refetch()
  }

  const setRole = async (member, role) => {
    setBusy(member.id)
    try {
      await api.put(`/board-members/${member.id}`, { role })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (member) => {
    setBusy(member.id)
    try {
      await api.delete(`/board-members/${member.id}`)
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Users size={16} /> Board members ({members.length})</span>}
        action={
          <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
            {adding ? <X size={14} /> : <UserPlus size={14} />} {adding ? 'Close' : 'Appoint'}
          </button>
        }
      />

      {adding && (
        <div className="p-4" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <MemberSearch onConfirm={add} confirmLabel="Appoint" />
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

      {members.length > 0 && (
        <div className="bp-divide">
          {members.map((m) => (
            <div key={m.id} className="p-3 flex items-center gap-3">
              <Avatar name={m.user?.name} initials={m.user?.initials} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.user?.name || 'Unknown'}</p>
                <p className="text-xs bp-muted truncate">{m.user?.email}</p>
              </div>
              <select
                value={m.role}
                onChange={(e) => setRole(m, e.target.value)}
                disabled={busy === m.id}
                className="bp-input text-xs py-1"
              >
                {BOARD_ROLES.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
              </select>
              <button
                onClick={() => remove(m)}
                disabled={busy === m.id}
                className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5"
                title="Stand down"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
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
          <span className="flex items-center gap-2.5">
            <Avatar name={u.name} initials={u.initials} size={26} />
            <span className="font-medium">{u.name}</span>
          </span>
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
