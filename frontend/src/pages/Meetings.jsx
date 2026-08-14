import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Search, Video, MapPin, Users, ChevronRight, ChevronLeft, X } from 'lucide-react'
import api, { endpoints } from '../lib/api'
import { useApi } from '../lib/useApi'
import { fmtDateTime } from '../lib/format'
import { Badge, Card, DataState, PageHeader } from '../components/ui'
import PackFolderField from '../components/PackFolderField'
import VenueInput from '../components/VenueInput'

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

// How often a recurring meeting repeats, in days (months/years step by date).
const REPEATS = [
  { id: 'NONE', label: 'Does not repeat' },
  { id: 'WEEKLY', label: 'Weekly — same day each week' },
  { id: 'FORTNIGHTLY', label: 'Fortnightly — every two weeks' },
  { id: 'MONTHLY', label: 'Monthly — same date each month' },
  { id: 'YEARLY', label: 'Yearly — same date each year' },
]

/** All the dates a repeat rule produces, first sitting included. Capped at 52. */
function seriesDates(startIso, freq, untilIso) {
  const dates = [new Date(startIso)]
  if (freq === 'NONE' || !untilIso) return dates
  const until = new Date(`${untilIso}T23:59:59`)
  let cursor = new Date(startIso)
  while (dates.length < 52) {
    const next = new Date(cursor)
    if (freq === 'WEEKLY') next.setDate(next.getDate() + 7)
    else if (freq === 'FORTNIGHTLY') next.setDate(next.getDate() + 14)
    else if (freq === 'MONTHLY') next.setMonth(next.getMonth() + 1)
    else if (freq === 'YEARLY') next.setFullYear(next.getFullYear() + 1)
    if (next > until) break
    dates.push(next)
    cursor = next
  }
  return dates
}

