import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft, Calendar, MapPin, Video, FileText, Clock, Pencil, X, Trash2,
} from 'lucide-react'
import { useApi } from '../lib/useApi'
import api from '../lib/api'
import { useSession } from '../lib/useSession'
import { endpoints } from '../lib/api'
import { fmtBytes, fmtDateTime, humanise } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, Field, PageHeader } from '../components/ui'
import MeetingTabs from '../components/MeetingTabs'
import MeetingInvitations from '../components/MeetingInvitations'
import PackFolderField from '../components/PackFolderField'
import VenueInput from '../components/VenueInput'

export default function MeetingDetail() {
  const { id } = useParams()
  const { data: meeting, loading, error, refetch } = useApi(endpoints.meeting(id))
  // Received stamps for the agenda - the automated "Received 29/7 @ 15:15".
  const { data: received } = useApi(id ? `/pack/${id}/received` : null)
  // Declarations pinned to agenda items, so the agenda itself carries the
  // warning against the business it affects.
  const { data: declarations } = useApi(id ? `/coi?meetingId=${encodeURIComponent(id)}` : null)
  const { capabilities } = useSession()
  const [editing, setEditing] = useState(false)

  if (loading || error || !meeting) {
    return (
      <div className="space-y-6">
        <Link to="/meetings" className="bp-link text-sm inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to meetings
        </Link>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && !meeting}
          emptyLabel="Meeting not found"
          onRetry={refetch}
        />
      </div>
    )
  }

  const agenda = meeting.agendaItems || []
  const invitations = meeting.invitations || []
  const totalMinutes = agenda.reduce((sum, a) => sum + (a.duration || 0), 0)

  return (
    <div className="space-y-6">
      <Link to="/meetings" className="bp-link text-sm inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Back to meetings
      </Link>

      <PageHeader
        title={meeting.title}
        subtitle={meeting.board?.name}
        actions={
          <div className="flex items-center gap-2">
            {capabilities?.manageMeetings && (
              <button onClick={() => setEditing(true)} className="bp-btn bp-btn-secondary">
                <Pencil size={14} /> Edit
              </button>
            )}
            <Badge status={meeting.status} />
          </div>
        }
      />

      {editing && (
        <EditMeeting
          meeting={meeting}
          onClose={() => setEditing(false)}
          onSaved={async () => { setEditing(false); await refetch() }}
        />
      )}

      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date & time">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} /> {fmtDateTime(meeting.date)}
            </span>
          </Field>
          <Field label="Location">
            {meeting.location ? (
              <a
                href={/^https?:\/\//i.test(meeting.location)
                  ? meeting.location
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meeting.location)}`}
                target="_blank"
                rel="noreferrer"
                className="bp-link inline-flex items-center gap-1.5"
                title="Open in maps"
              >
                <MapPin size={14} /> {meeting.location}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> —</span>
            )}
          </Field>
          <Field label="Video">
            {meeting.videoUrl ? (
              <a href={meeting.videoUrl} target="_blank" rel="noreferrer"
                 className="bp-link inline-flex items-center gap-1.5">
                <Video size={14} /> Join link
              </a>
            ) : '—'}
          </Field>
          <Field label="Scheduled duration">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> {totalMinutes} min
            </span>
          </Field>
        </div>
      </Card>

      {/* Everything about this meeting lives here — the pack, who attended,
          what was declared, what was resolved. These used to be separate
          top-level registers, which made one meeting read as six unrelated
          lists. */}
      <MeetingTabs meeting={meeting} received={received} declarations={declarations} onChanged={refetch} />

    </div>
  )
}


/**
 * Conflicts declared against this agenda item, shown on the agenda itself —
 * the chair sees the warning at the item, not just on the Conflicts tab.
 */
function AgendaConflicts({ declarations }) {
  if (!declarations.length) return null
  return (
    <div className="mt-2 space-y-1.5">
      {declarations.map((d) => (
        <div
          key={d.id}
          className="p-2 rounded-md text-xs flex items-start gap-2"
          style={{ background: 'var(--bp-warning-bg)', color: 'var(--bp-warning-fg)' }}
        >
          <span className="font-semibold shrink-0">⚠ Conflict — {d.user?.name || 'Member'}:</span>
          <span className="min-w-0">
            {d.description}
            <span className="opacity-80">
              {' '}({humanise(d.type)} · {humanise(d.effect === 'PENDING' ? 'not yet resolved' : d.effect)})
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Per-report stamp: on time (green), late (amber), after board date (red). */
function FileStatusBadge({ status }) {
  const tone = status === 'ON_TIME' ? 'success' : status === 'LATE' ? 'warning' : 'danger'
  const label = status === 'ON_TIME' ? 'on time' : status === 'LATE' ? 'late' : 'after board date'
  return <span className={`bp-badge bp-badge--${tone}`}>{label}</span>
}

/** "Received 4 Aug 2026 at 3:15pm" plus on-time / late / after-board-date. */
function ReceivedStamp({ info }) {
  if (!info || !info.status) return null
  if (info.status === 'AWAITED') {
    return <p className="text-xs bp-subtle mt-1">Report awaited — folder is empty</p>
  }
  const tone = info.status === 'ON_TIME' ? 'success' : info.status === 'LATE' ? 'warning' : 'danger'
  const label =
    info.status === 'ON_TIME' ? 'Received on time'
    : info.status === 'LATE' ? 'Received late'
    : 'Received after board date'
  return (
    <p className="text-xs mt-1 flex items-center gap-2">
      <span className={`bp-badge bp-badge--${tone}`}>{label}</span>
      <span className="bp-muted">
        Received {fmtDateTime(info.receivedAt)}
        {info.fileCount > 1 ? ` · ${info.fileCount} files` : ''}
      </span>
    </p>
  )
}

/** Edit the meeting's name, times and location in place. */
function EditMeeting({ meeting, onClose, onSaved }) {
  const { capabilities } = useSession()
  const d = meeting.date ? new Date(meeting.date) : null
  const pad = (n) => String(n).padStart(2, '0')
  const [form, setForm] = useState({
    title: meeting.title || '',
    date: d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '',
    time: d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '18:30',
    location: meeting.location || '',
    videoUrl: meeting.videoUrl || '',
    status: meeting.status || 'SCHEDULED',
  })
  // The pinned pack folder. Cleared = unpin; changed = re-pin.
  const initialPackUrl = meeting.sharepointWebUrl || ''
  const [packUrl, setPackUrl] = useState(initialPackUrl)
  const [proxiesAllowed, setProxiesAllowed] = useState(Boolean(meeting.proxiesAllowed))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.put(`/meetings/${meeting.id}`, {
        title: form.title,
        date: new Date(`${form.date}T${form.time || '00:00'}`).toISOString(),
        location: form.location || null,
        videoUrl: form.videoUrl || null,
        status: form.status,
        proxiesAllowed,
      })
      if (packUrl.trim() !== initialPackUrl.trim()) {
        if (packUrl.trim()) {
          await api.post(`/sharepoint/pack/${meeting.id}`, { url: packUrl.trim() })
        } else {
          await api.delete(`/sharepoint/pack/${meeting.id}`)
        }
      }
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${meeting.title}" and everything recorded against it? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await api.delete(`/meetings/${meeting.id}`)
      window.location.href = `${window.location.origin}${window.location.pathname.replace(/\/meetings\/.*$/, '/meetings')}`
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4 flex items-start justify-center">
      <form onSubmit={submit} className="bp-card w-full max-w-lg my-4 max-h-[calc(100vh-2rem)] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgb(0 0 0 / 0.25)' }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <h2 className="text-lg font-semibold">Edit Meeting</h2>
          <button type="button" onClick={onClose} className="bp-subtle hover:text-[var(--bp-fg)]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Meeting Title</span>
            <input required value={form.title} onChange={set('title')} className="bp-input w-full mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Date</span>
              <input required type="date" value={form.date} onChange={set('date')} className="bp-input w-full mt-1" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Time</span>
              <input type="time" value={form.time} onChange={set('time')} className="bp-input w-full mt-1" />
            </label>
          </div>
          <PackFolderField value={packUrl} onChange={setPackUrl} />

          <label className="block">
            <span className="text-sm font-medium">Location / Venue</span>
            <VenueInput value={form.location} onChange={set('location')} placeholder="Pick a venue or type an address" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Video Link</span>
            <input value={form.videoUrl} onChange={set('videoUrl')} className="bp-input w-full mt-1" placeholder="https://…" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Status</span>
            <select value={form.status} onChange={set('status')} className="bp-input w-full mt-1">
              <option value="SCHEDULED">Scheduled</option>
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          {error && <p className="text-sm" style={{ color: 'var(--bp-danger-fg)' }}>{error}</p>}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={proxiesAllowed}
              onChange={(e) => setProxiesAllowed(e.target.checked)} />
            Proxy voting allowed — members may assign their vote for this meeting
          </label>
        </div>
        <div className="p-5 flex items-center gap-3" style={{ borderTop: '1px solid var(--bp-card-border)' }}>
          {capabilities?.deleteMeetings && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="bp-btn bp-btn-secondary"
              style={{ color: 'var(--bp-danger-fg)' }}
              title="Erase this meeting and everything recorded against it — top-level access only"
            >
              <Trash2 size={14} /> Delete meeting
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="bp-btn bp-btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
