import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileUp, ShieldAlert, Sparkles } from 'lucide-react'
import api, { apiBase } from '../lib/api'
import { useApi } from '../lib/useApi'
import { Card, CardHeader } from './ui'

/**
 * One board's standing quorum rule, and the constitution behind it.
 *
 * The rule is applied automatically when a meeting is scheduled for this
 * board (still overridable per sitting). A rule can work by NUMBERS AND
 * OFFICES, by NAMING PEOPLE who must be present, or both. Upload the
 * board's constitution and it is kept here — and read for its quorum
 * clauses, which can be applied as the rule with one click.
 */
export default function QuorumRuleCard({ board, onChanged }) {
  const { data: members } = useApi(board ? `/board-members?boardId=${board.id}` : null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [suggested, setSuggested] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!board) return
    const roles = String(board.quorumRequiredRoles || '').toUpperCase()
    const ex = String(board.quorumExOfficioRoles || '').toUpperCase()
    setDraft({
      minimum: board.quorumMinimum ?? 4,
      requireChair: roles.includes('CHAIR'),
      requireTreasurer: roles.includes('TREASURER'),
      secretaryExOfficio: ex.includes('SECRETARY'),
      mandatory: new Set(String(board.quorumMandatoryUserIds || '').split(',').map((s) => s.trim()).filter(Boolean)),
    })
  }, [board?.id, board?.quorumMinimum, board?.quorumRequiredRoles, board?.quorumExOfficioRoles, board?.quorumMandatoryUserIds])

  const toggleMandatory = (userId) =>
    setDraft((d) => {
      const next = new Set(d.mandatory)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return { ...d, mandatory: next }
    })

  const save = async () => {
    setSaving(true)
    setNotice(null)
    try {
      await api.put(`/boards/${board.id}`, {
        quorumMinimum: Number(draft.minimum) || 1,
        quorumRequiredRoles: [
          draft.requireChair ? 'CHAIR' : null,
          draft.requireTreasurer ? 'TREASURER' : null,
        ].filter(Boolean).join(','),
        quorumExOfficioRoles: draft.secretaryExOfficio ? 'SECRETARY' : '',
        quorumMandatoryUserIds: [...draft.mandatory].join(','),
      })
      setNotice({ tone: 'success', text: 'Quorum rule saved — new meetings for this body start from it.' })
      await onChanged?.()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const uploadConstitution = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('upload')
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post(`/boards/${board.id}/constitution`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setNotice({ tone: 'success', text: `${file.name} attached — read it for rules below.` })
      await onChanged?.()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const suggest = async () => {
    setBusy('suggest')
    setNotice(null)
    try {
      const { data } = await api.get(`/boards/${board.id}/constitution/suggest`)
      setSuggested(data)
      if (!data.clauses?.length) {
        setNotice({ tone: 'info', text: 'No quorum clauses found in the constitution.' })
      }
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const applySuggestion = () => {
    setDraft((d) => ({ ...d, minimum: suggested.minimum, requireChair: false, requireTreasurer: false }))
    setNotice({
      tone: 'info',
      text: `Set to the constitution's rule — minimum ${suggested.minimum}, no required offices. Save to keep it.`,
    })
  }

  const currentMembers = (members || []).filter((m) => !m.endedAt)

  if (!board || !draft) return null

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><ShieldAlert size={16} /> Quorum rule</span>}
        action={<span className="text-xs bp-muted">Applied when a meeting is scheduled — overridable per sitting</span>}
      />

      <div className="p-4 space-y-3">
        {/* The governing document, kept with the board. */}
        <div className="bp-card p-3 flex flex-wrap items-center gap-3">
          <BookOpen size={16} className="bp-subtle shrink-0" />
          {board.constitutionPath ? (
            <a
              href={`${apiBase}/../uploads/${board.constitutionPath}`}
              target="_blank"
              rel="noreferrer"
              className="bp-link text-sm truncate flex-1 min-w-[10rem]"
              title="Open the constitution"
            >
              {board.constitutionName}
            </a>
          ) : (
            <span className="text-sm bp-muted flex-1 min-w-[10rem]">No constitution attached yet</span>
          )}
          <button onClick={() => fileInput.current?.click()} disabled={busy === 'upload'} className="bp-btn bp-btn-secondary">
            <FileUp size={14} /> {busy === 'upload' ? 'Uploading…' : board.constitutionPath ? 'Replace' : 'Upload constitution'}
          </button>
          {board.constitutionPath && (
            <button onClick={suggest} disabled={busy === 'suggest'} className="bp-btn bp-btn-secondary"
              title="Read the constitution for its quorum clauses">
              <Sparkles size={14} /> {busy === 'suggest' ? 'Reading…' : 'Read rules from it'}
            </button>
          )}
          <input ref={fileInput} type="file" accept=".pdf,.docx,.txt" onChange={uploadConstitution} className="hidden" />
        </div>

        {suggested?.clauses?.length > 0 && (
          <div className="bp-card p-3 space-y-2" style={{ background: 'var(--bp-info-bg)' }}>
            {suggested.minimum && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm flex-1 min-w-[12rem]">
                  The constitution puts the board quorum at <b>{suggested.minimum}</b>:
                  <span className="bp-muted"> “{suggested.basis}”</span>
                </p>
                <button onClick={applySuggestion} className="bp-btn bp-btn-primary shrink-0">
                  Apply minimum {suggested.minimum}
                </button>
              </div>
            )}
            <details className="text-xs bp-muted">
              <summary className="cursor-pointer">Every quorum clause found ({suggested.clauses.length})</summary>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                {suggested.clauses.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </details>
          </div>
        )}

        <label className="flex items-center justify-between gap-3 max-w-md">
          <span className="text-sm">Minimum counting members</span>
          <input type="number" min="1" max="50" value={draft.minimum}
            onChange={(e) => setDraft((d) => ({ ...d, minimum: e.target.value }))}
            className="bp-input w-20 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.requireChair}
            onChange={(e) => setDraft((d) => ({ ...d, requireChair: e.target.checked }))} />
          Must include the Chair
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.requireTreasurer}
            onChange={(e) => setDraft((d) => ({ ...d, requireTreasurer: e.target.checked }))} />
          Must include the Treasurer
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.secretaryExOfficio}
            onChange={(e) => setDraft((d) => ({ ...d, secretaryExOfficio: e.target.checked }))} />
          Secretary attends ex officio (not counted)
        </label>

        <div>
          <p className="text-sm font-medium mt-2">Named members who must be present</p>
          <p className="text-xs bp-muted mb-2">
            For rules that name people rather than offices — tick anyone whose presence is required.
          </p>
          {currentMembers.length === 0 && (
            <p className="text-sm bp-muted">Nobody is appointed to this body yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {currentMembers.map((m) => (
              <label key={m.id}
                className="flex items-center gap-2 text-sm bp-card px-2.5 py-1.5 cursor-pointer"
                style={draft.mandatory.has(m.userId)
                  ? { background: 'var(--bp-success-bg)', color: 'var(--bp-success-fg)' }
                  : undefined}>
                <input type="checkbox" checked={draft.mandatory.has(m.userId)}
                  onChange={() => toggleMandatory(m.userId)} />
                {m.user?.name}
              </label>
            ))}
          </div>
        </div>

        {notice && (
          <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
        )}

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="bp-btn bp-btn-primary">
            {saving ? 'Saving…' : 'Save quorum rule'}
          </button>
        </div>
      </div>
    </Card>
  )
}
