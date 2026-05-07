import { useState } from 'react'
import { ClipboardList, Edit3, CheckCircle, Clock, Save, Download, Mic } from 'lucide-react'

const MINUTES = [
  {
    id: 1, meeting: 'Board Meeting - Q1 Review', date: '2026-02-14', status: 'approved', echoNotes: true,
    content: `BOARD MEETING MINUTES
Date: February 14, 2026 | Time: 10:00 AM | Location: Boardroom A

PRESENT: Sarah Chen (Chair), Michael Torres, Emma Johnson, David Kim, Lisa Wong, Priya Patel, Tom Baker, Aisha Nkosi (8 of 9 members — quorum achieved)
APOLOGIES: James Oliver

1. APOLOGIES FOR ABSENCE
Apologies were received and accepted from James Oliver.

2. CONFIRMATION OF PREVIOUS MINUTES
The minutes of the December 2025 Board Meeting were confirmed as a true and correct record.
Moved: Michael Torres | Seconded: Emma Johnson | CARRIED unanimously

3. Q4 FINANCIAL REPORT
The CFO presented the Q4 2025 financial report. Revenue was $2.4M against a budget of $2.2M (+9%). Operating costs were within budget. Net surplus of $340K.

4. RESOLUTION 2026-01: Approve Q4 Financial Accounts
RESOLVED that the Board approves the Q4 2025 financial accounts as presented.
Moved: Lisa Wong | Seconded: Tom Baker | For: 8 | Against: 0 | Abstain: 0 | CARRIED

5. NEXT MEETING
The next Board Meeting will be held on May 15, 2026 at 10:00 AM.

MEETING CLOSED: 12:05 PM
CONFIRMED: Sarah Chen, Chair — March 15, 2026`
  },
  {
    id: 2, meeting: 'Risk Committee', date: '2026-01-28', status: 'draft', echoNotes: true,
    content: `RISK COMMITTEE MINUTES — DRAFT
Date: January 28, 2026 | Time: 11:00 AM | Online (Teams)

PRESENT: Lisa Wong (Chair), Michael Torres, Emma Johnson, Aisha Nkosi

1. APOLOGIES
None.

2. RISK REGISTER REVIEW
The updated risk register was presented. 3 new risks identified relating to cybersecurity, property valuations and regulatory changes.

[Echo Notes transcript imported — please review and edit before approval]`
  }
]

export default function Minutes() {
  const [selected, setSelected] = useState(MINUTES[0])
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')

  const startEdit = () => {
    setDraftContent(selected.content)
    setEditing(true)
  }

  const save = () => {
    setEditing(false)
    // In real app: save to backend
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Minutes</h1>
          <p className="text-slate-500 mt-1">Board meeting minutes — auto-imported from Echo Notes, editable after meeting</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* List */}
        <div className="card divide-y divide-slate-100">
          <div className="p-4 flex items-center gap-2">
            <Mic size={16} className="text-primary-500" />
            <p className="text-sm font-semibold text-slate-900">Echo Notes Integration</p>
          </div>
          <div className="p-3 bg-emerald-50">
            <p className="text-xs text-emerald-700">✓ Connected to Echo Notes — transcripts auto-imported after each meeting</p>
          </div>
          {MINUTES.map(m => (
            <button key={m.id} onClick={() => { setSelected(m); setEditing(false) }}
              className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selected.id === m.id ? 'bg-primary-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900 leading-tight">{m.meeting}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{m.date}</p>
                </div>
                <div>
                  {m.status === 'approved'
                    ? <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle size={10} /> Approved</span>
                    : <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1"><Clock size={10} /> Draft</span>}
                  {m.echoNotes && <span className="badge bg-blue-100 text-blue-700 mt-1 flex items-center gap-1"><Mic size={10} /> Echo</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="col-span-2 card flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{selected.meeting}</p>
              <p className="text-xs text-slate-400">{selected.date}</p>
            </div>
            <div className="flex items-center gap-2">
              {!editing ? (
                <>
                  <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={14} /> Export PDF</button>
                  {selected.status === 'draft' && (
                    <button onClick={startEdit} className="btn-primary flex items-center gap-1.5 text-sm"><Edit3 size={14} /> Edit</button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
                  <button onClick={save} className="btn-primary flex items-center gap-1.5 text-sm"><Save size={14} /> Save Draft</button>
                  <button className="btn-primary flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700"><CheckCircle size={14} /> Approve</button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 p-5">
            {editing ? (
              <textarea
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                className="w-full h-full min-h-96 font-mono text-sm text-slate-700 border border-slate-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 leading-relaxed">{selected.content}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
