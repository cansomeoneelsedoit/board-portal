import { useState } from 'react'
import { Plus, Check, X, ShieldAlert, CircleSlash, Pencil, ChevronDown, Bell, BellOff } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { fmtDate, humanise } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, PageHeader, StatTile } from '../components/ui'
import MemberSearch from '../components/MemberSearch'
import { useSession } from '../lib/useSession'

/**
 * Register of interests.
 *
 * Laid out as the board's own register is: one block per member, listing the
 * positions they hold, whether the board has been notified, the steps the board
 * takes, and what the member does about it.
 *
 * This is the standing record. What a member says when a relevant item comes up
 * at a meeting is a declaration, and lives on that meeting.
 */

const DEFAULT_BOARD_STEPS =
  'Once a conflict of interest has been appropriately disclosed, the board (excluding the ' +
  'board member who has made the disclosure, as well as any other conflicted board member) will ' +
  'decide whether or not those conflicted board members should: vote on the matter; participate ' +
  'in any debate; or be present in the room during the debate and the voting.'

const DEFAULT_MEMBER_ACTIONS =
  'Once an actual, potential or perceived conflict of interest is identified, the board member ' +
  'will advise the Board and the General Manager, and it is entered into the register of interests.'

export default function Register() {
  const { data, loading, error, refetch } = useApi('/register')
  const { capabilities } = useSession()
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(null)

  const members = data?.members || []
  const canManage = capabilities?.manageMeetings

  return (
    <div className="space-y-6">
      <PageHeader
        title="Register of Interests"
        subtitle="Standing disclosures held by each member"
        actions={
          canManage && (
            <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
              {adding ? <X size={15} /> : <Plus size={15} />} {adding ? 'Close' : 'Add disclosure'}
            </button>
          )
        }
      />

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Members disclosed" value={members.length} sub="On the register" icon={ShieldAlert} tone="primary" />
          <StatTile label="Interests recorded" value={data?.total ?? 0} sub="Standing entries" icon={Check} tone="info" />
          <StatTile
            label="Awaiting notification"
            value={data?.outstanding ?? 0}
            sub={data?.outstanding ? 'Board not yet notified' : 'All notified'}
            icon={CircleSlash}
            tone={data?.outstanding ? 'warning' : 'success'}
          />
        </div>
      )}

      {adding && (
        <AddDisclosure
          onDone={async () => { setAdding(false); setNotice({ tone: 'success', text: 'Added to the register' }); await refetch() }}
        />
      )}

      {notice && (
        <Card className="p-3">
          <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
        </Card>
      )}

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && members.length === 0}
        emptyLabel="Nothing on the register yet"
        onRetry={refetch}
      />

      <div className="space-y-4">
        {members.map((m) => (
          <MemberBlock key={m.userId} member={m} canManage={canManage} onChange={refetch} />
        ))}
      </div>
    </div>
  )
}

