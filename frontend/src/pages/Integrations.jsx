import { useState } from 'react'
import { Settings, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Zap } from 'lucide-react'

const INTEGRATIONS = [
  {
    id: 'teams', name: 'Microsoft Teams', category: 'Meetings',
    description: 'Send meeting invites, join meetings and record attendance via Teams',
    status: 'connected', lastSync: '2 hours ago',
    features: ['Auto-send calendar invites', 'Join meeting links', 'Attendance recording', 'Meeting reminders'],
    color: 'bg-purple-500', icon: '🔷',
    config: { tenant: 'bominc.onmicrosoft.com', calendar: 'Board Meetings' }
  },
  {
    id: 'zoom', name: 'Zoom', category: 'Meetings',
    description: 'Create Zoom meetings and send invites to board members',
    status: 'connected', lastSync: '1 day ago',
    features: ['Generate Zoom links', 'Auto-invite participants', 'Recording integration'],
    color: 'bg-blue-500', icon: '📹',
    config: { account: 'board@bominc.org', licenseType: 'Business' }
  },
  {
    id: 'sharepoint', name: 'SharePoint', category: 'Documents',
    description: 'Sync documents from SharePoint — read-only access for board members',
    status: 'connected', lastSync: '2 hours ago',
    features: ['Auto-sync board packs', 'Read-only document access', 'Version control', 'Folder mapping'],
    color: 'bg-green-500', icon: '📁',
    config: { site: 'bominc.sharepoint.com/sites/board', folder: '/BoardMeetings' }
  },
  {
    id: 'echo', name: 'Echo Notes', category: 'Minutes',
    description: 'Import meeting recordings and transcripts for minutes generation',
    status: 'connected', lastSync: '3 days ago',
    features: ['Auto-import transcripts', 'AI-generated minutes draft', 'Speaker identification', 'Action item extraction'],
    color: 'bg-pink-500', icon: '🎙️',
    config: { workspace: 'BOM INC Board', autoImport: true }
  },
  {
    id: 'outlook', name: 'Microsoft Outlook', category: 'Email',
    description: 'Send meeting invites, reminders and board notifications via Outlook',
    status: 'disconnected', lastSync: null,
    features: ['Meeting invitations', 'Automated reminders', 'Agenda distribution', 'Response tracking'],
    color: 'bg-blue-600', icon: '📧',
    config: null
  },
]

const statusBadge = (s) => s === 'connected'
  ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle size={11} /> Connected</span>
  : <span className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full"><AlertCircle size={11} /> Not connected</span>

export default function Integrations() {
  const [selected, setSelected] = useState(INTEGRATIONS[0])

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Connect Teams, Zoom, SharePoint and Echo Notes</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Integration list */}
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</p>
              <div className="card divide-y divide-slate-100">
                {INTEGRATIONS.filter(i => i.category === cat).map(integration => (
                  <button
                    key={integration.id}
                    onClick={() => setSelected(integration)}
                    className={`w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors ${selected.id === integration.id ? 'bg-primary-50' : ''}`}
                  >
                    <div className={`w-10 h-10 ${integration.color} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
                      {integration.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{integration.name}</p>
                      {integration.lastSync && <p className="text-xs text-slate-400">Last sync: {integration.lastSync}</p>}
                    </div>
                    {statusBadge(integration.status)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div className="card">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${selected.color} rounded-xl flex items-center justify-center text-2xl`}>
                {selected.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-400">{selected.category}</p>
              </div>
              {statusBadge(selected.status)}
            </div>
            <p className="text-sm text-slate-600 mt-3">{selected.description}</p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Features</p>
              <ul className="space-y-1.5">
                {selected.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <Zap size={13} className="text-primary-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {selected.config && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Configuration</p>
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  {Object.entries(selected.config).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 capitalize">{k}</span>
                      <span className="text-xs text-slate-700 font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              {selected.status === 'connected' ? (
                <>
                  <button className="btn-secondary flex items-center gap-1.5 text-sm flex-1"><RefreshCw size={14} /> Sync Now</button>
                  <button className="btn-secondary flex items-center gap-1.5 text-sm"><Settings size={14} /> Configure</button>
                  <button className="btn-secondary text-sm text-red-500 border-red-200 hover:bg-red-50">Disconnect</button>
                </>
              ) : (
                <button className="btn-primary flex items-center gap-1.5 text-sm w-full justify-center"><ExternalLink size={14} /> Connect {selected.name}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
