import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Search, Video, MapPin, Users, ChevronRight, Send } from 'lucide-react'

const MEETINGS = [
  { id: 1, title: 'Board Meeting - Q2 Review', date: '2026-05-15', time: '10:00 AM', type: 'Board', location: 'Boardroom A', platform: 'Teams', attendees: 9, status: 'upcoming', agenda: 5 },
  { id: 2, title: 'Audit Committee', date: '2026-05-22', time: '2:00 PM', type: 'Committee', location: 'Online', platform: 'Zoom', attendees: 5, status: 'upcoming', agenda: 3 },
  { id: 3, title: 'Special Resolution Meeting', date: '2026-06-01', time: '9:00 AM', type: 'Special', location: 'Boardroom A', platform: 'Teams', attendees: 9, status: 'upcoming', agenda: 2 },
  { id: 4, title: 'Board Meeting - Q1 Review', date: '2026-02-14', time: '10:00 AM', type: 'Board', location: 'Boardroom A', platform: 'Zoom', attendees: 8, status: 'completed', agenda: 6 },
  { id: 5, title: 'Risk Committee', date: '2026-01-28', time: '11:00 AM', type: 'Committee', location: 'Online', platform: 'Teams', attendees: 4, status: 'completed', agenda: 4 },
]

const statusBadge = (s) => s === 'upcoming'
  ? 'bg-blue-100 text-blue-700'
  : s === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'

const typeBadge = (t) => t === 'Board'
  ? 'bg-slate-100 text-slate-700'
  : t === 'Committee' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'

export default function Meetings() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)

  const filtered = MEETINGS.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || m.status === filter || m.type.toLowerCase() === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
          <p className="text-slate-500 mt-1">Schedule, manage and track board meetings</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          New Meeting
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="flex-1 text-sm outline-none text-slate-700"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'upcoming', 'completed', 'board', 'committee'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings list */}
      <div className="card divide-y divide-slate-100">
        {filtered.map(m => (
          <div key={m.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={22} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 truncate">{m.title}</p>
                <span className={`badge ${typeBadge(m.type)}`}>{m.type}</span>
                <span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar size={12} /> {m.date} at {m.time}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {m.location === 'Online' ? <Video size={12} /> : <MapPin size={12} />}
                  {m.location} ({m.platform})
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Users size={12} /> {m.attendees} members
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {m.status === 'upcoming' && (
                <button className="flex items-center gap-1.5 text-xs font-medium text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors">
                  <Send size={12} /> Send Invite
                </button>
              )}
              <Link to={`/meetings/${m.id}`} className="p-2 text-slate-400 hover:text-slate-600">
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>No meetings found</p>
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Schedule New Meeting</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Meeting Title</label>
                <input className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="e.g. Board Meeting - Q3 Review" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Date</label>
                  <input type="date" className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Time</label>
                  <input type="time" className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Meeting Type</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Board</option>
                  <option>Committee</option>
                  <option>Special</option>
                  <option>AGM</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Platform</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Microsoft Teams</option>
                  <option>Zoom</option>
                  <option>In Person</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location / Link</label>
                <input className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Boardroom A or meeting link" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowNew(false)} className="btn-primary flex items-center gap-2">
                <Send size={14} /> Schedule & Send Invites
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
