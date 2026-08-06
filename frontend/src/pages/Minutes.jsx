import { useState } from 'react'
import { ClipboardList, Lock, Check } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtDate } from '../lib/format'
import { Avatar, Badge, Card, CardHeader, DataState, PageHeader } from '../components/ui'

/** Minutes.content is a JSON string; render it if it parses, else show raw. */
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

export default function Minutes() {
  const { data, loading, error, refetch } = useApi(endpoints.minutes())
  const minutes = data || []
  const [openId, setOpenId] = useState(null)

  return (
    <div className="space-y-6">
      <PageHeader title="Minutes" subtitle="Draft, approve and lock the record of proceedings" />

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && minutes.length === 0}
        emptyLabel="No minutes recorded"
        onRetry={refetch}
      />

      <div className="space-y-4">
        {minutes.map((m) => {
          const open = openId === m.id
          return (
            <Card key={m.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <ClipboardList size={16} />
                    {m.meeting?.title || 'Meeting minutes'}
                  </span>
                }
                action={
                  <div className="flex items-center gap-2">
                    <Badge status={m.status} />
                    {m.lockedAt && (
                      <span className="text-xs bp-muted inline-flex items-center gap-1">
                        <Lock size={11} /> Locked {fmtDate(m.lockedAt)}
                      </span>
                    )}
                    <button
                      onClick={() => setOpenId(open ? null : m.id)}
                      className="bp-btn bp-btn-secondary"
                    >
                      {open ? 'Hide' : 'View'}
                    </button>
                  </div>
                }
              />

              {open && (
                <div className="p-5 space-y-5">
                  <MinutesBody content={m.content} />

                  {(m.approvals || []).length > 0 && (
                    <div style={{ borderTop: '1px solid var(--bp-card-border)' }} className="pt-4">
                      <p className="text-xs uppercase tracking-wide bp-subtle font-medium mb-2">
                        Approvals ({m.approvals.length})
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {m.approvals.map((a) => (
                          <span key={a.id} className="flex items-center gap-2 text-sm">
                            <Avatar name={a.user?.name} initials={a.user?.initials} size={26} />
                            <span>{a.user?.name}</span>
                            <Check size={13} style={{ color: 'var(--bp-success-fg)' }} />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
