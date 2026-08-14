import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Building2, Check, Pencil, X } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../lib/useSession'
import { humanise } from '../lib/format'
import { Badge, Card, DataState, PageHeader } from '../components/ui'
import BoardMembersCard from '../components/BoardMembersCard'
import QuorumRuleCard from '../components/QuorumRuleCard'

const KINDS = [
  { id: 'BOARD', label: 'Board' },
  { id: 'COMMITTEE', label: 'Committee' },
  { id: 'SUBCOMMITTEE', label: 'Sub-committee' },
]

/**
 * Everything about ONE board or committee, in one place: its details, its
 * constitution and quorum rule, and who sits on it. Scheduling a meeting for
 * this body pulls these settings in as the defaults.
 */
export default function BoardSettings() {
  const { id } = useParams()
  const { capabilities, loading: sessionLoading } = useSession()
  const { data: board, loading, error, refetch } = useApi(`/boards/${id}`)
  const [editing, setEditing] = useState(false)

  if (sessionLoading || loading || error || !board) {
    return <DataState loading={sessionLoading || loading} error={error} onRetry={refetch} />
  }

  if (!capabilities?.manageMeetings) {
    return (
      <div className="space-y-6">
        <PageHeader title={board.name} />
        <Card className="p-6"><p className="text-sm bp-muted">Board settings need administrator access.</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/admin" className="bp-link inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={14} /> Back to Board Settings
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="bp-chip bp-chip--primary w-10 h-10"><Building2 size={18} /></span>
            {board.name}
          </span>
        }
        subtitle={[humanise(board.kind), board.parent?.name ? `under ${board.parent.name}` : null]
          .filter(Boolean).join(' · ')}
        actions={
          <button onClick={() => setEditing((e) => !e)} className="bp-btn bp-btn-secondary">
            {editing ? <X size={14} /> : <Pencil size={14} />} {editing ? 'Close' : 'Edit details'}
          </button>
        }
      />

      {editing && <EditDetails board={board} onSaved={async () => { setEditing(false); await refetch() }} />}

      <QuorumRuleCard board={board} onChanged={refetch} />
      <BoardMembersCard boardId={board.id} />
    </div>
  )
}

function EditDetails({ board, onSaved }) {
  const { data: bodies } = useApi('/boards')
  const [form, setForm] = useState({
    name: board.name || '',
    shortName: board.shortName || '',
    kind: board.kind || 'BOARD',
    parentId: board.parentId || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await api.put(`/boards/${board.id}`, {
        name: form.name,
        shortName: form.shortName || null,
        kind: form.kind,
        parentId: form.parentId || null,
      })
      await onSaved()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  const parents = (bodies || []).filter((b) => b.id !== board.id)

  return (
    <Card className="p-4">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_8rem_10rem_1fr_auto] sm:items-end">
        <label className="block"><span className="text-xs bp-muted">Name</span>
          <input required value={form.name} onChange={set('name')} className="bp-input w-full mt-1" /></label>
        <label className="block"><span className="text-xs bp-muted">Short name</span>
          <input value={form.shortName} onChange={set('shortName')} className="bp-input w-full mt-1" /></label>
        <label className="block"><span className="text-xs bp-muted">Kind</span>
          <select value={form.kind} onChange={set('kind')} className="bp-input w-full mt-1">
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select></label>
        <label className="block"><span className="text-xs bp-muted">Reports to</span>
          <select value={form.parentId} onChange={set('parentId')} className="bp-input w-full mt-1">
            <option value="">— none —</option>
            {parents.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
        <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
          <Check size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
      {err && <p className="text-sm mt-2" style={{ color: 'var(--bp-danger-fg)' }}>{err}</p>}
    </Card>
  )
}
