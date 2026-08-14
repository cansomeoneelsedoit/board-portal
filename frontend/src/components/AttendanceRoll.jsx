import { useState } from 'react'
import { Check, X, Video, MapPin, RotateCcw } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { humanise } from '../lib/format'
import { Avatar, Badge, DataState } from './ui'
import { useSession } from '../lib/useSession'

/**
 * The roll call for a meeting.
 *
 * Lists everyone who was invited and lets the secretary mark them off —
 * Present or Apology — the way a roll is actually taken. Unmarked people show
 * as such rather than defaulting to absent: not yet called is a real state.
 * Members see the same list read-only.
 */
export default function AttendanceRoll({ meetingId }) {
  const { data, loading, error, refetch } = useApi(`/attendance/roll/${meetingId}`)
  const { capabilities } = useSession()
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const roll = data?.roll || []
  const summary = data?.summary
  const canMark = capabilities?.manageMeetings

  // Grouped the way an AGM roll reads: the board itself, then invitees, then
  // guests and ordinary members — who belongs to what is never ambiguous.
  const CATEGORY = (role) => {
    const r = String(role || '').toUpperCase()
    if (['CHAIR', 'SECRETARY', 'TREASURER', 'DIRECTOR', 'COMMITTEE_MEMBER'].includes(r)) return 'The Board'
    if (r === 'INVITEE') return 'Invitees'
    return 'Guests & Members'
  }
  // Boardroom precedence: the Chair leads, officers next, directors, then
  // the Secretary (ex officio) closing the list — then everyone else by name.
  const PRECEDENCE = {
    CHAIR: 0, DEPUTY_CHAIR: 1, VICE_CHAIR: 1, PRESIDENT: 0,
    TREASURER: 2, DIRECTOR: 3, COMMITTEE_MEMBER: 4, SECRETARY: 5,
  }
  const rank = (role) => PRECEDENCE[String(role || '').toUpperCase()] ?? 6

  const groups = ['The Board', 'Invitees', 'Guests & Members']
    .map((label) => ({
      label,
      rows: roll
        .filter((r) => CATEGORY(r.role) === label)
        .sort((a, b) => rank(a.role) - rank(b.role) || String(a.member).localeCompare(String(b.member))),
    }))
    .filter((g) => g.rows.length > 0)

  const toggleVoting = async (row) => {
    if (!row.invitationId || !canMark) return
    setBusy(row.userId)
    try {
      await api.put(`/invitations/${row.invitationId}`, { votingRights: !row.votingRights })
      await refetch()
    } catch (e) {
      setNotice(e.message)
    } finally {
      setBusy(null)
    }
  }

  const mark = async (row, present, mode) => {
    setBusy(row.userId)
    setNotice(null)
    try {
      await api.post('/attendance/mark', {
        meetingId,
        userId: row.userId,
        present,
        ...(mode ? { mode } : {}),
      })
      await refetch()
    } catch (e) {
      setNotice(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {summary && roll.length > 0 && (
        <p className="text-sm bp-muted px-1 pb-3">
          {summary.present} present · {summary.apologies} apolog{summary.apologies === 1 ? 'y' : 'ies'} ·{' '}
          {summary.invited - summary.marked > 0
            ? `${summary.invited - summary.marked} not yet marked`
            : 'roll complete'}
        </p>
      )}

      {notice && <p className="text-sm px-1 pb-2" style={{ color: 'var(--bp-danger-fg)' }}>{notice}</p>}

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && roll.length === 0}
        emptyLabel="Nobody has been invited to this meeting yet — invite people below, then take the roll"
        onRetry={refetch}
      />

      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-1 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide bp-subtle">
            {group.label} ({group.rows.length})
          </p>
          <div className="bp-divide">
          {group.rows.map((row) => (
            <div key={row.userId} className="py-2.5 px-1 flex items-center gap-3">
              <Avatar name={row.member} initials={row.initials} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {row.member}
                  {!row.invited && <span className="text-xs bp-subtle"> · not on the invitation list</span>}
                </p>
                <p className="text-xs bp-muted truncate">
                  {row.role ? humanise(row.role) : '—'}
                  {row.rsvp ? ` · RSVP ${humanise(row.rsvp)}` : ''}
                </p>
              </div>

              {/* Voting or non-voting attendee — click to change (admin). */}
              {row.invitationId && (
                <button
                  onClick={() => toggleVoting(row)}
                  disabled={!canMark || busy === row.userId}
                  className={`bp-badge ${row.votingRights ? 'bp-badge--success' : 'bp-badge--neutral'}`}
                  title={canMark ? 'Click to toggle voting rights' : undefined}
                >
                  {row.votingRights ? 'Voting' : 'Non-voting'}
                </button>
              )}

              {/* Mode toggle only means something once someone is present */}
              {row.present === true && (
                <button
                  onClick={() => canMark && mark(row, true, row.mode === 'VIDEO' ? 'IN_PERSON' : 'VIDEO')}
                  disabled={!canMark || busy === row.userId}
                  className="bp-badge bp-badge--info gap-1"
                  title={canMark ? 'Toggle in person / video' : undefined}
                >
                  {row.mode === 'VIDEO' ? <Video size={11} /> : <MapPin size={11} />}
                  {row.mode === 'VIDEO' ? 'Video' : 'In person'}
                </button>
              )}

              {canMark ? (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Green when marked present, red when apology — the roll
                      reads by colour from across the room. */}
                  <button
                    onClick={() => mark(row, true)}
                    disabled={busy === row.userId}
                    className="bp-btn bp-btn-secondary"
                    style={row.present === true
                      ? { background: 'var(--bp-success-bg)', color: 'var(--bp-success-fg)', borderColor: 'var(--bp-success-fg)', fontWeight: 600 }
                      : undefined}
                    title="Mark present"
                  >
                    <Check size={14} /> Present
                  </button>
                  <button
                    onClick={() => mark(row, false)}
                    disabled={busy === row.userId}
                    className="bp-btn bp-btn-secondary"
                    style={row.present === false
                      ? { background: 'var(--bp-danger-bg)', color: 'var(--bp-danger-fg)', borderColor: 'var(--bp-danger-fg)', fontWeight: 600 }
                      : undefined}
                    title="Mark apology"
                  >
                    <X size={14} /> Apology
                  </button>
                  {row.present !== null && (
                    <button
                      onClick={() => mark(row, null)}
                      disabled={busy === row.userId}
                      className="bp-subtle hover:text-[var(--bp-fg)] p-1.5"
                      title="Clear the mark"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              ) : (
                <span className="shrink-0">
                  {row.present === true && <Badge tone="success">Present</Badge>}
                  {row.present === false && <Badge tone="danger">Apology</Badge>}
                  {row.present === null && <Badge tone="neutral">Not marked</Badge>}
                </span>
              )}
            </div>
          ))}
          </div>
        </div>
      ))}
    </div>
  )
}
