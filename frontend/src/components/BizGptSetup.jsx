import { useState } from 'react'
import { BrainCircuit, Check, Loader2, PlugZap, Star, X } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { Card, CardHeader } from './ui'
import { useSession } from '../lib/useSession'
import { fmtDateTime } from '../lib/format'

/**
 * The AI providers behind "Ask me anything".
 *
 * Several can be configured at once — a BizGPT / gpu.ai endpoint, Anthropic,
 * OpenAI, Gemini. One is ACTIVE (answers first); the others are fallbacks
 * that take over automatically if it fails. Each has its own key, model,
 * and one-click Test, so a dead endpoint never takes the feature down.
 */
export default function BizGptSetup() {
  const { capabilities } = useSession()
  const { data, loading, refetch } = useApi('/integrations/ai')
  const canManage = capabilities?.manageIntegration

  const providers = data?.providers || []
  const active = data?.active

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#e8622c' }}>
              <BrainCircuit size={15} color="#fff" />
            </span>
            Ask me anything — AI providers
          </span>
        }
        action={
          !loading && (
            active
              ? <span className="bp-badge bp-badge--success">Active: {providers.find((p) => p.id === active)?.label || active}</span>
              : <span className="bp-badge bp-badge--neutral">No provider configured</span>
          )
        }
      />

      <div className="p-4 space-y-3">
        <p className="text-xs bp-muted">
          The brains behind the Ask BizGPT button on every meeting. Configure one or more; the <b>active</b> provider
          answers first and the others are automatic fallbacks — if the active one is down, the next healthy provider
          answers and the chat says who did.
        </p>

        {providers.map((p) => (
          <ProviderRow key={p.id} p={p} isActive={p.id === active} canManage={canManage} onChanged={refetch} />
        ))}
      </div>
    </Card>
  )
}

function ProviderRow({ p, isActive, canManage, onChanged }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ baseUrl: p.baseUrl || '', apiKey: '', model: p.model || '' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [notice, setNotice] = useState(null)
  const [testResult, setTestResult] = useState(null)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    setTestResult(null)
    try {
      await api.put(`/integrations/ai/${p.id}`, form)
      setNotice({ tone: 'success', text: 'Saved — now test it.' })
      setForm((f) => ({ ...f, apiKey: '' }))
      await onChanged()
    } catch (ex) {
      setNotice({ tone: 'danger', text: ex.message })
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { data: r } = await api.post(`/integrations/ai/${p.id}/test`)
      setTestResult(r)
    } catch (ex) {
      setTestResult({ ok: false, detail: ex.message })
    } finally {
      setTesting(false)
      await onChanged()
    }
  }

  const activate = async () => {
    setNotice(null)
    try {
      await api.post(`/integrations/ai/${p.id}/activate`)
      await onChanged()
    } catch (ex) {
      setNotice({ tone: 'danger', text: ex.message })
    }
  }

  const toggleEnabled = async () => {
    try {
      await api.put(`/integrations/ai/${p.id}`, { enabled: !p.enabled })
      await onChanged()
    } catch (ex) {
      setNotice({ tone: 'danger', text: ex.message })
    }
  }

  const statusChip = () => {
    if (!p.configured) return <span className="bp-badge bp-badge--neutral">Not configured</span>
    if (!p.enabled) return <span className="bp-badge bp-badge--neutral">Disabled</span>
    if (p.status === 'CONNECTED') return <span className="bp-badge bp-badge--success">Connected</span>
    if (p.status === 'ERROR') return <span className="bp-badge bp-badge--danger">Unreachable</span>
    return <span className="bp-badge bp-badge--warning">Not tested</span>
  }

  return (
    <div className="bp-card overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
        {isActive
          ? <Star size={15} style={{ color: '#e8622c', fill: '#e8622c' }} title="Active — answers first" />
          : <Star size={15} className="bp-subtle" />}
        <button onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-left flex-1 min-w-[10rem] hover:underline">
          {p.label}
          {p.model && <span className="bp-muted font-normal"> · {p.model}</span>}
        </button>
        {statusChip()}
        {canManage && (
          <>
            {p.configured && !isActive && (
              <button onClick={activate} className="bp-btn bp-btn-secondary" title="Make this the provider that answers first">
                <Star size={13} /> Make active
              </button>
            )}
            <button onClick={test} disabled={testing || !p.configured} className="bp-btn bp-btn-secondary">
              {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
              {testing ? 'Testing…' : 'Test'}
            </button>
            <button onClick={() => setOpen((o) => !o)} className="bp-btn bp-btn-secondary">
              {open ? 'Close' : p.configured ? 'Edit' : 'Set up'}
            </button>
          </>
        )}
      </div>

      {(testResult || p.lastDetail) && (
        <p className="px-3 pb-2 text-xs inline-flex items-start gap-1.5"
          style={{ color: (testResult ? testResult.ok : p.status === 'CONNECTED') ? 'var(--bp-success-fg)' : 'var(--bp-danger-fg)' }}>
          {(testResult ? testResult.ok : p.status === 'CONNECTED')
            ? <Check size={13} className="shrink-0 mt-0.5" />
            : <X size={13} className="shrink-0 mt-0.5" />}
          <span>
            {testResult ? testResult.detail : p.lastDetail}
            {!testResult && p.lastTestedAt ? <span className="bp-subtle"> · tested {fmtDateTime(p.lastTestedAt)}</span> : null}
          </span>
        </p>
      )}

      {open && canManage && (
        <form onSubmit={save} className="p-3 space-y-3" style={{ borderTop: '1px solid var(--bp-card-border)' }}>
          {p.needsBaseUrl && (
            <label className="block">
              <span className="text-xs bp-muted">Endpoint base URL</span>
              <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                className="bp-input w-full mt-1" placeholder="https://llm.v2.bizgpt.com.au/v1" required />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs bp-muted">API key</span>
              <input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="bp-input w-full mt-1"
                placeholder={p.apiKeyMasked ? `saved (${p.apiKeyMasked}) — blank keeps it` : 'paste key'} />
            </label>
            <label className="block">
              <span className="text-xs bp-muted">Model</span>
              <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="bp-input w-full mt-1" placeholder={p.model} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {p.configured && (
              <label className="flex items-center gap-2 text-sm ml-2">
                <input type="checkbox" checked={p.enabled} onChange={toggleEnabled} />
                Enabled as a fallback
              </label>
            )}
          </div>
          {notice && <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>}
        </form>
      )}
    </div>
  )
}
