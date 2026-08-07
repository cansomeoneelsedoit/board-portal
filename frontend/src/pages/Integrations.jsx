import { useState } from 'react'
import { Mail, MessageSquare, PenTool, Plug, RefreshCw } from 'lucide-react'
import api, { endpoints } from '../lib/api'
import { useApi } from '../lib/useApi'
import { Badge, Card, DataState, PageHeader } from '../components/ui'
import SharePointSetup from '../components/SharePointSetup'

// SharePoint is a real integration handled by SharePointSetup; the rest are
// still placeholder rows in the Integration table.
const CATALOGUE = {
  outlook:    { label: 'Outlook Calendar', icon: Mail,          blurb: 'Push meetings and invitations to calendars' },
  teams:      { label: 'Microsoft Teams',  icon: MessageSquare, blurb: 'Create a meeting link for each sitting' },
  docusign:   { label: 'DocuSign',         icon: PenTool,       blurb: 'Circulate minutes for electronic signature' },
}

export default function Integrations() {
  const { data, loading, error, refetch } = useApi(endpoints.integrations())
  const [busy, setBusy] = useState(null)
  const [saveError, setSaveError] = useState(null)

  // SharePoint has its own card below with live connection state.
  const integrations = (data || []).filter((i) => i.provider !== 'sharepoint')

  const toggle = async (integration) => {
    const next = integration.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED'
    setBusy(integration.id)
    setSaveError(null)
    try {
      await api.put(`${endpoints.integrations()}/${integration.id}`, { status: next })
      await refetch()
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Connected services feeding the board portal"
        actions={
          <button onClick={refetch} className="bp-btn bp-btn-secondary">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <SharePointSetup />

      {saveError && (
        <div className="bp-card p-3 text-sm" style={{ color: 'var(--bp-danger-fg)' }}>
          {saveError}
        </div>
      )}

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && integrations.length === 0}
        emptyLabel="No integrations configured"
        onRetry={refetch}
      />

      {!loading && !error && integrations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {integrations.map((i) => {
            const meta = CATALOGUE[i.provider] || { label: i.provider, icon: Plug, blurb: '' }
            const Icon = meta.icon
            const connected = i.status === 'CONNECTED'
            let config = {}
            try { config = JSON.parse(i.config || '{}') } catch { /* keep empty */ }

            return (
              <Card key={i.id} className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span className={`bp-chip ${connected ? 'bp-chip--success' : 'bp-chip--info'} w-11 h-11 shrink-0`}>
                    <Icon size={20} />
                  </span>
                  <Badge status={i.status} />
                </div>

                <div className="flex-1">
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-sm bp-muted mt-1">{meta.blurb}</p>
                  {Object.keys(config).length > 0 && (
                    <dl className="mt-3 space-y-1">
                      {Object.entries(config).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <dt className="bp-subtle capitalize">{k}:</dt>
                          <dd className="bp-muted truncate">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <button
                  onClick={() => toggle(i)}
                  disabled={busy === i.id}
                  className={connected ? 'bp-btn bp-btn-secondary w-full justify-center' : 'bp-btn bp-btn-primary w-full justify-center'}
                >
                  {busy === i.id ? 'Saving…' : connected ? 'Disconnect' : 'Connect'}
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
