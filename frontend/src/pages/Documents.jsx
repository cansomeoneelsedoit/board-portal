import { useMemo, useRef, useState } from 'react'
import {
  FileText, Search, Download, Tag, Upload, RefreshCw, ExternalLink, Trash2, CloudOff, Cloud,
} from 'lucide-react'
import api, { apiBase, endpoints } from '../lib/api'
import { useApi } from '../lib/useApi'
import { fmtBytes, fmtDate } from '../lib/format'
import { Card, DataState, PageHeader } from '../components/ui'

export default function Documents() {
  const { data, loading, error, refetch } = useApi(endpoints.documents())
  // Whether credentials *work*, not merely whether they are set — a token can be
  // issued for an app registration that has no permissions at all.
  const { data: spStatus } = useApi('/sharepoint/status')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('all')
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const fileInput = useRef(null)

  const documents = data?.documents || []
  const linked = data?.linked
  const configured = data?.configured

  const tags = useMemo(() => {
    const all = new Set()
    documents.forEach((d) => (d.tags || '').split(',').filter(Boolean).forEach((t) => all.add(t.trim())))
    return ['all', ...Array.from(all).sort()]
  }, [documents])

  const filtered = useMemo(
    () =>
      documents.filter((d) => {
        const q = search.toLowerCase()
        const matchSearch =
          !search ||
          d.name.toLowerCase().includes(q) ||
          (d.filename || '').toLowerCase().includes(q) ||
          (d.sharepointFolder || '').toLowerCase().includes(q)
        const matchTag = tag === 'all' || (d.tags || '').split(',').map((t) => t.trim()).includes(tag)
        return matchSearch && matchTag
      }),
    [documents, search, tag]
  )

  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy('upload')
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setNotice({ tone: 'success', text: `${file.name} uploaded to SharePoint` })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const sync = async () => {
    setBusy('sync')
    setNotice(null)
    try {
      const res = await api.post('/documents/sync', {})
      setNotice({ tone: 'success', text: `Reconciled ${res.data.synced} file(s) with SharePoint` })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (doc) => {
    setBusy(doc.id)
    setNotice(null)
    try {
      await api.delete(`/documents/${doc.id}`)
      setNotice({ tone: 'success', text: `${doc.name} deleted from SharePoint` })
      await refetch()
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board Packs"
        subtitle={
          linked
            ? `Stored in SharePoint${data?.folder?.name ? ` — ${data.folder.name}` : ''}`
            : 'Papers and supporting documents'
        }
        actions={
          <div className="flex items-center gap-2">
            {linked && (
              <>
                <button onClick={sync} disabled={busy} className="bp-btn bp-btn-secondary">
                  <RefreshCw size={15} className={busy === 'sync' ? 'animate-spin' : undefined} />
                  Refresh
                </button>
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  className="bp-btn bp-btn-primary"
                >
                  <Upload size={15} /> {busy === 'upload' ? 'Uploading…' : 'Upload'}
                </button>
                <input ref={fileInput} type="file" onChange={upload} className="hidden" />
              </>
            )}
            {data?.folder?.webUrl && (
              <a
                href={data.folder.webUrl}
                target="_blank"
                rel="noreferrer"
                className="bp-btn bp-btn-secondary"
              >
                <ExternalLink size={15} /> Open in SharePoint
              </a>
            )}
          </div>
        }
      />

      {!loading && !linked && (
        <Card className="p-4 flex items-start gap-3">
          <span className="bp-chip bp-chip--warning w-9 h-9 shrink-0"><CloudOff size={18} /></span>
          <div className="text-sm">
            <p className="font-medium">
              {configured && spStatus && !spStatus.reachable
                ? 'SharePoint access is not granted yet'
                : 'SharePoint is not linked yet'}
            </p>
            <p className="bp-muted mt-1">
              {!configured
                ? 'Add the Microsoft credentials to the backend, then pick a destination folder on the Integrations page. Until then this list shows locally recorded documents only.'
                : spStatus && !spStatus.reachable
                  ? spStatus.message
                  : 'Credentials are working — choose a destination folder on the Integrations page to start storing board packs in SharePoint.'}
            </p>
            <p className="bp-subtle mt-2 text-xs">
              This list shows locally recorded documents only.
            </p>
          </div>
        </Card>
      )}

      {linked && (
        <Card className="p-3 flex items-center gap-3">
          <span className="bp-chip bp-chip--success w-8 h-8 shrink-0"><Cloud size={16} /></span>
          <p className="text-sm bp-muted">
            SharePoint holds these files. Upload here or drop a file straight into the folder —
            both show up in both places, because there is only one copy.
          </p>
        </Card>
      )}

      {notice && (
        <Card className="p-3">
          <p className="text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
        </Card>
      )}

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
          emptyLabel={documents.length ? 'No documents match' : 'No documents yet'}
          onRetry={refetch}
        />
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th className="hidden lg:table-cell">Folder</th>
                  <th className="hidden md:table-cell">Agenda item</th>
                  <th className="hidden sm:table-cell">Tags</th>
                  <th>Size</th>
                  <th className="hidden xl:table-cell">Modified</th>
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
                    <td className="hidden lg:table-cell bp-muted">{d.sharepointFolder || '—'}</td>
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
                    <td className="hidden xl:table-cell bp-muted">
                      {fmtDate(d.modifiedAt || d.createdAt)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {d.sharepointWebUrl && (
                          <a
                            href={d.sharepointWebUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bp-subtle hover:text-[var(--bp-fg)] inline-flex p-1.5"
                            title="Open in SharePoint"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                        {d.source === 'SHAREPOINT' && (
                          <a
                            href={`${apiBase}/documents/${d.id}/download`}
                            className="bp-subtle hover:text-[var(--bp-fg)] inline-flex p-1.5"
                            title="Download"
                          >
                            <Download size={15} />
                          </a>
                        )}
                        {linked && (
                          <button
                            onClick={() => remove(d)}
                            disabled={busy === d.id}
                            className="bp-subtle hover:text-[var(--bp-danger-fg)] inline-flex p-1.5"
                            title="Delete from SharePoint"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
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
