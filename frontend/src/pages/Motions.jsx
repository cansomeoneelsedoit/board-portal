import { useState } from 'react'
import { Vote, ThumbsUp, ThumbsDown, Minus, CheckCircle, XCircle, Clock, Plus } from 'lucide-react'

const MOTIONS = [
  { id: 1, ref: 'RES-2026-05', title: 'Approve Q1 Budget Variance of $42,000', meeting: 'Board Meeting - Q2 Review', date: '2026-05-15', proposer: 'Sarah Chen', seconder: 'Michael Torres', status: 'pending', for: 0, against: 0, abstain: 0 },
  { id: 2, ref: 'RES-2026-04', title: 'Appoint External Auditor for 2026 Financial Year', meeting: 'Board Meeting - Q1 Review', date: '2026-02-14', proposer: 'Emma Johnson', seconder: 'David Kim', status: 'passed', for: 7, against: 1, abstain: 1 },
  { id: 3, ref: 'RES-2026-03', title: 'Approve Updated Risk Management Policy', meeting: 'Risk Committee', date: '2026-01-28', proposer: 'Lisa Wong', seconder: 'Tom Baker', status: 'passed', for: 9, against: 0, abstain: 0 },
  { id: 4, ref: 'RES-2026-02', title: 'Decline acquisition of Northfield Properties', meeting: 'Special Meeting', date: '2026-01-10', proposer: 'James Oliver', seconder: 'Priya Patel', status: 'failed', for: 3, against: 6, abstain: 0 },
]

const statusIcon = (s) => s === 'passed' ? <CheckCircle size={16} className="text-emerald-500" /> : s === 'failed' ? <XCircle size={16} className="text-red-500" /> : <Clock size={16} className="text-amber-500" />
const statusClass = (s) => s === 'passed' ? 'bg-emerald-100 text-emerald-700' : s === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'

export default function Motions() {
  const [votes, setVotes] = useState({})
  const [filter, setFilter] = useState('all')

  const filtered = MOTIONS.filter(m => filter === 'all' || m.status === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Motions & Resolutions</h1>
          <p className="text-slate-500 mt-1">Board resolutions, voting records and outcomes</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> New Motion</button>
      </div>

      <div className="flex gap-2">
        {['all', 'pending', 'passed', 'failed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(m => (
          <div key={m.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-400">{m.ref}</span>
                  <span className={`badge ${statusClass(m.status)} flex items-center gap-1`}>
                    {statusIcon(m.status)} {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                  </span>
                </div>
                <p className="font-semibold text-slate-900">{m.title}</p>
                <p className="text-xs text-slate-400 mt-1">{m.meeting} · {m.date} · Proposed: {m.proposer} · Seconded: {m.seconder}</p>
              </div>
            </div>

            {m.status !== 'pending' ? (
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-emerald-600">
                  <ThumbsUp size={16} />
                  <span className="text-sm font-semibold">{m.for} For</span>
                </div>
                <div className="flex items-center gap-2 text-red-500">
                  <ThumbsDown size={16} />
                  <span className="text-sm font-semibold">{m.against} Against</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Minus size={16} />
                  <span className="text-sm font-semibold">{m.abstain} Abstain</span>
                </div>
                {/* Simple visual bar */}
                <div className="flex-1 flex items-center gap-1 ml-4">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    {m.for + m.against + m.abstain > 0 && <>
                      <div style={{width: `${m.for/(m.for+m.against+m.abstain)*100}%`}} className="bg-emerald-400 h-full" />
                      <div style={{width: `${m.abstain/(m.for+m.against+m.abstain)*100}%`}} className="bg-slate-300 h-full" />
                      <div style={{width: `${m.against/(m.for+m.against+m.abstain)*100}%`}} className="bg-red-400 h-full" />
                    </>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">Cast your vote:</p>
                <div className="grid grid-cols-3 gap-2">
                  {['for', 'against', 'abstain'].map(v => (
                    <button key={v} onClick={() => setVotes({...votes, [m.id]: v})}
                      className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${votes[m.id] === v
                        ? v === 'for' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : v === 'against' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-400 bg-slate-50 text-slate-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {v === 'for' ? <ThumbsUp size={14} /> : v === 'against' ? <ThumbsDown size={14} /> : <Minus size={14} />}
                      <span className="capitalize">{v}</span>
                    </button>
                  ))}
                </div>
                {votes[m.id] && <button className="btn-primary w-full mt-2 text-sm">Submit Vote</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
