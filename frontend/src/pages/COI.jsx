import { useState } from 'react'
import { AlertTriangle, Plus, Eye, CheckCircle, Clock, Shield } from 'lucide-react'

const DECLARATIONS = [
  { id: 1, member: 'John Smith', role: 'Director', type: 'Financial', description: 'Director of Northfield Properties Pty Ltd — relevant to agenda item 4 (property acquisition)', date: '2026-05-01', meeting: 'Board Meeting - Q2 Review', status: 'active', managed: 'Director left room during item 4 discussion and vote' },
  { id: 2, member: 'Sarah Chen', role: 'Chair', type: 'Employment', description: 'Spouse employed by Smith & Partners LLP (legal firm used by BOM INC)', date: '2025-11-15', meeting: 'Ongoing', status: 'active', managed: 'Board aware. Chair does not participate in decisions related to legal services procurement' },
  { id: 3, member: 'Emma Johnson', role: 'Director', type: 'Financial', description: 'Holds shares in ABC Investment Fund — fund does not overlap with BOM INC investment strategy', date: '2025-03-10', meeting: 'Ongoing', status: 'resolved', managed: 'Reviewed by board. No conflict determined. No action required.' },
  { id: 4, member: 'David Kim', role: 'Director', type: 'Personal', description: 'Family member (brother) applied for CEO role — application unsuccessful', date: '2026-01-20', meeting: 'Board Meeting - Q1 Review', status: 'resolved', managed: 'David Kim did not participate in recruitment panel or discussion' },
]

const typeColor = { Financial: 'bg-red-100 text-red-700', Employment: 'bg-amber-100 text-amber-700', Personal: 'bg-purple-100 text-purple-700', Other: 'bg-slate-100 text-slate-600' }
const statusClass = (s) => s === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'

export default function COI() {
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conflict of Interest Register</h1>
          <p className="text-slate-500 mt-1">Declarations, management plans and status tracking</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> New Declaration
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Total Declarations</p><p className="text-2xl font-bold text-slate-900 mt-1">{DECLARATIONS.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Active</p><p className="text-2xl font-bold text-amber-600 mt-1">{DECLARATIONS.filter(d=>d.status==='active').length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Resolved</p><p className="text-2xl font-bold text-emerald-600 mt-1">{DECLARATIONS.filter(d=>d.status==='resolved').length}</p></div>
      </div>

      <div className="card divide-y divide-slate-100">
        {DECLARATIONS.map(d => (
          <div key={d.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{d.member}</p>
                  <span className="text-xs text-slate-400">{d.role}</span>
                  <span className={`badge ${typeColor[d.type] || 'bg-slate-100 text-slate-600'}`}>{d.type}</span>
                  <span className={`badge ${statusClass(d.status)} flex items-center gap-1`}>
                    {d.status === 'active' ? <Clock size={10} /> : <CheckCircle size={10} />}
                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{d.description}</p>
                <div className="flex items-start gap-2 mt-2 p-2 bg-slate-50 rounded-lg">
                  <Shield size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-500"><span className="font-medium">Management:</span> {d.managed}</p>
                </div>
                <p className="text-xs text-slate-400 mt-1">Declared: {d.date} · {d.meeting}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">New COI Declaration</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Board Member</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Sarah Chen</option><option>Michael Torres</option><option>Emma Johnson</option><option>David Kim</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Type of Interest</label>
                <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Financial</option><option>Employment</option><option>Personal</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description of Interest</label>
                <textarea rows={3} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" placeholder="Describe the nature of the conflict..." />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Management Plan</label>
                <textarea rows={2} className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" placeholder="How will the conflict be managed?" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowNew(false)} className="btn-primary">Submit Declaration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
