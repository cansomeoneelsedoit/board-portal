import { Vote as VoteIcon } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtDate } from '../lib/format'
import { Badge, Card, DataState, PageHeader } from '../components/ui'

function VoteBar({ votes }) {
  const total = votes.length
  if (!total) return <span className="text-xs bp-subtle">No votes recorded</span>

  const counts = {
    FOR: votes.filter((v) => v.vote === 'FOR').length,
    AGAINST: votes.filter((v) => v.vote === 'AGAINST').length,
    ABSTAIN: votes.filter((v) => v.vote === 'ABSTAIN').length,
  }
  const segments = [
    { key: 'FOR', color: 'var(--bp-success-fg)' },
    { key: 'AGAINST', color: 'var(--bp-danger-fg)' },
    { key: 'ABSTAIN', color: 'var(--bp-subtle)' },
  ]

  return (
    <div className="w-full max-w-xs">
      <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bp-neutral-bg)' }}>
        {segments.map((s) =>
          counts[s.key] ? (
            <div
              key={s.key}
              style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }}
              title={`${s.key}: ${counts[s.key]}`}
            />
          ) : null
        )}
      </div>
      <p className="text-xs bp-muted mt-1.5 tabular-nums">
        {counts.FOR} for · {counts.AGAINST} against · {counts.ABSTAIN} abstain
      </p>
    </div>
  )
}

export default function Motions() {
  const { data, loading, error, refetch } = useApi(endpoints.motions())
  const motions = data || []

  return (
    <div className="space-y-6">
      <PageHeader title="Motions" subtitle="Resolutions tabled before the board" />

      <Card>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && motions.length === 0}
          emptyLabel="No motions tabled"
          onRetry={refetch}
        />
        {!loading && !error && motions.length > 0 && (
          <div className="bp-divide">
            {motions.map((m) => (
              <div key={m.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                <span className="bp-chip bp-chip--primary w-10 h-10 shrink-0">
                  <VoteIcon size={18} />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{m.number}</p>
                    <Badge status={m.status} />
                    {m.result && m.result !== m.status && <Badge status={m.result} />}
                  </div>
                  <p className="text-sm mt-1">{m.title}</p>
                  {m.description && <p className="text-xs bp-muted mt-1">{m.description}</p>}
                  <p className="text-xs bp-subtle mt-1">
                    {m.meeting?.title || 'Unassigned'}
                    {m.passedAt ? ` · decided ${fmtDate(m.passedAt)}` : ''}
                  </p>
                </div>

                <div className="sm:w-56 shrink-0">
                  <VoteBar votes={m.votes || []} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
