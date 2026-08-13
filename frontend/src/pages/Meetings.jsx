import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Search, Video, MapPin, Users, ChevronRight, X } from 'lucide-react'
import api, { endpoints } from '../lib/api'
import { useApi } from '../lib/useApi'
import { fmtDateTime } from '../lib/format'
import { Badge, Card, DataState, PageHeader } from '../components/ui'

const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'upcoming',  label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'draft',     label: 'Draft' },
]

export default function Meetings() {
  const { data, loading, error, refetch } = useApi(endpoints.meetings())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)

  const meetings = data || []

  const filtered = useMemo(() => {
    const now = new Date()
    return meetings.filter((m) => {
      const matchSearch =
        !search ||
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.location || '').toLowerCase().includes(search.toLowerCase())
      if (!matchSearch) return false
      if (filter === 'all') return true
      if (filter === 'draft') return m.status === 'DRAFT'
      if (filter === 'completed') return m.status === 'COMPLETED' || new Date(m.date) < now
      if (filter === 'upcoming') return m.status !== 'DRAFT' && new Date(m.date) >= now
      return true
    })
  }, [meetings, search, filter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        subtitle="Schedule, manage and track board meetings"
        actions={
          <button onClick={() => setShowNew(true)} className="bp-btn bp-btn-primary">
            <Plus size={16} /> Schedule Meeting
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="bp-card flex items-center gap-2 px-3 py-2 flex-1 min-w-[16rem] max-w-sm">
          <Search size={16} className="bp-subtle shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={filter === f.id ? 'bp-btn bp-btn-primary' : 'bp-btn bp-btn-secondary'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && filtered.length === 0}
          emptyLabel={meetings.length ? 'No meetings match those filters' : 'No meetings yet'}
          onRetry={refetch}
        />
        {!loading && !error && filtered.length > 0 && (
          <div className="bp-divide">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="p-4 flex items-center gap-4 transition-colors hover:bg-[var(--bp-neutral-bg)]"
              >
                <span className="bp-chip bp-chip--primary w-12 h-12 shrink-0">
                  <Calendar size={22} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold truncate">{m.title}</p>
                    <Badge status={m.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs bp-muted flex items-center gap-1">
                      <Calendar size={12} /> {fmtDateTime(m.date)}
                    </span>
                    {m.location && (
                      <span className="text-xs bp-muted flex items-center gap-1">
                        {m.videoUrl ? <Video size={12} /> : <MapPin size={12} />}
                        {m.location}
                      </span>
                    )}
                    <span className="text-xs bp-muted flex items-center gap-1">
                      <Users size={12} /> {m.invitations?.length ?? 0} invited
                    </span>
                    <span className="text-xs bp-muted">
                      {m.agendaItems?.length ?? 0} agenda items
                    </span>
                  </div>
                </div>
                <Link
                  to={`/meetings/${m.id}`}
                  className="p-2 bp-subtle hover:text-[var(--bp-fg)] shrink-0"
                  title="Open meeting"
                >
                  <ChevronRight size={18} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showNew && (
        <NewMeetingModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refetch() }}
        />
      )}
    </div>
  )
}

function NewMeetingModal({ onClose, onCreated }) {
  const { data: boards } = useApi(endpoints.boards())
  const [form, setForm] = useState({
    title: '', date: '', time: '18:30', location: '', videoUrl: '', status: 'SCHEDULED',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const boardId = boards?.[0]?.id
    if (!boardId) { setErr('No board exists to attach this meeting to.'); return }
    setSaving(true)
    setErr(null)
    try {
      await api.post(endpoints.meetings(), {
        boardId,
        title: form.title,
        date: new Date(`${form.date}T${form.time || '00:00'}`).toISOString(),
        location: form.location || null,
        videoUrl: form.videoUrl || null,
        status: form.status,
      })
      onCreated()
    } catch (e2) {
      setErr(e2.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bp-card w-full max-w-lg" style={{ boxShadow: '0 20px 60px rgb(0 0 0 / 0.25)' }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <h2 className="text-lg font-semibold">Schedule New Meeting</h2>
          <button type="button" onClick={onClose} className="bp-subtle hover:text-[var(--bp-fg)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Meeting Title</span>
            <input required value={form.title} onChange={set('title')} className="bp-input w-full mt-1"
              placeholder="e.g. Board Meeting - Q3 Review" />
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

          <label className="block">
            <span className="text-sm font-medium">Location / Link</span>
            <input value={form.location} onChange={set('location')} className="bp-input w-full mt-1"
              placeholder="Boardroom A or meeting link" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Video Link</span>
            <input value={form.videoUrl} onChange={set('videoUrl')} className="bp-input w-full mt-1"
              placeholder="https://…" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Status</span>
            <select value={form.status} onChange={set('status')} className="bp-input w-full mt-1">
              <option value="SCHEDULED">Scheduled</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>

          {err && <p className="text-sm" style={{ color: 'var(--bp-danger-fg)' }}>{err}</p>}
        </div>

        <div className="p-5 flex justify-end gap-3" style={{ borderTop: '1px solid var(--bp-card-border)' }}>
          <button type="button" onClick={onClose} className="bp-btn bp-btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
            {saving ? 'Saving…' : 'Schedule Meeting'}
          </button>
        </div>
      </form>
    </div>
  )
}
