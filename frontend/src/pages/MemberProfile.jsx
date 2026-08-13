import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft, Briefcase, Building2, Mail, Pencil, Phone, Plus, ShieldAlert, X, Check, UserPlus,
} from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../lib/useSession'
import { fmtDate, humanise } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, Field, PageHeader } from '../components/ui'

const BOARD_ROLES = ['CHAIR', 'SECRETARY', 'TREASURER', 'DIRECTOR', 'COMMITTEE_MEMBER', 'OBSERVER', 'INVITEE', 'GUEST']
const END_STATUSES = ['RESIGNED', 'RETIRED', 'TERM_ENDED', 'REMOVED', 'DECEASED']

/**
 * One person, one profile.
 *
 * Everything about a member in one place: who they are, every board and
 * committee they serve or have served on (their service history — ending a
 * tenure keeps it here), and what they hold on the register of interests.
 */
export default function MemberProfile() {
  const { id } = useParams()
  const { capabilities } = useSession()
  const { data: user, loading, error, refetch } = useApi(`/users/${id}`)
  const { data: tenures, refetch: refetchTenures } = useApi(`/board-members/user/${id}`)
  const { data: register } = useApi(`/register?userId=${id}`)
  const [editing, setEditing] = useState(false)

  const canManage = capabilities?.manageMeetings
  const interests = register?.members?.[0]?.interests || []

  if (loading || error || !user) {
    return <DataState loading={loading} error={error} onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      <Link to="/admin" className="bp-link inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} /> Back to Board Settings
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={user.name} initials={user.initials} size={44} />
            {user.name}
          </span>
        }
        subtitle={[user.title, user.organisation].filter(Boolean).join(' · ') || humanise(user.role)}
        actions={canManage && (
          <button onClick={() => setEditing((e) => !e)} className="bp-btn bp-btn-secondary">
            {editing ? <X size={14} /> : <Pencil size={14} />} {editing ? 'Close' : 'Edit profile'}
          </button>
        )}
      />

      {editing ? (
        <EditProfile user={user} onSaved={async () => { setEditing(false); await refetch() }} />
      ) : (
        <Card className="p-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Email">
              <a href={`mailto:${user.email}`} className="bp-link inline-flex items-center gap-1.5">
                <Mail size={14} /> {user.email}
              </a>
            </Field>
            <Field label="Phone">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} /> {user.phone || '—'}
              </span>
            </Field>
            <Field label="Title">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={14} /> {user.title || '—'}
              </span>
            </Field>
            <Field label="Organisation">
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} /> {user.organisation || '—'}
              </span>
            </Field>
          </div>
          {user.bio && <p className="text-sm bp-muted mt-4 max-w-3xl">{user.bio}</p>}
        </Card>
      )}

      <ServiceHistory userId={id} tenures={tenures || []} canManage={canManage} onChanged={refetchTenures} />

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><ShieldAlert size={16} /> Register of interests ({interests.length})</span>}
          action={<Link to="/register" className="bp-link text-xs">Open the register</Link>}
        />
        {interests.length === 0 && (
          <p className="p-4 text-sm bp-muted">Nothing disclosed.</p>
        )}
        {interests.length > 0 && (
          <div className="bp-divide">
            {interests.map((i) => (
              <div key={i.id} className="p-3 flex items-center gap-3 flex-wrap">
                <p className="text-sm flex-1 min-w-[12rem]">
                  {i.interest}
                  {i.category ? <span className="bp-subtle"> · {humanise(i.category)}</span> : null}
                </p>
                {i.disclosedToAll ? (
                  <Badge tone="info">All boards & committees</Badge>
                ) : (
                  (i.boards || []).map((b) => (
                    <Badge key={b.id} tone="neutral">{b.shortName || b.name}</Badge>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function EditProfile({ user, onSaved }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'DIRECTOR',
    phone: user.phone || '',
    title: user.title || '',
    organisation: user.organisation || '',
    bio: user.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await api.put(`/users/${user.id}`, {
        ...form,
        phone: form.phone || null,
        title: form.title || null,
        organisation: form.organisation || null,
        bio: form.bio || null,
      })
      await onSaved()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium">Name</span>
            <input required value={form.name} onChange={set('name')} className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-sm font-medium">Email</span>
            <input required type="email" value={form.email} onChange={set('email')} className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-sm font-medium">Phone</span>
            <input value={form.phone} onChange={set('phone')} className="bp-input w-full mt-1" placeholder="04xx xxx xxx" /></label>
          <label className="block"><span className="text-sm font-medium">Default role</span>
            <select value={form.role} onChange={set('role')} className="bp-input w-full mt-1">
              {BOARD_ROLES.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
            </select></label>
          <label className="block"><span className="text-sm font-medium">Title</span>
            <input value={form.title} onChange={set('title')} className="bp-input w-full mt-1" placeholder="Grand Registrar" /></label>
          <label className="block"><span className="text-sm font-medium">Organisation / Lodge</span>
            <input value={form.organisation} onChange={set('organisation')} className="bp-input w-full mt-1" placeholder="Lodge Reynell 243" /></label>
        </div>
        <label className="block"><span className="text-sm font-medium">Bio / notes</span>
          <textarea value={form.bio} onChange={set('bio')} rows={3} className="bp-input w-full mt-1" /></label>
        {err && <p className="text-sm" style={{ color: 'var(--bp-danger-fg)' }}>{err}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </Card>
  )
}

/**
 * Every tenure, current first. An administrator can record service directly
 * here — including historical service, dates in the past — so the register
 * reflects the real record, not just what happened inside this app.
 */
function ServiceHistory({ userId, tenures, canManage, onChanged }) {
  const { data: bodies } = useApi('/boards')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({ boardId: '', role: 'DIRECTOR', startedAt: '', endedAt: '', status: 'ACTIVE' })

  const run = async (id, fn) => {
    setBusy(id)
    setNotice(null)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const addService = async (e) => {
    e.preventDefault()
    if (!form.boardId) return
    await run('add', async () => {
      await api.post('/board-members', {
        userIds: [userId],
        boardId: form.boardId,
        role: form.role,
        startedAt: form.startedAt || undefined,
      })
      // Historical service: end it straight away with the recorded dates.
      if (form.endedAt) {
        const rows = await api.get(`/board-members/user/${userId}`)
        const created = (rows.data || []).find((t) => t.boardId === form.boardId && !t.endedAt)
        if (created) {
          await api.put(`/board-members/${created.id}`, {
            endedAt: form.endedAt,
            status: form.status === 'ACTIVE' ? 'TERM_ENDED' : form.status,
          })
        }
      }
      setAdding(false)
      setForm({ boardId: '', role: 'DIRECTOR', startedAt: '', endedAt: '', status: 'ACTIVE' })
    })
  }

  const standDown = (t, status) => run(t.id, () => api.put(`/board-members/${t.id}`, { status }))

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><UserPlus size={16} /> Service history ({tenures.length})</span>}
        action={canManage && (
          <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
            {adding ? <X size={14} /> : <Plus size={14} />} {adding ? 'Close' : 'Record service'}
          </button>
        )}
      />

      {adding && (
        <form onSubmit={addService} className="p-4 grid gap-3 sm:grid-cols-[1fr_10rem_9rem_9rem_10rem_auto] sm:items-end"
          style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <label className="block"><span className="text-xs bp-muted">Board / committee</span>
            <select required value={form.boardId} onChange={(e) => setForm((f) => ({ ...f, boardId: e.target.value }))}
              className="bp-input w-full mt-1">
              <option value="">Choose…</option>
              {(bodies || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs bp-muted">Role</span>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="bp-input w-full mt-1">
              {BOARD_ROLES.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
            </select></label>
          <label className="block"><span className="text-xs bp-muted">From</span>
            <input type="date" value={form.startedAt} onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))}
              className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-xs bp-muted">To (blank = current)</span>
            <input type="date" value={form.endedAt} onChange={(e) => setForm((f) => ({ ...f, endedAt: e.target.value }))}
              className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-xs bp-muted">How it ended</span>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="bp-input w-full mt-1" disabled={!form.endedAt}>
              <option value="ACTIVE">—</option>
              {END_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
            </select></label>
          <button type="submit" disabled={busy === 'add'} className="bp-btn bp-btn-primary">
            <Check size={14} /> Save
          </button>
        </form>
      )}

      {notice && (
        <p className="px-4 pt-3 text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
      )}

      {tenures.length === 0 && <p className="p-4 text-sm bp-muted">No service recorded yet.</p>}

      {tenures.length > 0 && (
        <div className="bp-divide">
          {tenures.map((t) => (
            <div key={t.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {t.board?.name || 'Unknown'}
                  <span className="bp-muted font-normal"> — {humanise(t.role)}</span>
                </p>
                <p className="text-xs bp-muted">
                  {t.startedAt ? fmtDate(t.startedAt) : 'Unknown start'}
                  {' – '}
                  {t.endedAt ? fmtDate(t.endedAt) : 'current'}
                </p>
              </div>
              <Badge tone={t.endedAt ? 'danger' : 'success'}>
                {t.endedAt ? humanise(t.status) : 'Serving'}
              </Badge>
              {canManage && !t.endedAt && (
                <select
                  value=""
                  onChange={(e) => e.target.value && standDown(t, e.target.value)}
                  disabled={busy === t.id}
                  className="bp-input text-xs py-1"
                  title="End this tenure — it stays on the record"
                >
                  <option value="">Stand down…</option>
                  {END_STATUSES.map((s) => <option key={s} value={s}>{humanise(s)}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
