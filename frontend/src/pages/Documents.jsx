import { useState } from 'react'
import { FileText, Download, Search, Upload, FolderOpen, Eye, Share2, Filter } from 'lucide-react'

const DOCS = [
  { id: 1, name: 'Board Pack - May 2026.pdf', meeting: 'Board Meeting - Q2 Review', date: '2026-05-10', size: '4.2 MB', type: 'pack', source: 'sharepoint', uploader: 'Admin' },
  { id: 2, name: 'Q1 Financial Report.xlsx', meeting: 'Board Meeting - Q2 Review', date: '2026-05-10', size: '1.1 MB', type: 'financial', source: 'sharepoint', uploader: 'CFO Office' },
  { id: 3, name: 'Previous Minutes - March 2026.pdf', meeting: 'Board Meeting - Q1', date: '2026-03-15', size: '280 KB', type: 'minutes', source: 'sharepoint', uploader: 'Secretary' },
  { id: 4, name: 'Risk Register Q1 2026.pdf', meeting: 'Risk Committee', date: '2026-01-28', size: '890 KB', type: 'report', source: 'sharepoint', uploader: 'Risk Manager' },
  { id: 5, name: 'CEO Report - May 2026.docx', meeting: 'Board Meeting - Q2 Review', date: '2026-05-09', size: '540 KB', type: 'report', source: 'local', uploader: 'CEO' },
  { id: 6, name: 'Investment Policy.pdf', meeting: 'Policy', date: '2025-11-01', size: '1.4 MB', type: 'policy', source: 'sharepoint', uploader: 'Admin' },
]

const typeColor = { pack: 'bg-blue-100 text-blue-700', financial: 'bg-emerald-100 text-emerald-700', minutes: 'bg-purple-100 text-purple-700', report: 'bg-amber-100 text-amber-700', policy: 'bg-red-100 text-red-700' }

export default function Documents() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = DOCS.filter(d => {
    const matchS = d.name.toLowerCase().includes(search.toLowerCase()) || d.meeting.toLowerCase().includes(search.toLowerCase())
    const matchT = typeFilter === 'all' || d.type === typeFilter
    return matchS && matchT
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500 mt-1">Board packs, reports and meeting documents from SharePoint</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2 text-sm">
            <FolderOpen size={15} /> Browse SharePoint
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Upload size={15} /> Upload
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search size={16} className="text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="flex-1 text-sm outline-none text-slate-700" />
        </div>
        <div className="flex gap-2">
          {['all', 'pack', 'financial', 'minutes', 'report', 'policy'].map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* SharePoint sync banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Share2 size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">SharePoint Connected</p>
          <p className="text-xs text-blue-700">Documents synced from BOM INC SharePoint · Last sync: 2 hours ago · All files are read-only</p>
        </div>
        <button className="text-xs font-medium text-blue-700 hover:text-blue-900">Sync Now</button>
      </div>

      <div className="card divide-y divide-slate-100">
        {filtered.map(doc => (
          <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 truncate">{doc.name}</p>
                <span className={`badge ${typeColor[doc.type] || 'bg-slate-100 text-slate-600'}`}>{doc.type}</span>
                {doc.source === 'sharepoint' && <span className="badge bg-blue-100 text-blue-700">SharePoint</span>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{doc.meeting} · {doc.date} · {doc.size} · {doc.uploader}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Eye size={16} />
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Download size={16} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>No documents found</p>
          </div>
        )}
      </div>
    </div>
  )
}
