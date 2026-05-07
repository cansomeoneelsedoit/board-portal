import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Video, Users, FileText, Vote, ClipboardList, CheckCircle, XCircle, Clock, Download, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'

const MEETINGS = {
  1: {
    id: 1, title: 'Board Meeting - Q2 Review', date: '2026-05-15', time: '10:00 AM',
    type: 'Board', location: 'Boardroom A', platform: 'Teams', status: 'upcoming',
    quorum: 6,
    agenda: [
      { id: 1, order: 1, title: 'Apologies for absence', type: 'procedural', duration: 5 },
      { id: 2, order: 2, title: 'Confirmation of previous minutes', type: 'procedural', duration: 5 },
      { id: 3, order: 3, title: 'Q1 Financial Report', type: 'presentation', duration: 20 },
      { id: 4, order: 4, title: 'Resolution: Approve Q1 Budget Variance', type: 'resolution', duration: 15 },
      { id: 5, order: 5, title: 'CEO Update', type: 'update', duration: 20 },
    ],
    documents: [
      { id: 1, name: 'Board Pack - May 2026.pdf', size: '4.2 MB', type: 'pack' },
      { id: 2, name: 'Q1 Financial Report.xlsx', size: '1.1 MB', type: 'financial' },
      { id: 3, name: 'Previous Minutes - March 2026.pdf', size: '280 KB', type: 'minutes' },
    ],
    members: [
      { id: 1, name: 'Sarah Chen', role: 'Chair', status: 'accepted' },
      { id: 2, name: 'Michael Torres', role: 'Deputy Chair', status: 'accepted' },
      { id: 3, name: 'Emma Johnson', role: 'Director', status: 'accepted' },
      { id: 4, name: 'David Kim', role: 'Director', status: 'pending' },
      { id: 5, name: 'Lisa Wong', role: 'Director', status: 'accepted' },
      { id: 6, name: 'James Oliver', role: 'Director', status: 'declined' },
      { id: 7, name: 'Priya Patel', role: 'Director', status: 'accepted' },
      { id: 8, name: 'Tom Baker', role: 'Director', status: 'pending' },
      { id: 9, name: 'Aisha Nkosi', role: 'Director', status: 'accepted' },
    ],
    motions: [
      { id: 1, title: 'Approve Q1 Budget Variance of $42,000', status: 'pending', for: 0, against: 0, abstain: 0 },
    ]
  }
}

const statusIcon = (s) => {
  if (s === 'accepted') return <CheckCircle size={14} className="text-emerald-500" />
  if (s === 'declined') return <XCircle size={14} className="text-red-500" />
  return <Clock size={14} className="text-amber-500" />
}

export default function MeetingDetail() {
  const { id } = useParams()
  const meeting = MEETINGS[id] || MEETINGS[1]
  const [tab, setTab] = useState('agenda')
  const [votes, setVotes] = useState({})

  const tabs = ['agenda', 'documents', 'attendance', 'motions']
  const accepted = meeting.members.filter(m => m.status === 'accepted').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/meetings" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm text-slate-500 flex items-center gap-1"><Calendar size={13} /> {meeting.date} at {meeting.time}</span>
            <span className="text-sm text-slate-500 flex items-center gap-1"><Video size={13} /> {meeting.location} ({meeting.platform})</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Agenda Items', value: meeting.agenda.length, icon: ClipboardList },
          { label: 'Documents', value: meeting.documents.length, icon: FileText },
          { label: 'Responses', value: `${accepted}/${meeting.members.length}`, icon: Users },
          { label: 'Motions', value: meeting.motions.length, icon: Vote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <Icon size={18} className="text-primary-600" />
            <div>
              <p className="text-lg font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-slate-100 flex">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'agenda' && (
            <div className="space-y-2">
              {meeting.agenda.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center text-xs font-bold text-primary-600 flex-shrink-0">{item.order}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.duration} min · {item.type}</p>
                  </div>
                  {item.type === 'resolution' && (
                    <span className="badge bg-purple-100 text-purple-700">Resolution</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-2">
              {meeting.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                    <FileText size={16} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                    <p className="text-xs text-slate-400">{doc.size}</p>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
                    <Download size={13} /> Download
                  </button>
                </div>
              ))}
              <div className="mt-4 p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-sm text-slate-400">Drop files here to upload to SharePoint</p>
                <button className="mt-2 text-xs text-primary-600 font-medium hover:underline">Browse files</button>
              </div>
            </div>
          )}

          {tab === 'attendance' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 rounded-lg">
                <Users size={16} className="text-amber-600" />
                <p className="text-sm text-amber-700 font-medium">Quorum requires {meeting.quorum} members. {accepted} confirmed so far.</p>
              </div>
              {meeting.members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                    {m.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.role}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {statusIcon(m.status)}
                    <span className={`text-xs font-medium ${m.status === 'accepted' ? 'text-emerald-600' : m.status === 'declined' ? 'text-red-600' : 'text-amber-600'}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'motions' && (
            <div className="space-y-4">
              {meeting.motions.map(motion => (
                <div key={motion.id} className="border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{motion.title}</p>
                      <span className="badge bg-amber-100 text-amber-700 mt-1">Pending vote</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {['for', 'against', 'abstain'].map(v => (
                      <button
                        key={v}
                        onClick={() => setVotes({...votes, [motion.id]: v})}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${votes[motion.id] === v
                          ? v === 'for' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : v === 'against' ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-slate-400 bg-slate-50 text-slate-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        {v === 'for' ? <ThumbsUp size={16} /> : v === 'against' ? <ThumbsDown size={16} /> : <Minus size={16} />}
                        <span className="text-sm font-medium capitalize">{v}</span>
                      </button>
                    ))}
                  </div>
                  {votes[motion.id] && (
                    <div className="mt-3">
                      <button className="btn-primary w-full">Submit Vote</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
