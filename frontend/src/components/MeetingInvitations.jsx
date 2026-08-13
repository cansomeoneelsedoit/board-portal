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
        <div className="p-4" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <MemberSearch excludeMeetingId={meetingId} onConfirm={add} confirmLabel="Invite" />
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
