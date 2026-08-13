import { useState } from 'react'
import { Plus, Check, X, ShieldAlert, CircleSlash, Pencil } from 'lucide-react'
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
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <Avatar name={member.member} initials={member.initials} size={28} />
            {member.member}
          </span>
        }
        action={
          member.notified
            ? <Badge tone="success">Board notified</Badge>
            : <Badge tone="warning">Notification outstanding</Badge>
        }
      />

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
                  <p className="font-medium">{i.interest}</p>
                  {i.status === 'ENDED' && (
                    <p className="text-xs bp-subtle">Ended {fmtDate(i.endedAt)}</p>
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
                        onClick={() => setNotified(i, !i.notified)}
                        disabled={busy === i.id}
                        className="bp-subtle hover:text-[var(--bp-fg)] p-1.5"
                        title={i.notified ? 'Mark not notified' : 'Mark board notified'}
                      >
                        <Pencil size={14} />
                      </button>
                      {i.status !== 'ENDED' && (
                        <button
                          onClick={() => end(i)}
                          disabled={busy === i.id}
                          className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5"
                          title="Position ended — keep on the record"
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

      {(member.interests[0]?.boardSteps || member.interests[0]?.memberActions) && (
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
  const [form, setForm] = useState({
    interest: '',
    category: 'DUTY_TO_DUTY',
    notified: true,
    boardSteps: DEFAULT_BOARD_STEPS,
    memberActions: DEFAULT_MEMBER_ACTIONS,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!userId) { setError('Choose the member first'); return }
    setSaving(true)
    setError(null)
    try {
      await api.post('/register', { userId, ...form })
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
