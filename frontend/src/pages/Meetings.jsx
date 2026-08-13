import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Search, Video, MapPin, Users, ChevronRight, ChevronLeft, X } from 'lucide-react'
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

const PAGE_SIZE = 10

export default function Meetings() {
  const { data, loading, error, refetch } = useApi(endpoints.meetings())
  const { data: bodies } = useApi('/boards')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [bodyId, setBodyId] = useState('all')
  const [page, setPage] = useState(1)
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
      if (bodyId !== 'all' && m.boardId !== bodyId) return false
      if (filter === 'all') return true
      if (filter === 'draft') return m.status === 'DRAFT'
      if (filter === 'completed') return m.status === 'COMPLETED' || new Date(m.date) < now
      if (filter === 'upcoming') return m.status !== 'DRAFT' && new Date(m.date) >= now
      return true
    })
  }, [meetings, search, filter, bodyId])

  // Page within the filtered list, then group the page by year — the same
  // shape as the filing cabinet's year folders.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const byYear = useMemo(() => {
    const groups = []
    for (const m of paged) {
      const year = m.date ? String(new Date(m.date).getFullYear()) : 'Undated'
      const last = groups[groups.length - 1]
      if (last && last.year === year) last.items.push(m)
      else groups.push({ year, items: [m] })
    }
    return groups
  }, [paged])

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
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search meetings…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setPage(1) }}
              className={filter === f.id ? 'bp-btn bp-btn-primary' : 'bp-btn bp-btn-secondary'}
            >
              {f.label}
            </button>
          ))}
          {(bodies || []).length > 1 && (
            <select
              value={bodyId}
              onChange={(e) => { setBodyId(e.target.value); setPage(1) }}
              className="bp-input text-sm py-1.5"
              title="Which board or committee"
            >
              <option value="all">All bodies</option>
              {(bodies || []).map((b) => (
                <option key={b.id} value={b.id}>{b.shortName || b.name}</option>
              ))}
            </select>
          )}
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
        {!loading && !error && filtered.length > 0 && byYear.map((group) => (
          <div key={group.year}>
            <div
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wide bp-muted"
              style={{ background: 'var(--bp-neutral-bg)', borderBottom: '1px solid var(--bp-card-border)' }}
            >
              {group.year}
            </div>
            <div className="bp-divide">
            {group.items.map((m) => (
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
          </div>
        ))}

        {!loading && !error && filtered.length > PAGE_SIZE && (
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--bp-card-border)' }}
          >
            <span className="text-xs bp-muted">
              Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={current <= 1}
                className="bp-btn bp-btn-secondary"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs bp-muted">Page {current} of {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={current >= pageCount}
                className="bp-btn bp-btn-secondary"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
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
  // Quorum rule for this meeting. Defaults to the AF&AM Inc rule; saved on the
  // meeting so one sitting can differ from the board's standing rule.
  const [quorum, setQuorum] = useState({
    minimum: 4,
    requireChair: true,
    requireTreasurer: true,
    secretaryExOfficio: true,
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
        quorumMinimum: Number(quorum.minimum) || 4,
        quorumRequiredRoles: [
          quorum.requireChair ? 'CHAIR' : null,
          quorum.requireTreasurer ? 'TREASURER' : null,
        ].filter(Boolean).join(','),
        quorumExOfficioRoles: quorum.secretaryExOfficio ? 'SECRETARY' : '',
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

          <fieldset className="bp-card p-3 space-y-2">
            <legend className="text-sm font-medium px-1">Quorum for this meeting</legend>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">Minimum counting members</span>
              <input
                type="number" min="1" max="20"
                value={quorum.minimum}
                onChange={(e) => setQuorum((s) => ({ ...s, minimum: e.target.value }))}
                className="bp-input w-20 text-center"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={quorum.requireChair}
                onChange={(e) => setQuorum((s) => ({ ...s, requireChair: e.target.checked }))} />
              Must include the Chair
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={quorum.requireTreasurer}
                onChange={(e) => setQuorum((s) => ({ ...s, requireTreasurer: e.target.checked }))} />
              Must include the Treasurer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={quorum.secretaryExOfficio}
                onChange={(e) => setQuorum((s) => ({ ...s, secretaryExOfficio: e.target.checked }))} />
              Secretary attends ex officio (not counted)
            </label>
          </fieldset>

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
