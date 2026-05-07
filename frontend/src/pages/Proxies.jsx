import { useState } from 'react'
import { UserCheck, Plus, CheckCircle, Clock, User } from 'lucide-react'

const PROXIES = [
  { id: 1, member: 'James Oliver', proxy: 'Michael Torres', meeting: 'Board Meeting - Q2 Review', date: '2026-05-15', reason: 'International travel', scope: 'General proxy — all votes', status: 'approved', lodged: '2026-05-08' },
  { id: 2, member: 'David Kim', proxy: 'Emma Johnson', meeting: 'Board Meeting - Q2 Review', date: '2026-05-15', reason: 'Medical appointment', scope: 'Limited — agenda items 1-3 only', status: 'pending', lodged: '2026-05-12' },
  { id: 3, member: 'Tom Baker', proxy: 'Lisa Wong', meeting: 'Risk Committee', date: '2026-01-28', reason: 'Family commitment', scope: 'General proxy — all votes', status: 'approved', lodged: '2026-01-24' },
]

export default function Proxies() {
  const [showNew, setShowNew] = useState(false)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proxy Register</h1>
          <p className="text-slate-500 mt-1">Board member proxy appointments and authorisations</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Lodge Proxy
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Total Proxies</p><p className="text-2xl font-bold text-slate-900 mt-1">{PROXIES.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Approved</p><p className="text-2xl font-bold text-emerald-600 mt-1">{PROXIES.filter(p=>p.status==='approved').length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Pending</p><p className="text-2xl font-bold text-amber-600 mt-1">{PROXIES.filter(p=>p.status==='pending').length}</p></div>
      </div>

      <div className="card divide-y divide-slate-100">
        {PROXIES.map(p => (
          <div key={p.id} className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <UserCheck size={18} className="text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-400" />
                    <p className="text-sm font-semibold text-slate-900">{p.member}</p>
                    <span className="text-slate-400">→</span>
                    <p className="text-sm font-semibold text-primary-600">{p.proxy}</p>
                  </div>
                  <span className={`badge ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} flex items-center gap-1`}>
                    {p.status === 'approved' ? <CheckCircle size={10} /> : <Clock size={10} />}
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{p.meeting} · {p.date}</p>
                <p className="text-xs text-slate-400 mt-0.5">Reason: {p.reason}</p>
                <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500"><span className="font-medium">Scope:</span> {p.scope}</p>
                </div>
                <p className="text-xs text-slate-400 mt-1">Lodged: {p.lodged}</p>
              </div>
              {p.status === 'pending' && (
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs py-1.5">Reject</button>
                  <button className="btn-primary text-xs py-1.5">Approve</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-slate-100"><h2 className="text-lg font-semibold text-slate-900">Lodge Proxy</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Appointing Member</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Select member...</option><option>Sarah Chen</option><option>Michael Torres</option><option>James Oliver</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Proxy Holder</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Select proxy holder...</option><option>Michael Torres</option><option>Emma Johnson</option><option>Lisa Wong</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Meeting</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Board Meeting - Q2 Review (May 15, 2026)</option><option>Audit Committee (May 22, 2026)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Reason for Absence</label>
                <input className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="e.g. International travel" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Proxy Scope</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>General proxy — all votes</option><option>Limited — specific agenda items only</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowNew(false)} className="btn-primary">Lodge Proxy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