function MemberBlock({ member, canManage, onChange }) {
  const [busy, setBusy] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [draftScopeAll, setDraftScopeAll] = useState(true)
  const [draftBoards, setDraftBoards] = useState([])
  const { data: bodies } = useApi('/boards')

  const startEdit = (i) => {
    setEditingId(i.id)
    setDraft(i.interest)
    setDraftScopeAll(Boolean(i.disclosedToAll))
    setDraftBoards((i.boards || []).map((b) => b.id))
  }

  const saveText = async (interest) => {
    setBusy(interest.id)
    try {
      await api.put(`/register/${interest.id}`, {
        interest: draft,
        disclosedToAll: draftScopeAll,
        boardIds: draftScopeAll ? [] : draftBoards,
      })
      setEditingId(null)
      await onChange()
    } finally {
      setBusy(null)
    }
  }
  // Accordion: the register is long (a dozen members, ~90 interests), so each
  // member starts collapsed and opens on click.
  const [open, setOpen] = useState(false)

  const setNotified = async (interest, notified) => {
    setBusy(interest.id)
    try {
      await api.put(`/register/${interest.id}`, { notified })
      await onChange()
    } finally {
      setBusy(null)
    }
  }

  const end = async (interest) => {
    setBusy(interest.id)
    try {
      await api.post(`/register/${interest.id}/end`, {})
      await onChange()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      {/* The whole header is the toggle — clicking the person opens them up. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors hover:bg-[var(--bp-neutral-bg)]"
        style={open ? { borderBottom: '1px solid var(--bp-card-border)' } : undefined}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Avatar name={member.member} initials={member.initials} size={28} />
          <span className="min-w-0">
            <span className="block font-semibold text-sm truncate">{member.member}</span>
            <span className="block text-xs bp-muted">
              {member.interests.length} interest{member.interests.length === 1 ? '' : 's'} disclosed
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {member.notified
            ? <Badge tone="success">Board notified</Badge>
            : <Badge tone="warning">Notification outstanding</Badge>}
          <ChevronDown
            size={16}
            className="bp-subtle transition-transform duration-200"
            style={open ? { transform: 'rotate(180deg)' } : undefined}
          />
        </span>
      </button>

      {open && (
      <div className="overflow-x-auto">
        <table className="bp-table">
          <thead>
            <tr>
              <th>Description of interest</th>
              <th className="hidden sm:table-cell">Category</th>
              <th>Notified</th>
              <th className="hidden lg:table-cell">Recorded</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {member.interests.map((i) => (
              <tr key={i.id} style={i.status === 'ENDED' ? { opacity: 0.55 } : undefined}>
                <td>
                  {editingId === i.id ? (
                    <div className="space-y-2 min-w-[18rem]">
                      <span className="flex items-center gap-2">
                        <input value={draft} onChange={(e) => setDraft(e.target.value)}
                          className="bp-input text-sm py-1 w-full min-w-[16rem]" autoFocus />
                        <button onClick={() => saveText(i)} disabled={busy === i.id}
                          className="bp-btn bp-btn-primary" title="Save"><Check size={13} /></button>
                        <button onClick={() => setEditingId(null)} className="bp-subtle p-1" title="Cancel">
                          <X size={13} />
                        </button>
                      </span>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={draftScopeAll} onChange={() => setDraftScopeAll(true)} />
                          All bodies
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={!draftScopeAll} onChange={() => setDraftScopeAll(false)} />
                          Specific:
                        </label>
                        {!draftScopeAll && (bodies || []).map((b) => (
                          <label key={b.id} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={draftBoards.includes(b.id)}
                              onChange={() =>
                                setDraftBoards((s2) => (s2.includes(b.id) ? s2.filter((x) => x !== b.id) : [...s2, b.id]))}
                            />
                            {b.shortName || b.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium">{i.interest}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1">
                        {i.disclosedToAll ? (
                          <span className="bp-badge bp-badge--info">All boards & committees</span>
                        ) : (
                          (i.boards || []).map((b) => (
                            <span key={b.id} className="bp-badge bp-badge--neutral">{b.shortName || b.name}</span>
                          ))
                        )}
                      </p>
                      {i.status === 'ENDED' && (
                        <p className="text-xs bp-subtle">Ended {fmtDate(i.endedAt)}</p>
                      )}
                    </>
                  )}
                </td>
                <td className="hidden sm:table-cell">
                  <Badge tone="neutral">{humanise(i.category)}</Badge>
                </td>
                <td>
                  {i.notified ? (
                    <span className="bp-badge bp-badge--success">
                      <Check size={11} className="mr-1" />Yes
                    </span>
                  ) : (
                    <span className="bp-badge bp-badge--warning">No</span>
                  )}
                </td>
                <td className="hidden lg:table-cell bp-muted">{fmtDate(i.notifiedAt || i.updatedAt)}</td>
                {canManage && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => startEdit(i)}
                        disabled={busy === i.id}
                        className="bp-subtle hover:text-[var(--bp-fg)] p-1.5"
                        title="Edit the wording and which boards it is disclosed to"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setNotified(i, !i.notified)}
                        disabled={busy === i.id}
                        className="p-1.5"
                        style={{ color: i.notified ? 'var(--bp-success-fg)' : 'var(--bp-warning-fg)' }}
                        title={i.notified
                          ? 'Board has been notified — click to mark as not notified'
                          : 'Board NOT yet notified — click to mark as notified'}
                      >
                        {i.notified ? <Bell size={14} /> : <BellOff size={14} />}
                      </button>
                      {i.status !== 'ENDED' && (
                        <button
                          onClick={() => end(i)}
                          disabled={busy === i.id}
                          className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5"
                          title="Position ended — keeps the entry on the record, greyed"
                        >
                          <CircleSlash size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {open && (member.interests[0]?.boardSteps || member.interests[0]?.memberActions) && (
        <div className="p-4 grid gap-4 sm:grid-cols-2" style={{ borderTop: '1px solid var(--bp-card-border)' }}>
          {member.interests[0]?.boardSteps && (
            <div>
              <p className="text-xs uppercase tracking-wide bp-subtle font-medium">Steps taken by the board</p>
              <p className="text-sm bp-muted mt-1">{member.interests[0].boardSteps}</p>
            </div>
          )}
          {member.interests[0]?.memberActions && (
            <div>
              <p className="text-xs uppercase tracking-wide bp-subtle font-medium">Member actions</p>
              <p className="text-sm bp-muted mt-1">{member.interests[0].memberActions}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function AddDisclosure({ onDone }) {
  const [userId, setUserId] = useState(null)
  const { data: bodies } = useApi('/boards')
  const [form, setForm] = useState({
    interest: '',
    category: 'DUTY_TO_DUTY',
    notified: true,
    boardSteps: DEFAULT_BOARD_STEPS,
    memberActions: DEFAULT_MEMBER_ACTIONS,
  })
  // Scope: a standing disclosure to every body, or only the bodies it is
  // actually relevant to — not every interest matters to every committee.
  const [scopeAll, setScopeAll] = useState(true)
  const [boardIds, setBoardIds] = useState([])
  const toggleBoard = (id) =>
    setBoardIds((s2) => (s2.includes(id) ? s2.filter((b) => b !== id) : [...s2, id]))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!userId) { setError('Choose the member first'); return }
    setSaving(true)
    setError(null)
    try {
      await api.post('/register', { userId, ...form, disclosedToAll: scopeAll, boardIds: scopeAll ? [] : boardIds })
      await onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Add to the register" />
      <div className="p-4 space-y-4">
        {!userId ? (
          <MemberSearch onConfirm={(ids) => setUserId(ids[0])} confirmLabel="Choose member" />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Description of interest</span>
              <textarea
                required
                rows={5}
                value={form.interest}
                onChange={(e) => setForm((f) => ({ ...f, interest: e.target.value }))}
                className="bp-input w-full mt-1"
                placeholder={'Director, Freemasons Property Pty Ltd\nMember, Grand Almoners Committee\nEmployed by McConnell Dowell'}
              />
              <span className="block text-xs bp-muted mt-1">
                One interest per line — each becomes its own entry, so they can be ended separately.
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="bp-input w-full mt-1"
                >
                  <option value="DUTY_TO_DUTY">Conflict of duty</option>
                  <option value="MATERIAL_PERSONAL">Material personal interest</option>
                  <option value="PECUNIARY">Pecuniary interest</option>
                  <option value="PERCEIVED">Perceived conflict</option>
                  <option value="INDIRECT">Indirect interest</option>
                </select>
              </label>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={form.notified}
                  onChange={(e) => setForm((f) => ({ ...f, notified: e.target.checked }))}
                />
                <span className="text-sm">Board has been notified</span>
              </label>
            </div>

            <fieldset className="bp-card p-3 space-y-2">
              <legend className="text-sm font-medium px-1">Disclosed to</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={scopeAll} onChange={() => setScopeAll(true)} />
                All boards and committees — standing disclosure
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!scopeAll} onChange={() => setScopeAll(false)} />
                Only specific bodies
              </label>
              {!scopeAll && (
                <div className="pl-6 space-y-1">
                  {(bodies || []).map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={boardIds.includes(b.id)} onChange={() => toggleBoard(b.id)} />
                      {b.name}
                    </label>
                  ))}
                  {(bodies || []).length === 0 && (
                    <p className="text-xs bp-muted">No boards or committees yet — create them in Board Setup.</p>
                  )}
                </div>
              )}
            </fieldset>

            <label className="block">
              <span className="text-sm font-medium">Steps taken by the board</span>
              <textarea rows={3} value={form.boardSteps}
                onChange={(e) => setForm((f) => ({ ...f, boardSteps: e.target.value }))}
                className="bp-input w-full mt-1" />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Member actions to address the conflict</span>
              <textarea rows={2} value={form.memberActions}
                onChange={(e) => setForm((f) => ({ ...f, memberActions: e.target.value }))}
                className="bp-input w-full mt-1" />
            </label>

            {error && <p className="text-sm" style={{ color: 'var(--bp-danger-fg)' }}>{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
                {saving ? 'Saving…' : 'Add to register'}
              </button>
              <button type="button" onClick={() => setUserId(null)} className="bp-btn bp-btn-secondary">
                Change member
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}
