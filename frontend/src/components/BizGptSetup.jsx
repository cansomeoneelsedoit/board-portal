import { useEffect, useState } from 'react'
import { BrainCircuit, Check, Loader2, PlugZap, X } from 'lucide-react'
import api from '../lib/api'
import { useApi } from '../lib/useApi'
import { Card, CardHeader } from './ui'
import { useSession } from '../lib/useSession'

/**
 * The BizGPT model endpoint — the brain behind "Ask me anything".
 *
 * Points at any OpenAI-compatible endpoint (a gpu.ai instance, a local
 * model, a gateway). Saved in the portal itself, so when a GPU instance
 * changes address, the link is fixed right here and tested with one click.
 */
export default function BizGptSetup() {
  const { capabilities } = useSession()
  const { data, loading, refetch } = useApi('/integrations/bizgpt')
  const [form, setForm] = useState({ baseUrl: '', apiKey: '', model: '' })
  const [seeded, setSeeded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [notice, setNotice] = useState(null)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    if (data && !seeded) {
      setForm({ baseUrl: data.baseUrl || '', apiKey: '', model: data.model || '' })
      setSeeded(true)
    }
  }, [data, seeded])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    setTestResult(null)
    try {
      await api.put('/integrations/bizgpt', form)
      setNotice({ tone: 'success', text: 'Saved — now test the connection.' })
      setForm((f) => ({ ...f, apiKey: '' }))
      await refetch()
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
      const { data: r } = await api.post('/integrations/bizgpt/test')
      setTestResult(r)
    } catch (ex) {
      setTestResult({ ok: false, detail: ex.message })
    } finally {
      setTesting(false)
      await refetch()
    }
  }

  const statusChip = () => {
    if (loading) return null
    if (!data?.configured) return <span className="bp-badge bp-badge--neutral">Not configured</span>
    if (data.source === 'anthropic') return <span className="bp-badge bp-badge--info">Anthropic API</span>
    if (data.status === 'CONNECTED') return <span className="bp-badge bp-badge--success">Connected</span>
    if (data.status === 'ERROR') return <span className="bp-badge bp-badge--danger">Endpoint unreachable</span>
    return <span className="bp-badge bp-badge--warning">Saved — not tested</span>
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#e8622c' }}>
              <BrainCircuit size={15} color="#fff" />
            </span>
            BizGPT — Ask me anything
          </span>
        }
        action={statusChip()}
      />

      <div className="p-4 space-y-3">
        <p className="text-xs bp-muted">
          The model behind the Ask BizGPT button on every meeting. Point it at any OpenAI-compatible
          endpoint — when a GPU instance changes address, fix the link here and test it with one click.
        </p>

        {capabilities?.manageIntegration ? (
          <form onSubmit={save} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Endpoint base URL</span>
              <input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                className="bp-input w-full mt-1"
                placeholder="https://gpu-xxxxxxx.apps.gpu.ai/v1"
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">API key</span>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="bp-input w-full mt-1"
                  placeholder={data?.apiKeyMasked ? `saved (${data.apiKeyMasked}) — blank keeps it` : 'sk-…'}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Model</span>
                <input
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  className="bp-input w-full mt-1"
                  placeholder="nvidia/NVIDIA-Nemotron-…"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={saving} className="bp-btn bp-btn-primary">
                {saving ? 'Saving…' : 'Save endpoint'}
              </button>
              <button type="button" onClick={test} disabled={testing || !data?.configured} className="bp-btn bp-btn-secondary">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </div>

            {notice && (
              <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
            )}
            {testResult && (
              <p className="text-sm inline-flex items-start gap-1.5"
                style={{ color: testResult.ok ? 'var(--bp-success-fg)' : 'var(--bp-danger-fg)' }}>
                {testResult.ok ? <Check size={15} className="shrink-0 mt-0.5" /> : <X size={15} className="shrink-0 mt-0.5" />}
                {testResult.detail}
              </p>
            )}
          </form>
        ) : (
          <p className="text-sm bp-muted">A board administrator manages the BizGPT endpoint.</p>
        )}
      </div>
    </Card>
  )
}
