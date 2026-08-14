import { useRef, useState } from 'react'
import { UserPlus, Send, Trash2, X, FileUp } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { fmtDate, humanise } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState } from './ui'
import MemberSearch from './MemberSearch'
import { useSession } from '../lib/useSession'

const RSVPS = ['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE']

// Tint the RSVP control by its answer so the list reads at a glance:
// green = coming, red = not, amber = maybe, grey = no answer yet.
const RSVP_TONE = { ACCEPTED: 'success', DECLINED: 'danger', TENTATIVE: 'warning', PENDING: 'neutral' }

const rsvpStyle = (rsvp) => {
  const tone = RSVP_TONE[rsvp] || 'neutral'
  return {
    background: `var(--bp-${tone}-bg)`,
    color: `var(--bp-${tone}-fg)`,
    borderColor: `var(--bp-${tone}-fg)`,
    fontWeight: 500,
  }
}

export default function MeetingInvitations({ meetingId }) {
  const { data, loading, error, refetch } = useApi(`/invitations?meetingId=${encodeURIComponent(meetingId)}`)
  const { capabilities } = useSession()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(null)
  const csvInput = useRef(null)

  const importCsv = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('csv')
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data: result } = await api.post(
        `/invitations/import?meetingId=${encodeURIComponent(meetingId)}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setNotice({
        tone: 'success',
        text: `Imported: ${result.invited} invited, ${result.created} new people, ${result.skipped} already listed` +
          (result.problems?.length ? ` — ${result.problems.length} rows skipped` : ''),
      })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const invitations = data || []
  const canManage = capabilities?.manageMeetings
  const unsent = invitations.filter((i) => !i.sentAt).length

  const add = async (userIds) => {
    await api.post('/invitations', { meetingId, userIds })
    setAdding(false)
    setNotice({ tone: 'success', text: `Invited ${userIds.length} ${userIds.length === 1 ? 'person' : 'people'}` })
    await refetch()
  }

  const send = async () => {
    setBusy('send')
    setNotice(null)
    try {
      const { data: result } = await api.post('/invitations/send', { meetingId })
      setNotice({ tone: result.marked ? 'warning' : 'info', text: result.message })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const setRsvp = async (inv, rsvp) => {
    setBusy(inv.id)
    try {
      await api.put(`/invitations/${inv.id}`, { rsvp })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (inv) => {
    setBusy(inv.id)
    try {
      await api.delete(`/invitations/${inv.id}`)
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
        title={`Invitations (${invitations.length})`}
        action={
          canManage && (
            <div className="flex items-center gap-2">
              {unsent > 0 && (
                <button onClick={send} disabled={busy === 'send'} className="bp-btn bp-btn-secondary">
                  <Send size={14} /> {busy === 'send' ? 'Sending…' : `Send (${unsent})`}
                </button>
              )}
              <button
                onClick={async () => {
                  setBusy('board')
                  setNotice(null)
                  try {
                    const { data: r } = await api.post('/invitations/board', { meetingId })
                    setNotice({
                      tone: r.added ? 'success' : 'info',
                      text: r.added
                        ? `Added ${r.added} board member${r.added === 1 ? '' : 's'} to the list`
                        : 'The whole board is already on the list',
                    })
                    await refetch()
                  } catch (e) {
                    setNotice({ tone: 'danger', text: e.message })
                  } finally {
                    setBusy(null)
                  }
                }}
                disabled={busy === 'board'}
                className="bp-btn bp-btn-secondary"
                title="Invite every sitting board member who is not on the list yet — new meetings do this automatically"
              >
                {busy === 'board' ? 'Inviting…' : 'Invite the board'}
              </button>
              <button
                onClick={() => csvInput.current?.click()}
                disabled={busy === 'csv'}
                className="bp-btn bp-btn-secondary"
                title="Upload a member list CSV: name, email, role, voting (yes/no)"
              >
                <FileUp size={14} /> {busy === 'csv' ? 'Importing…' : 'Import CSV'}
              </button>
              <input ref={csvInput} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
              <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
                {adding ? <X size={14} /> : <UserPlus size={14} />}
                {adding ? 'Close' : 'Invite'}
              </button>
            </div>
          )
        }
      />

      {adding && (
        <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <MemberSearch excludeMeetingId={meetingId} onConfirm={add} confirmLabel="Invite" />
          <ExternalInvite meetingId={meetingId} onDone={async (msg) => {
            setNotice({ tone: 'success', text: msg })
            setAdding(false)
            await refetch()
          }} />
        </div>
      )}

      {notice && (
        <p className="px-4 pt-3 text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>
          {notice.text}
        </p>
      )}

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && invitations.length === 0}
        emptyLabel="Nobody invited yet"
        onRetry={refetch}
      />

      {invitations.length > 0 && (
        <div className="bp-divide">
          {invitations.map((inv) => (
            <div key={inv.id} className="p-3 flex items-center gap-3">
              <Avatar name={inv.user?.name} initials={inv.user?.initials} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{inv.user?.name || 'Unknown'}</p>
                <p className="text-xs bp-muted truncate">
                  {humanise(inv.role)}
                  {inv.sentAt ? ` · invited ${fmtDate(inv.sentAt)}` : ' · not sent'}
                </p>
              </div>

              {canManage ? (
                <select
                  value={inv.rsvp}
                  onChange={(e) => setRsvp(inv, e.target.value)}
                  disabled={busy === inv.id}
                  className="bp-input text-xs py-1"
                  style={rsvpStyle(inv.rsvp)}
                >
                  {RSVPS.map((r) => (
                    <option key={r} value={r}>{humanise(r)}</option>
                  ))}
                </select>
              ) : (
                <Badge status={inv.rsvp} />
              )}

              {canManage && (
                <button
                  onClick={() => remove(inv)}
                  disabled={busy === inv.id}
                  className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5"
                  title="Remove from meeting"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/**
 * Invite someone from outside the system — a guest speaker, an auditor.
 * They get the invitation (date, time, place) and a spot on the roll as a
 * guest, but no vote and no portal access in the host platform.
 */
function ExternalInvite({ meetingId, onDone }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const { data } = await api.post('/invitations/external', { meetingId, ...form })
      await onDone(data.alreadyInvited
        ? `${form.name} is already on the invitation list`
        : `${form.name} invited as a guest`)
      setForm({ name: '', email: '' })
      setOpen(false)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="bp-link text-sm">
        Not in the system? Invite someone from outside — they get the invitation, not portal access.
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bp-card p-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="text-xs bp-muted">Name</span>
        <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="bp-input w-full mt-1" placeholder="Guest speaker" />
      </label>
      <label className="block">
        <span className="text-xs bp-muted">Email</span>
        <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="bp-input w-full mt-1" placeholder="name@example.com" />
        {err && <p className="text-xs mt-1" style={{ color: 'var(--bp-danger-fg)' }}>{err}</p>}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
          {saving ? 'Inviting…' : 'Invite as guest'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="bp-btn bp-btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
