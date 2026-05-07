import { Users, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react'

const MEMBERS = [
  { id: 1, name: 'Sarah Chen', role: 'Chair', meetings: 12, attended: 12, rate: 100, recent: ['attended','attended','attended','attended','attended'] },
  { id: 2, name: 'Michael Torres', role: 'Deputy Chair', meetings: 12, attended: 11, rate: 92, recent: ['attended','attended','attended','apologies','attended'] },
  { id: 3, name: 'Emma Johnson', role: 'Director', meetings: 12, attended: 10, rate: 83, recent: ['attended','apologies','attended','attended','attended'] },
  { id: 4, name: 'David Kim', role: 'Director', meetings: 12, attended: 9, rate: 75, recent: ['absent','attended','attended','attended','apologies'] },
  { id: 5, name: 'Lisa Wong', role: 'Director', meetings: 12, attended: 12, rate: 100, recent: ['attended','attended','attended','attended','attended'] },
  { id: 6, name: 'James Oliver', role: 'Director', meetings: 12, attended: 7, rate: 58, recent: ['absent','absent','attended','apologies','attended'] },
  { id: 7, name: 'Priya Patel', role: 'Director', meetings: 12, attended: 11, rate: 92, recent: ['attended','attended','attended','attended','apologies'] },
  { id: 8, name: 'Tom Baker', role: 'Director', meetings: 12, attended: 10, rate: 83, recent: ['attended','apologies','attended','attended','attended'] },
  { id: 9, name: 'Aisha Nkosi', role: 'Director', meetings: 12, attended: 12, rate: 100, recent: ['attended','attended','attended','attended','attended'] },
]

const dot = (s) => {
  if (s === 'attended') return <span className="w-4 h-4 rounded-full bg-emerald-400 inline-block" title="Attended" />
  if (s === 'apologies') return <span className="w-4 h-4 rounded-full bg-amber-400 inline-block" title="Apologies" />
  return <span className="w-4 h-4 rounded-full bg-red-400 inline-block" title="Absent" />
}

const rateColor = (r) => r >= 90 ? 'text-emerald-600' : r >= 75 ? 'text-amber-600' : 'text-red-600'
const rateBar = (r) => r >= 90 ? 'bg-emerald-400' : r >= 75 ? 'bg-amber-400' : 'bg-red-400'

export default function Attendance() {
  const avg = Math.round(MEMBERS.reduce((s,m) => s + m.rate, 0) / MEMBERS.length)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance Register</h1>
        <p className="text-slate-500 mt-1">Board member attendance tracking and compliance</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium">Board Members</p><p className="text-2xl font-bold text-slate-900 mt-1">{MEMBERS.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium">Avg Attendance</p><p className={`text-2xl font-bold mt-1 ${rateColor(avg)}`}>{avg}%</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium">Perfect Attendance</p><p className="text-2xl font-bold text-slate-900 mt-1">{MEMBERS.filter(m=>m.rate===100).length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium">Below 75%</p><p className="text-2xl font-bold text-red-600 mt-1">{MEMBERS.filter(m=>m.rate<75).length}</p></div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-slate-700">Last 5 meetings:</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> Attended</span>
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Apologies</span>
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Absent</span>
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {MEMBERS.map(m => (
            <div key={m.id} className="p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">{m.name[0]}</div>
              <div className="w-36 flex-shrink-0">
                <p className="text-sm font-medium text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-400">{m.role}</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${rateBar(m.rate)} rounded-full transition-all`} style={{width: `${m.rate}%`}} />
                  </div>
                  <span className={`text-sm font-semibold w-12 text-right ${rateColor(m.rate)}`}>{m.rate}%</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{m.attended}/{m.meetings} meetings</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {m.recent.map((s, i) => <span key={i}>{dot(s)}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
