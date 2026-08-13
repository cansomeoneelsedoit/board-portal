import { useState } from 'react'
import {
  FolderOpen, Users, AlertTriangle, Vote as VoteIcon, ClipboardList, Check, X, Video, MapPin, Scale,
  UserCheck, ArrowRight, Trash2, FileDown,
} from 'lucide-react'
import clsx from 'clsx'
import { useApi } from '../lib/useApi'
import api, { apiBase } from '../lib/api'
import { useSession } from '../lib/useSession'
import { fmtDate, humanise } from '../lib/format'
import { Avatar, Badge, DataState } from './ui'
import BoardPackBrowser from './BoardPackBrowser'
import MeetingInvitations from './MeetingInvitations'
import { fmtBytes, fmtDateTime } from '../lib/format'
import AttendanceRoll from './AttendanceRoll'

/**
 * The meeting hub.
 *
 * A board meeting is one thing, not six registers. The pack, who was there,
 * what was declared and what was resolved all belong to the same sitting, so
 * they are tabs of one page rather than separate destinations.
 */
export default function MeetingTabs({ meeting, received, declarations, onChanged }) {
  const [tab, setTab] = useState('agenda')
  // Set when an agenda item is clicked: the pack tab opens inside that folder.
  const [packTarget, setPackTarget] = useState(null)
  const diveIntoFolder = (item) => {
    // Pack-derived folders are SharePoint folders — open them there even when
    // the meeting's own papers are set to direct upload.
    setPackTarget({ id: item.sourceFolderId, name: `${item.number}. ${item.title}`, source: 'SHAREPOINT', at: Date.now() })
    setTab('pack')
  }

  const attendances = meeting.attendances || []
  const motions = meeting.motions || []
  const minutes = meeting.minutes || null

  // COI has a meetingId but no relation on the meeting query, so fetch it here.
  const { data: cois, loading: coiLoading, error: coiError } =
    useApi(`/coi?meetingId=${encodeURIComponent(meeting.id)}`)

  // Order follows how a meeting actually runs: who is here, what they must
  // declare, confirmation of the last minutes, then the papers, then what gets
  // resolved.
  const agenda = meeting.agendaItems || []
  const tabs = [
    { id: 'agenda',     label: 'Agenda',      icon: ClipboardList,  count: agenda.length },
    { id: 'attendance', label: 'Attendance',  icon: Users,          count: (meeting.invitations || []).length },
    // Quorum sits straight after the roll: mark attendance, then see at once
    // whether the meeting can transact business.
    { id: 'quorum',     label: 'Quorum',      icon: Scale },
    { id: 'proxies',    label: 'Proxies',     icon: UserCheck },
    { id: 'coi',        label: 'Conflicts',   icon: AlertTriangle,  count: cois?.length },
    { id: 'minutes',    label: 'Minutes',     icon: ClipboardList },
    { id: 'pack',       label: 'Board pack',  icon: FolderOpen },
    { id: 'motions',    label: 'Motions',     icon: VoteIcon,       count: motions.length },
  ]

  return (
    <div className="bp-card">
      <div
        className="flex flex-wrap gap-1 px-2 pt-2"
        style={{ borderBottom: '1px solid var(--bp-card-border)' }}
      >
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-md transition-colors',
              tab === id ? 'bg-[var(--bp-neutral-bg)]' : 'bp-muted hover:text-[var(--bp-fg)]'
            )}
            style={tab === id ? { color: 'var(--bp-fg)' } : undefined}
          >
            <Icon size={15} />
            {label}
            {count !== undefined && count !== null && (
              <span className="bp-badge bp-badge--neutral">{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pack' && (
        <div>
          <PackSourcePicker meeting={meeting} />
          <BoardPackBrowser meetingId={meeting.id} />
        </div>
      )}

      {tab === 'agenda' && (
        <div className="p-4">
          <AgendaPanel
            meeting={meeting}
            agenda={agenda}
            received={received}
            declarations={declarations}
            onChanged={onChanged}
            onOpenFolder={diveIntoFolder}
          />
        </div>
      )}

      {tab === 'attendance' && (
        <div className="p-4 space-y-5">
          <AttendanceRoll meetingId={meeting.id} />
          {/* Invitations live with the roll: who was asked sits beside who came. */}
          <MeetingInvitations meetingId={meeting.id} />
        </div>
      )}

      {tab === 'quorum' && (
        <div className="p-4">
          <QuorumPanel meetingId={meeting.id} />
        </div>
      )}

      {tab === 'proxies' && (
        <div className="p-4">
          <ProxiesPanel meeting={meeting} />
        </div>
      )}

      {tab === 'coi' && (
        <div className="p-4">
          <div className="mb-3 flex justify-end">
            {/* The register as a PDF in the board's own document format,
                scoped to this meeting's body — for the pack. */}
            <a
              href={`${apiBase}/register/export.pdf?meetingId=${encodeURIComponent(meeting.id)}`}
              target="_blank"
              rel="noreferrer"
              className="bp-btn bp-btn-secondary"
            >
              <FileDown size={14} /> Conflict register PDF
            </a>
          </div>
          <ConflictAlerts meetingId={meeting.id} />
          <DataState
            loading={coiLoading}
            error={coiError}
            empty={!coiLoading && !coiError && (cois || []).length === 0}
            emptyLabel="No conflicts declared for this meeting"
          />
          {(cois || []).length > 0 && (
            <div className="bp-divide">
              {cois.map((d) => (
                <div key={d.id} className="py-3 flex items-start gap-3">
                  <Avatar name={d.user?.name} initials={d.user?.initials} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{d.user?.name || 'Unknown member'}</p>
                      <Badge status={d.type} />
                      <Badge status={d.effect}>{humanise(d.effect)}</Badge>
                    </div>
                    <p className="text-sm bp-muted mt-1">{d.description}</p>
                    <p className="text-xs bp-subtle mt-1">Declared {fmtDate(d.declaredAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'motions' && (
        <div className="p-4">
          {motions.length === 0 ? (
            <DataState empty emptyLabel="No motions tabled" />
          ) : (
            <div className="bp-divide">
              {motions.map((m) => {
                const votes = m.votes || []
                const forVotes = votes.filter((v) => v.vote === 'FOR').length
                const against = votes.filter((v) => v.vote === 'AGAINST').length
                const abstain = votes.filter((v) => v.vote === 'ABSTAIN').length
                return (
                  <div key={m.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{m.number}</p>
                      <Badge status={m.status} />
                      {m.result && m.result !== m.status && <Badge status={m.result} />}
                    </div>
                    <p className="text-sm mt-1">{m.title}</p>
                    {votes.length > 0 && (
                      <p className="text-xs bp-muted mt-1 tabular-nums">
                        {forVotes} for · {against} against · {abstain} abstain
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'minutes' && (
        <div className="p-4">
          {!minutes ? (
            <DataState empty emptyLabel="Minutes have not been drafted" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge status={minutes.status} />
                {minutes.lockedAt && (
                  <span className="text-xs bp-muted">Locked {fmtDate(minutes.lockedAt)}</span>
                )}
              </div>
              <MinutesBody content={minutes.content} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The agenda, first among the tabs: numbered items, each paper stamped for
 * when it arrived, and any conflict pinned to the item warned right on it.
 */
function AgendaPanel({ meeting, agenda, received, declarations, onChanged, onOpenFolder }) {
  const { capabilities } = useSession()
  const canEdit = capabilities?.manageMeetings
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({})
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ number: '', title: '', presenter: '', duration: '' })

  const sorted = [...agenda].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const syncFromPack = async () => {
    setBusy('sync')
    setNotice(null)
    try {
      const { data } = await api.post(`/pack/${meeting.id}/sync-agenda`, {})
      setNotice({ tone: 'success',
        text: `Agenda synced from the pack: ${data.created} added, ${data.updated} updated, ${data.removed} removed.` })
      await onChanged?.()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const move = async (index, dir) => {
    const a = sorted[index]
    const b = sorted[index + dir]
    if (!a || !b) return
    setBusy(a.id)
    try {
      const aOrder = a.order ?? index
      const bOrder = b.order ?? index + dir
      await api.put(`/agenda/${a.id}`, { order: bOrder })
      await api.put(`/agenda/${b.id}`, { order: aOrder })
      await onChanged?.()
    } finally {
      setBusy(null)
    }
  }

  const saveEdit = async (item) => {
    setBusy(item.id)
    try {
      await api.put(`/agenda/${item.id}`, {
        number: draft.number,
        title: draft.title,
        presenter: draft.presenter || null,
        duration: draft.duration ? Number(draft.duration) : null,
      })
      setEditingId(null)
      await onChanged?.()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const removeItem = async (item) => {
    setBusy(item.id)
    try {
      await api.delete(`/agenda/${item.id}`)
      await onChanged?.()
    } finally {
      setBusy(null)
    }
  }

  const addItem = async (e) => {
    e.preventDefault()
    setBusy('add')
    try {
      const maxOrder = Math.max(0, ...sorted.map((i) => i.order ?? 0))
      await api.post('/agenda', {
        meetingId: meeting.id,
        number: addForm.number || String(sorted.length + 1),
        title: addForm.title,
        presenter: addForm.presenter || null,
        duration: addForm.duration ? Number(addForm.duration) : null,
        order: maxOrder + 1,
      })
      setAddForm({ number: '', title: '', presenter: '', duration: '' })
      setAdding(false)
      await onChanged?.()
    } catch (e2) {
      setNotice({ tone: 'danger', text: e2.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAdding((a) => !a)} className="bp-btn bp-btn-primary">
            {adding ? 'Close' : 'Add item'}
          </button>
          <button onClick={syncFromPack} disabled={busy === 'sync'} className="bp-btn bp-btn-secondary"
            title="Build the agenda from the pack's numbered folders — rename a folder and re-sync, the item follows">
            {busy === 'sync' ? 'Syncing…' : 'Sync from pack'}
          </button>
          <span className="text-xs bp-muted">
            Synced items follow their folder; hand-made items are never touched by a sync.
          </span>
        </div>
      )}

      {adding && (
        <form onSubmit={addItem} className="bp-card p-3 grid gap-2 sm:grid-cols-[4.5rem_1fr_10rem_5rem_auto] sm:items-end">
          <label className="block"><span className="text-xs bp-muted">No.</span>
            <input value={addForm.number} onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))}
              placeholder="7 or 10.01" className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-xs bp-muted">Title</span>
            <input required value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-xs bp-muted">Presenter</span>
            <input value={addForm.presenter} onChange={(e) => setAddForm((f) => ({ ...f, presenter: e.target.value }))}
              className="bp-input w-full mt-1" /></label>
          <label className="block"><span className="text-xs bp-muted">Min</span>
            <input type="number" min="0" value={addForm.duration}
              onChange={(e) => setAddForm((f) => ({ ...f, duration: e.target.value }))} className="bp-input w-full mt-1" /></label>
          <button type="submit" disabled={busy === 'add'} className="bp-btn bp-btn-primary">Add</button>
        </form>
      )}

      {notice && <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>}

      {!sorted.length && (
        <DataState empty emptyLabel="No agenda items — sync from the pack or add them by hand" />
      )}

      <div className="bp-divide">
      {sorted.map((item, index) => {
        const stampInfo = received?.items?.find((r) => r.agendaItemId === item.id)
        const itemConflicts = (declarations || []).filter((d) => d.agendaItemId === item.id)
        const isEditing = editingId === item.id
        return (
          <div key={item.id} className="py-3 flex items-start gap-3">
            <span className="bp-chip bp-chip--primary w-10 h-7 shrink-0 text-xs font-semibold">
              {item.number}
            </span>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={draft.number} onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
                    className="bp-input text-sm py-1 w-20" title="Number" />
                  <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="bp-input text-sm py-1 flex-1 min-w-[12rem]" title="Title" />
                  <input value={draft.presenter || ''} onChange={(e) => setDraft((d) => ({ ...d, presenter: e.target.value }))}
                    placeholder="Presenter" className="bp-input text-sm py-1 w-36" />
                  <input type="number" min="0" value={draft.duration || ''} placeholder="min"
                    onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))} className="bp-input text-sm py-1 w-16" />
                  <button onClick={() => saveEdit(item)} disabled={busy === item.id} className="bp-btn bp-btn-primary"><Check size={13} /></button>
                  <button onClick={() => setEditingId(null)} className="bp-subtle p-1"><X size={13} /></button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {item.sourceFolderId ? (
                      <button
                        onClick={() => onOpenFolder?.(item)}
                        className="text-left hover:underline"
                        style={{ color: 'var(--bp-primary)' }}
                        title="Open this item's folder in the board pack"
                      >
                        {item.title}
                      </button>
                    ) : (
                      item.title
                    )}
                    {item.sourceFolderId && (
                      <span className="bp-badge bp-badge--info ml-2" title="Built from the pack — click the title to open its folder">
                        follows the pack
                      </span>
                    )}
                  </p>
                  <p className="text-xs bp-muted mt-0.5">
                    {item.presenter || 'No presenter'}
                    {item.duration ? ` · ${item.duration} min` : ''}
                  </p>
                </>
              )}

              {(() => {
                // Every paper for this item, wherever it lives: the received
                // stamps cover the SharePoint pack folder, the documents cover
                // papers uploaded here — merged by name so nothing shows twice.
                const docs = item.documents || []
                const stamped = (stampInfo?.files || []).map((f) => ({
                  key: `s-${f.name}`,
                  name: f.name,
                  receivedAt: f.receivedAt,
                  status: f.status,
                  size: docs.find((d) => d.name === f.name)?.size,
                }))
                const files = [
                  ...stamped,
                  ...docs
                    .filter((d) => !stamped.some((f) => f.name === d.name))
                    .map((d) => ({
                      key: `d-${d.id}`, name: d.name, size: d.size,
                      receivedAt: d.modifiedAt || d.createdAt, status: null,
                    })),
                ]
                if (!files.length) return null
                return (
                  <div className="mt-2 space-y-1">
                    {files.map((f) => (
                      <div key={f.key} className="flex flex-wrap items-center gap-2 text-xs bp-muted">
                        <span className="truncate">{f.name}</span>
                        {f.size ? <span className="bp-subtle">{fmtBytes(f.size)}</span> : null}
                        {f.receivedAt && (
                          <span className="bp-subtle" title="When this paper was received">
                            received {fmtDateTime(f.receivedAt)}
                          </span>
                        )}
                        {f.status && (
                          <span className={`bp-badge bp-badge--${
                            f.status === 'ON_TIME' ? 'success' : f.status === 'LATE' ? 'warning' : 'danger'
                          }`}>
                            {f.status === 'ON_TIME' ? 'on time' : f.status === 'LATE' ? 'late' : 'after board date'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {itemConflicts.map((d) => (
                <div key={d.id} className="mt-2 p-2 rounded-md text-xs"
                  style={{ background: 'var(--bp-warning-bg)', color: 'var(--bp-warning-fg)' }}>
                  <b>⚠ Conflict — {d.user?.name || 'Member'}:</b> {d.description}
                  <span className="opacity-80"> ({humanise(d.effect === 'PENDING' ? 'not yet resolved' : d.effect)})</span>
                </div>
              ))}
            </div>

            {canEdit && !isEditing && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => move(index, -1)} disabled={index === 0 || busy}
                  className="bp-subtle hover:text-[var(--bp-fg)] p-1" title="Move up">↑</button>
                <button onClick={() => move(index, 1)} disabled={index === sorted.length - 1 || busy}
                  className="bp-subtle hover:text-[var(--bp-fg)] p-1" title="Move down">↓</button>
                <button onClick={() => { setEditingId(item.id); setDraft({ number: item.number, title: item.title, presenter: item.presenter, duration: item.duration }) }}
                  className="bp-subtle hover:text-[var(--bp-fg)] p-1" title="Edit item">✎</button>
                <button onClick={() => removeItem(item)} disabled={busy === item.id}
                  className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1" title="Remove item">✕</button>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

/**
 * Standing register interests relevant to this meeting's attendees — surfaced
 * where the chair needs them, before an item is taken. The register page is
 * the archive; the meeting is where it must show up.
 */
function ConflictAlerts({ meetingId }) {
  const { data } = useApi(`/coi/alerts/${meetingId}`)
  if (!data || (data.totalStandingInterests === 0 && data.unresolvedDeclarations === 0)) return null

  return (
    <div className="mb-4 space-y-2">
      {data.unresolvedDeclarations > 0 && (
        <div className="p-3 rounded-lg text-sm flex items-start gap-2"
          style={{ background: 'var(--bp-danger-bg)', color: 'var(--bp-danger-fg)' }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {data.unresolvedDeclarations} declaration{data.unresolvedDeclarations === 1 ? '' : 's'} at this
            meeting still need{data.unresolvedDeclarations === 1 ? 's' : ''} a resolution from the board.
          </span>
        </div>
      )}
      {data.standing.length > 0 && (
        <div className="p-3 rounded-lg text-sm"
          style={{ background: 'var(--bp-warning-bg)', color: 'var(--bp-warning-fg)' }}>
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={15} /> Standing interests on the register for attendees
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.standing.map((m) => (
              <li key={m.userId}>
                <span className="font-medium">{m.member}</span>
                {': '}
                {m.interests.slice(0, 3).map((i) => i.interest).join('; ')}
                {m.interests.length > 3 ? ` — and ${m.interests.length - 3} more` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Proxies for this sitting: who assigned their vote, and to whom. Registering
 * needs administrator rights, both people must be on the invitation list, and
 * the meeting must have been scheduled with proxy voting allowed.
 */
function ProxiesPanel({ meeting }) {
  const { data, loading, error, refetch } = useApi(`/proxies?meetingId=${encodeURIComponent(meeting.id)}`)
  const { data: knownEntities } = useApi('/proxies/entities')
  const { capabilities } = useSession()
  // The grantor is a member on the list, or an entity - lodge, company,
  // association - recorded by name, as the FF count sheets are kept.
  const [grantorType, setGrantorType] = useState('MEMBER')
  const [fromId, setFromId] = useState('')
  const [entityName, setEntityName] = useState('')
  const [entityKind, setEntityKind] = useState('LODGE')
  const [votes, setVotes] = useState(1)
  const [toId, setToId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const proxies = data?.proxies || []
  const summary = data?.summary || []
  const invitations = meeting.invitations || []
  const canManage = capabilities?.manageMeetings

  if (meeting.proxiesAllowed === false) {
    return (
      <DataState
        empty
        emptyLabel="Proxy voting is not allowed for this meeting — an administrator can change that in Edit Meeting"
      />
    )
  }

  const register = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await api.post('/proxies', {
        meetingId: meeting.id,
        toUserId: toId,
        votes,
        ...(grantorType === 'MEMBER'
          ? { fromUserId: fromId }
          : { grantorName: entityName, grantorKind: entityKind }),
      })
      setFromId(''); setEntityName(''); setVotes(1); setToId('')
      await refetch()
    } catch (e) {
      setNotice(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p) => {
    setBusy(true)
    try {
      await api.delete(`/proxies/${p.id}`)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const KIND_LABEL = { LODGE: 'Lodge', COMPANY: 'Company', ASSOCIATION: 'Association', OTHER: 'Other' }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="bp-card p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs font-medium bp-muted">Proxy granted by</span>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={grantorType === 'MEMBER'} onChange={() => setGrantorType('MEMBER')} />
              A member
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={grantorType === 'ENTITY'} onChange={() => setGrantorType('ENTITY')} />
              A lodge, company or association
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {grantorType === 'MEMBER' ? (
              <label className="block">
                <span className="text-xs font-medium bp-muted">Member assigning their vote</span>
                <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="bp-input w-52 mt-1">
                  <option value="">Choose…</option>
                  {invitations.map((i) => (
                    <option key={i.userId} value={i.userId}>{i.user?.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-medium bp-muted">Entity name</span>
                  <input
                    value={entityName}
                    onChange={(e) => {
                      const v = e.target.value
                      setEntityName(v)
                      // Picking a known entity carries its kind across.
                      const hit = (knownEntities || []).find((k) => k.name.toLowerCase() === v.toLowerCase())
                      if (hit) setEntityKind(hit.kind)
                    }}
                    list="known-entities"
                    placeholder="Choose from the list or type a new one"
                    className="bp-input w-64 mt-1"
                  />
                  <datalist id="known-entities">
                    {(knownEntities || []).map((k) => (
                      <option key={k.name} value={k.name}>{k.kind.toLowerCase()}</option>
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-medium bp-muted">Kind</span>
                  <select value={entityKind} onChange={(e) => setEntityKind(e.target.value)} className="bp-input mt-1">
                    <option value="LODGE">Lodge</option>
                    <option value="COMPANY">Company</option>
                    <option value="ASSOCIATION">Association</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              </>
            )}

            <ArrowRight size={16} className="bp-subtle mb-2.5" />

            <label className="block">
              <span className="text-xs font-medium bp-muted">Holds the proxy</span>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="bp-input w-52 mt-1">
                <option value="">Choose…</option>
                {invitations.filter((i) => grantorType !== 'MEMBER' || i.userId !== fromId).map((i) => (
                  <option key={i.userId} value={i.userId}>{i.user?.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium bp-muted" title="Bulk lodgements: one entry, many votes">Votes</span>
              <input type="number" min="1" max="1000" value={votes}
                onChange={(e) => setVotes(Number(e.target.value) || 1)} className="bp-input w-20 mt-1 text-center" />
            </label>

            <button
              onClick={register}
              disabled={busy || !toId || (grantorType === 'MEMBER' ? !fromId : !entityName.trim())}
              className="bp-btn bp-btn-primary"
            >
              Register proxy
            </button>
          </div>
          {notice && <p className="text-sm" style={{ color: 'var(--bp-danger-fg)' }}>{notice}</p>}
        </div>
      )}

      {/* The count sheet: each holder's own vote plus the proxies they hold. */}
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.map((h) => (
            <span key={h.holder} className="bp-badge bp-badge--info" title="Own vote + proxy votes">
              {h.holder}: {h.ownVote} own + {h.proxyVotes} prox{h.proxyVotes === 1 ? 'y' : 'ies'} = {h.total} votes
            </span>
          ))}
        </div>
      )}

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && proxies.length === 0}
        emptyLabel="No proxies registered for this meeting"
        onRetry={refetch}
      />

      {proxies.length > 0 && (
        <div className="bp-divide">
          {proxies.map((p) => (
            <div key={p.id} className="py-2.5 flex items-center gap-3">
              {p.fromUser ? (
                <>
                  <Avatar name={p.fromUser.name} initials={p.fromUser.initials} size={28} />
                  <span className="text-sm font-medium">{p.fromUser.name}</span>
                </>
              ) : (
                <>
                  <span className="bp-chip bp-chip--warning w-7 h-7 shrink-0 text-[10px] font-bold">
                    {(p.grantorKind || 'E').slice(0, 1)}
                  </span>
                  <span className="text-sm font-medium">{p.grantorName}</span>
                  <span className="bp-badge bp-badge--neutral">{KIND_LABEL[p.grantorKind] || p.grantorKind}</span>
                </>
              )}
              {p.votes > 1 && <span className="bp-badge bp-badge--info">×{p.votes} votes</span>}
              <ArrowRight size={14} className="bp-subtle" />
              <Avatar name={p.toUser?.name} initials={p.toUser?.initials} size={28} />
              <span className="text-sm font-medium flex-1">{p.toUser?.name}</span>
              <span className="text-xs bp-muted">Lodged {fmtDate(p.lodgedAt)}</span>
              {canManage && (
                <button onClick={() => remove(p)} disabled={busy}
                  className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5" title="Remove">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Whether the meeting can transact business, from the marked roll.
 *
 * The rule is the board's own: a minimum count of counting members, named
 * officers who must be in the room, and ex officio roles that attend but are
 * not counted.
 */
function QuorumPanel({ meetingId }) {
  const { data, loading, error, refetch } = useApi(`/attendance/roll/${meetingId}`)
  const q = data?.quorum

  if (loading || error || !q) {
    return <DataState loading={loading} error={error} empty={!loading && !error && !q} emptyLabel="No quorum rule configured" onRetry={refetch} />
  }

  return (
    <div className="space-y-4">
      <div
        className="p-4 rounded-lg flex items-start gap-3"
        style={{
          background: q.met ? 'var(--bp-success-bg)' : 'var(--bp-danger-bg)',
          color: q.met ? 'var(--bp-success-fg)' : 'var(--bp-danger-fg)',
        }}
      >
        <Scale size={20} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{q.met ? 'Quorum met' : 'No quorum'}</p>
          <p className="text-sm mt-0.5">{q.message}</p>
        </div>
      </div>

      <div className="bp-divide">
        <div className="py-2.5 flex items-center justify-between">
          <span className="text-sm">Counting members present</span>
          <span className={`bp-badge bp-badge--${q.counted >= q.minimum ? 'success' : 'danger'}`}>
            {q.counted} of {q.minimum} required
          </span>
        </div>
        {q.requirements.map((r) => (
          <div key={r.role} className="py-2.5 flex items-center justify-between">
            <span className="text-sm">{r.role.charAt(0) + r.role.slice(1).toLowerCase()} present</span>
            {r.satisfied
              ? <span className="bp-badge bp-badge--success"><Check size={11} className="mr-1" />Yes</span>
              : <span className="bp-badge bp-badge--danger"><X size={11} className="mr-1" />No</span>}
          </div>
        ))}
        {q.exOfficioRoles.length > 0 && (
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-sm bp-muted">
              Ex officio ({q.exOfficioRoles.map((r) => r.charAt(0) + r.slice(1).toLowerCase()).join(', ')}) — attends, not counted
            </span>
            <span className="bp-badge bp-badge--neutral">{q.exOfficioPresent} present</span>
          </div>
        )}
      </div>

      {/* Who actually constitutes the quorum — for the minutes. */}
      {(q.countedMembers || []).length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide bp-subtle font-medium mb-2">
            Quorum constituted by
          </p>
          <div className="flex flex-wrap gap-2">
            {q.countedMembers.map((m) => (
              <span key={m.member} className="bp-badge bp-badge--success">
                {m.member}{m.role ? ` — ${humanise(m.role)}` : ''}
              </span>
            ))}
            {(q.exOfficioMembers || []).map((m) => (
              <span key={m.member} className="bp-badge bp-badge--neutral" title="Attends ex officio — not counted">
                {m.member}{m.role ? ` — ${humanise(m.role)}` : ''} (ex officio)
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs bp-subtle">
        Updates as the roll is marked on the Attendance tab.
      </p>
    </div>
  )
}

/**
 * Where this meeting's papers come from.
 *
 * Only shown to administrators — a member has no reason to care which store is
 * behind the pack, only that they can read it.
 */
function PackSourcePicker({ meeting }) {
  const { capabilities } = useSession()
  const { data, refetch } = useApi(`/pack/${meeting.id}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!capabilities?.manageMeetings) return null

  const options = [
    { id: 'INHERIT',    label: 'Board default' },
    { id: 'SHAREPOINT', label: 'SharePoint' },
    { id: 'VAULT',      label: 'File vault', disabled: data && !data.vaultAvailable },
    { id: 'LOCAL',      label: 'Upload here' },
  ]

  const change = async (source) => {
    setSaving(true)
    setError(null)
    try {
      await api.put(`/pack/${meeting.id}/source`, { source })
      await refetch()
      // The browser below reads the same endpoint, so nudge a full reload.
      window.dispatchEvent(new Event('board-pack-source-changed'))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const current = data?.packSource || 'INHERIT'

  return (
    <div
      className="px-4 py-2.5 flex flex-wrap items-center gap-2"
      style={{ borderBottom: '1px solid var(--bp-card-border)' }}
    >
      <span className="text-xs bp-muted">Papers from</span>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => change(o.id)}
          disabled={saving || o.disabled}
          title={o.disabled ? 'Provided by the host platform — not available standalone' : undefined}
          className={current === o.id ? 'bp-btn bp-btn-primary' : 'bp-btn bp-btn-secondary'}
          style={o.disabled ? { opacity: 0.45 } : undefined}
        >
          {o.label}
        </button>
      ))}
      {data?.packSource === 'INHERIT' && data?.effectiveSource && (
        <span className="text-xs bp-subtle">→ {data.effectiveSource}</span>
      )}
      {error && <span className="text-xs" style={{ color: 'var(--bp-danger-fg)' }}>{error}</span>}
    </div>
  )
}

/** Minutes.content is a JSON string; render it when it parses. */
function MinutesBody({ content }) {
  let parsed = null
  try { parsed = JSON.parse(content || '{}') } catch { /* not JSON */ }

  if (!parsed || (!parsed.sections && !parsed.present)) {
    return <p className="text-sm bp-muted whitespace-pre-wrap">{content || 'No content recorded.'}</p>
  }

  return (
    <div className="space-y-4">
      {parsed.present && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide bp-subtle font-medium">Present</p>
            <p className="text-sm mt-1">{parsed.present.join(', ')}</p>
          </div>
          {parsed.apologies?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide bp-subtle font-medium">Apologies</p>
              <p className="text-sm mt-1">{parsed.apologies.join(', ')}</p>
            </div>
          )}
        </div>
      )}
      {(parsed.sections || []).map((s, i) => (
        <div key={i}>
          <p className="text-sm font-semibold">{s.heading}</p>
          <p className="text-sm bp-muted mt-0.5">{s.body}</p>
        </div>
      ))}
    </div>
  )
}
