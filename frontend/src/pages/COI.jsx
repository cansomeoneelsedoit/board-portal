import { AlertTriangle } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtDate, humanise } from '../lib/format'
import { Avatar, Badge, Card, DataState, PageHeader, StatTile } from '../components/ui'

export default function COI() {
  const { data, loading, error, refetch } = useApi(endpoints.coi())
  const declarations = data || []

  const material = declarations.filter((d) => d.type === 'MATERIAL_PERSONAL').length
  const abstaining = declarations.filter((d) => d.effect === 'ABSTAIN').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="COI Register"
        subtitle="Declared conflicts of interest and their effect on voting"
      />

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && declarations.length === 0}
        emptyLabel="No conflicts declared"
        onRetry={refetch}
      />

      {!loading && !error && declarations.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Declarations" value={declarations.length} sub="On the register" icon={AlertTriangle} tone="warning" />
            <StatTile label="Material personal" value={material} sub="Highest category" icon={AlertTriangle} tone="danger" />
            <StatTile label="Requiring abstention" value={abstaining} sub="Member must not vote" icon={AlertTriangle} tone="info" />
          </div>

          <Card>
            <div className="bp-divide">
              {declarations.map((d) => (
                <div key={d.id} className="p-4 flex items-start gap-3">
                  <Avatar name={d.user?.name} initials={d.user?.initials} size={36} />
                  <div className="flex-1 min-w-0">
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
          </Card>
        </>
      )}
    </div>
  )
}
