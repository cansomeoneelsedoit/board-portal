import { useState } from 'react'
import {
  FolderOpen, Users, AlertTriangle, Vote as VoteIcon, ClipboardList, Check, X, Video, MapPin,
} from 'lucide-react'
import clsx from 'clsx'
import { useApi } from '../lib/useApi'
import api from '../lib/api'
import { useSession } from '../lib/useSession'
import { fmtDate, humanise } from '../lib/format'
import { Avatar, Badge, DataState } from './ui'
import BoardPackBrowser from './BoardPackBrowser'
import AttendanceRoll from './AttendanceRoll'

/**
 * The meeting hub.
 *
 * A board meeting is one thing, not six registers. The pack, who was there,
 * what was declared and what was resolved all belong to the same sitting, so
 * they are tabs of one page rather than separate destinations.
 */
export default function MeetingTabs({ meeting }) {
  const [tab, setTab] = useState('attendance')

  const attendances = meeting.attendances || []
  const motions = meeting.motions || []
  const minutes = meeting.minutes || null

  // COI has a meetingId but no relation on the meeting query, so fetch it here.
  const { data: cois, loading: coiLoading, error: coiError } =
    useApi(`/coi?meetingId=${encodeURIComponent(meeting.id)}`)

  // Order follows how a meeting actually runs: who is here, what they must
  // declare, confirmation of the last minutes, then the papers, then what gets
  // resolved.
  const tabs = [
    { id: 'attendance', label: 'Attendance',  icon: Users,          count: (meeting.invitations || []).length },
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

      {tab === 'attendance' && (
        <div className="p-4">
          <AttendanceRoll meetingId={meeting.id} />
        </div>
      )}

      {tab === 'coi' && (
        <div className="p-4">
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