function NewMeetingModal({ onClose, onCreated }) {
  const { data: boards } = useApi(endpoints.boards())
  const [boardId, setBoardId] = useState('')
  // The body this meeting belongs to — its standing quorum rule (set in
  // Board Settings) is pulled in the moment it is picked.
  const selectedBoard = (boards || []).find((b) => b.id === boardId) || (boards || [])[0]
  const { data: boardMembers } = useApi(selectedBoard ? `/board-members?boardId=${selectedBoard.id}` : null)
  const [form, setForm] = useState({
    title: '', date: '', time: '18:30', location: '', videoUrl: '', status: 'SCHEDULED',
  })
  const [quorum, setQuorum] = useState({
    minimum: 4,
    requireChair: true,
    requireTreasurer: true,
    secretaryExOfficio: true,
  })
  const [repeat, setRepeat] = useState({ freq: 'NONE', until: '' })
  const [proxiesAllowed, setProxiesAllowed] = useState(true)
  // Direct link to this meeting's SharePoint pack folder, set at scheduling.
  const [packUrl, setPackUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // The selected body's rule fills the fields; picking a different body
  // pulls in its rule instead. The fields stay editable, so one sitting can
  // differ without touching the standing rule.
  useEffect(() => {
    const b = selectedBoard
    if (!b) return
    const roles = String(b.quorumRequiredRoles || '').toUpperCase()
    const ex = String(b.quorumExOfficioRoles || '').toUpperCase()
    setQuorum({
      minimum: b.quorumMinimum ?? 4,
      requireChair: roles.includes('CHAIR'),
      requireTreasurer: roles.includes('TREASURER'),
      secretaryExOfficio: ex.includes('SECRETARY'),
    })
  }, [selectedBoard?.id])

  // Named members the rule requires, shown by name so the rule is legible.
  const mandatoryNames = (() => {
    const ids = new Set(String(selectedBoard?.quorumMandatoryUserIds || '').split(',').map((s) => s.trim()).filter(Boolean))
    if (!ids.size) return []
    return (boardMembers || [])
      .filter((m) => !m.endedAt && ids.has(m.userId))
      .map((m) => m.user?.name)
      .filter(Boolean)
  })()

  const submit = async (e) => {
    e.preventDefault()
    const boardIdToUse = selectedBoard?.id
    if (!boardIdToUse) { setErr('No board exists to attach this meeting to.'); return }
    if (repeat.freq !== 'NONE' && !repeat.until) {
      setErr('Choose a "repeat until" date for the series.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const start = `${form.date}T${form.time || '00:00'}`
      const dates = seriesDates(start, repeat.freq, repeat.until)
      const payload = (date) => ({
        boardId: boardIdToUse,
        title: form.title,
        date: date.toISOString(),
        location: form.location || null,
        videoUrl: form.videoUrl || null,
        status: form.status,
        quorumMinimum: Number(quorum.minimum) || 4,
        quorumRequiredRoles: [
          quorum.requireChair ? 'CHAIR' : null,
          quorum.requireTreasurer ? 'TREASURER' : null,
        ].filter(Boolean).join(','),
        quorumExOfficioRoles: quorum.secretaryExOfficio ? 'SECRETARY' : '',
        proxiesAllowed,
      })

      const { data: createdMeeting } = await api.post(endpoints.meetings(), payload(dates[0]))
      // Later sittings of the series: same settings, their own dates. Each
      // finds its own pack folder by meeting date; only the first can take
      // the pasted folder pin.
      for (const d of dates.slice(1)) {
        await api.post(endpoints.meetings(), payload(d))
      }

      // Pin the pack folder to the new meeting. A bad URL should not lose the
      // meeting that was just created - report it and let Edit fix the link.
      if (packUrl.trim()) {
        try {
          await api.post(`/sharepoint/pack/${createdMeeting.id}`, { url: packUrl.trim() })
        } catch (e3) {
          setErr(`Meeting created, but the pack folder link failed: ${e3.message}. Set it via Edit.`)
          setSaving(false)
          return
        }
      }
      onCreated()
    } catch (e2) {
      setErr(e2.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4 flex items-start justify-center">
      <form onSubmit={submit} className="bp-card w-full max-w-3xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgb(0 0 0 / 0.25)' }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
          <h2 className="text-lg font-semibold">Schedule New Meeting</h2>
          <button type="button" onClick={onClose} className="bp-subtle hover:text-[var(--bp-fg)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Board / Committee</span>
            <select
              value={selectedBoard?.id || ''}
              onChange={(e) => setBoardId(e.target.value)}
              className="bp-input w-full mt-1"
              title="Which body this meeting belongs to — its quorum rule applies"
            >
              {(boards || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>

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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Repeats</span>
              <select value={repeat.freq} onChange={(e) => setRepeat((r) => ({ ...r, freq: e.target.value }))}
                className="bp-input w-full mt-1">
                {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
            {repeat.freq !== 'NONE' && (
              <label className="block">
                <span className="text-sm font-medium">Until</span>
                <input type="date" required value={repeat.until}
                  onChange={(e) => setRepeat((r) => ({ ...r, until: e.target.value }))}
                  className="bp-input w-full mt-1" />
              </label>
            )}
          </div>
          {repeat.freq !== 'NONE' && form.date && repeat.until && (
            <p className="text-xs bp-muted sm:col-span-2">
              Creates {seriesDates(`${form.date}T${form.time || '00:00'}`, repeat.freq, repeat.until).length} meetings,
              each finding its own pack folder by date.
            </p>
          )}

          <div className="sm:col-span-2">
            <PackFolderField value={packUrl} onChange={setPackUrl} />
          </div>

          <label className="block">
            <span className="text-sm font-medium">Location / Venue</span>
            <VenueInput value={form.location} onChange={set('location')}
              placeholder="Pick a venue or type an address" />
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

          <fieldset className="bp-card p-4 sm:col-span-2">
            <legend className="text-sm font-medium px-1">Quorum for this meeting</legend>
            {selectedBoard && (
              <p className="text-xs bp-muted mb-3">
                {selectedBoard.name}'s standing rule, set in Board Settings — adjust below for this sitting only.
                {mandatoryNames.length > 0 && (
                  <>
                    {' '}Must be present:{' '}
                    {mandatoryNames.map((n) => (
                      <span key={n} className="bp-badge bp-badge--info mr-1">{n}</span>
                    ))}
                  </>
                )}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
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
                <input type="checkbox" checked={quorum.secretaryExOfficio}
                  onChange={(e) => setQuorum((s) => ({ ...s, secretaryExOfficio: e.target.checked }))} />
                Secretary attends ex officio (not counted)
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
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={proxiesAllowed}
              onChange={(e) => setProxiesAllowed(e.target.checked)} />
            Proxy voting allowed — members may assign their vote for this meeting
          </label>

          {err && <p className="text-sm sm:col-span-2" style={{ color: 'var(--bp-danger-fg)' }}>{err}</p>}
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
