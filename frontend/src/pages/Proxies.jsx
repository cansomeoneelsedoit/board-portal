import { ArrowRight, UserCheck } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtDate } from '../lib/format'
import { Avatar, Card, DataState, PageHeader } from '../components/ui'

export default function Proxies() {
  const { data, loading, error, refetch } = useApi(endpoints.proxies())
  const proxies = data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proxies"
        subtitle="Voting authority lodged by members unable to attend"
      />

      <Card>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && proxies.length === 0}
          emptyLabel="No proxies lodged"
          onRetry={refetch}
        />
        {!loading && !error && proxies.length > 0 && (
          <div className="bp-divide">
            {proxies.map((p) => (
              <div key={p.id} className="p-4 flex flex-wrap items-center gap-4">
                <span className="bp-chip bp-chip--primary w-10 h-10 shrink-0">
                  <UserCheck size={18} />
                </span>

                <div className="flex items-center gap-3 flex-1 min-w-[16rem]">
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar name={p.fromUser?.name} initials={p.fromUser?.initials} size={28} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{p.fromUser?.name || '—'}</span>
                      <span className="block text-xs bp-subtle">Grantor</span>
                    </span>
                  </span>

                  <ArrowRight size={16} className="bp-subtle shrink-0" />

                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar name={p.toUser?.name} initials={p.toUser?.initials} size={28} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{p.toUser?.name || '—'}</span>
                      <span className="block text-xs bp-subtle">Holds the proxy</span>
                    </span>
                  </span>
                </div>

                <span className="text-xs bp-muted shrink-0">Lodged {fmtDate(p.lodgedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
