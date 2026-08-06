import { useMemo, useState } from 'react'
import { FileText, Search, Download, Tag } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { endpoints } from '../lib/api'
import { fmtBytes, fmtDate } from '../lib/format'
import { Card, DataState, PageHeader } from '../components/ui'

export default function Documents() {
  const { data, loading, error, refetch } = useApi(endpoints.documents())
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('all')

  const documents = data || []

  const tags = useMemo(() => {
    const all = new Set()
    documents.forEach((d) => (d.tags || '').split(',').filter(Boolean).forEach((t) => all.add(t.trim())))
    return ['all', ...Array.from(all).sort()]
  }, [documents])

  const filtered = useMemo(
    () =>
      documents.filter((d) => {
        const matchSearch =
          !search ||
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.filename.toLowerCase().includes(search.toLowerCase())
        const matchTag = tag === 'all' || (d.tags || '').split(',').map((t) => t.trim()).includes(tag)
        return matchSearch && matchTag
      }),
    [documents, search, tag]
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Board Packs" subtitle="Papers and supporting documents" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="bp-card flex items-center gap-2 px-3 py-2 flex-1 min-w-[16rem] max-w-sm">
          <Search size={16} className="bp-subtle shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={tag === t ? 'bp-btn bp-btn-primary' : 'bp-btn bp-btn-secondary'}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && filtered.length === 0}
          emptyLabel={documents.length ? 'No documents match' : 'No documents uploaded'}
          onRetry={refetch}
        />
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th className="hidden md:table-cell">Agenda item</th>
                  <th className="hidden sm:table-cell">Tags</th>
                  <th>Size</th>
                  <th className="hidden lg:table-cell">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-[var(--bp-neutral-bg)]">
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="bp-chip bp-chip--info w-8 h-8 shrink-0">
                          <FileText size={15} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{d.name}</p>
                          <p className="text-xs bp-subtle truncate">{d.filename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell bp-muted">
                      {d.agendaItem ? `${d.agendaItem.number}. ${d.agendaItem.title}` : '—'}
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(d.tags || '').split(',').filter(Boolean).map((t) => (
                          <span key={t} className="bp-badge bp-badge--neutral">
                            <Tag size={10} className="mr-1" />{t.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="tabular-nums bp-muted">{fmtBytes(d.size)}</td>
                    <td className="hidden lg:table-cell bp-muted">{fmtDate(d.createdAt)}</td>
                    <td>
                      <a
                        href={`/uploads/${d.path}`}
                        className="bp-subtle hover:text-[var(--bp-fg)] inline-flex p-1"
                        title="Download"
                      >
                        <Download size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
