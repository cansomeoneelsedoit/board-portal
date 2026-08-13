import { useCallback, useEffect, useState } from 'react'
import {
  Folder, FileText, ChevronRight, ExternalLink, Home, Loader2, AlertCircle, Inbox,
} from 'lucide-react'
import api from '../lib/api'
import { fmtBytes, fmtDate } from '../lib/format'

/**
 * Read-only browser over a SharePoint folder.
 *
 * Members walk the real folder structure one level at a time — nothing is
 * copied or mirrored, so what they see is what is in SharePoint right now.
 * Opening a file hands off to SharePoint, which is also where permissions are
 * enforced: this component never edits, and a member who lacks access in
 * SharePoint will be refused there even though the name is listed here.
 */
export default function BoardPackBrowser({
  // Browse the whole board library, or one meeting's pack.
  meetingId = null,
  emptyLabel = 'This folder is empty',
}) {
  const [trail, setTrail] = useState([])       // [{id, name}], root first
  const [items, setItems] = useState([])
  const [folder, setFolder] = useState(null)
  const [rootWebUrl, setRootWebUrl] = useState(null)
  const [expected, setExpected] = useState(null)
  const [linked, setLinked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (folderId, resetTrail) => {
    setLoading(true)
    setError(null)
    try {
      const path = meetingId && !folderId
        ? `/sharepoint/pack/${meetingId}`
        : `/sharepoint/browse${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`

      const { data } = await api.get(path)

      setLinked(data.linked !== false)
      setItems(data.items || [])
      setFolder(data.folder || null)
      setExpected(data.expectedFolder || null)
      setRootWebUrl(data.rootWebUrl || data.root?.webUrl || data.folder?.webUrl || null)

      if (resetTrail && data.folder) setTrail([{ id: data.folder.id, name: data.folder.name }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => { load(null, true) }, [load])

  const openFolder = async (item) => {
    await load(item.id, false)
    setTrail((t) => [...t, { id: item.id, name: item.name }])
  }

  const jumpTo = async (index) => {
    const target = trail[index]
    await load(index === 0 ? null : target.id, index === 0)
    setTrail((t) => t.slice(0, index + 1))
  }

  if (!linked) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bp-chip bp-chip--info w-10 h-10"><Inbox size={20} /></span>
        <p className="text-sm bp-muted">No SharePoint folder is linked yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb — how members get back out of a deep folder */}
      <div
        className="px-4 py-2.5 flex flex-wrap items-center gap-1 text-sm"
        style={{ borderBottom: '1px solid var(--bp-card-border)' }}
      >
        <Home size={13} className="bp-subtle shrink-0" />
        {trail.map((t, i) => (
          <span key={`${t.id}-${i}`} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight size={12} className="bp-subtle shrink-0" />}
            {i === trail.length - 1 ? (
              <span className="font-medium truncate">{t.name}</span>
            ) : (
              <button onClick={() => jumpTo(i)} className="bp-muted hover:underline truncate">
                {t.name}
              </button>
            )}
          </span>
        ))}
        <span className="flex-1" />
        {(folder?.webUrl || rootWebUrl) && (
          <a
            href={folder?.webUrl || rootWebUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs bp-link inline-flex items-center gap-1 shrink-0"
            title="Open this folder in SharePoint to edit"
          >
            <ExternalLink size={12} /> Edit in SharePoint
          </a>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 bp-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="bp-chip bp-chip--danger w-10 h-10"><AlertCircle size={20} /></span>
          <p className="text-sm bp-muted max-w-md">{error}</p>
          <button onClick={() => load(null, true)} className="bp-btn bp-btn-secondary">Try again</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="bp-chip bp-chip--info w-10 h-10"><Inbox size={20} /></span>
          <p className="text-sm bp-muted">
            {expected
              ? `No pack yet — create a folder named “${expected}” in SharePoint.`
              : emptyLabel}
          </p>
          {expected && rootWebUrl && (
            <a href={rootWebUrl} target="_blank" rel="noreferrer" className="bp-btn bp-btn-secondary">
              <ExternalLink size={15} /> Open the library
            </a>
          )}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="bp-divide">
          {items.map((item) =>
            item.isFolder ? (
              <button
                key={item.id}
                onClick={() => openFolder(item)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--bp-neutral-bg)]"
              >
                <span className="bp-chip bp-chip--warning w-9 h-9 shrink-0"><Folder size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{item.name}</span>
                  <span className="block text-xs bp-subtle">
                    {item.childCount === null ? 'Folder' : `${item.childCount} item${item.childCount === 1 ? '' : 's'}`}
                  </span>
                </span>
                <ChevronRight size={16} className="bp-subtle shrink-0" />
              </button>
            ) : (
              <a
                key={item.id}
                href={item.webUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--bp-neutral-bg)]"
              >
                <span className="bp-chip bp-chip--info w-9 h-9 shrink-0"><FileText size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{item.name}</span>
                  <span className="block text-xs bp-subtle truncate">
                    {fmtBytes(item.size)}
                    {item.modifiedAt ? ` · ${fmtDate(item.modifiedAt)}` : ''}
                    {item.modifiedBy ? ` · ${item.modifiedBy}` : ''}
                  </span>
                </span>
                <ExternalLink size={15} className="bp-subtle shrink-0" />
              </a>
            )
          )}
        </div>
      )}
    </div>
  )
}
