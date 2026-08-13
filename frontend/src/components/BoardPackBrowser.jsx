import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Folder, FileText, ChevronRight, ExternalLink, Home, Loader2, AlertCircle, Inbox,
  Upload, Trash2, Cloud, Archive, HardDrive, Download, Camera,
} from 'lucide-react'
import api, { apiBase } from '../lib/api'
import { fmtBytes, fmtDate } from '../lib/format'
import { useSession } from '../lib/useSession'

const SOURCE_META = {
  SHAREPOINT: { label: 'SharePoint',   icon: Cloud,     hint: 'Files live in the document library' },
  VAULT:      { label: 'File vault',   icon: Archive,   hint: 'Files live in the platform vault' },
  LOCAL:      { label: 'Board Portal', icon: HardDrive, hint: 'Files uploaded here' },
}

/**
 * The papers for a meeting, from whichever store it is configured to use.
 *
 * SharePoint folders open in place and files open in SharePoint; locally
 * uploaded papers download directly. Read-only for members regardless of source
 * — uploading and removing need administrator rights, and SharePoint enforces
 * its own permissions on top.
 */
export default function BoardPackBrowser({ meetingId = null, emptyLabel = 'This folder is empty' }) {
  const { capabilities } = useSession()
  const [trail, setTrail] = useState([])
  const [pack, setPack] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const fileInput = useRef(null)
  // Separate input with capture: on a phone this opens the camera directly, so
  // a paper tabled on the floor can be photographed straight into the pack.
  const cameraInput = useRef(null)

  const load = useCallback(async (folderId, resetTrail) => {
    setLoading(true)
    setError(null)
    try {
      const path = meetingId
        ? `/pack/${meetingId}${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`
        : `/sharepoint/browse${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`

      const { data } = await api.get(path)
      setPack(data)
      if (resetTrail) setTrail(data.folder ? [{ id: data.folder.id, name: data.folder.name }] : [])
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
    await load(index === 0 ? null : trail[index].id, index === 0)
    setTrail((t) => t.slice(0, index + 1))
  }

  const upload = async (event, { tabled = false } = {}) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !meetingId) return

    setBusy('upload')
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      if (tabled) {
        // A photo taken on the floor gets a name that says what it is, and a
        // tag so tabled papers are findable afterwards.
        const stamp = new Date().toLocaleString('en-AU', { hour12: false }).replace(/[/:]/g, '-')
        form.append('name', `Tabled on the floor — ${stamp}`)
        form.append('tags', 'tabled')
      }
      const { data } = await api.post(`/pack/${meetingId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setNotice({
        tone: 'success',
        text: `${tabled ? 'Tabled paper' : file.name} added to ${SOURCE_META[data.source]?.label || data.source}`,
      })
      await load(null, true)
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const removeLocal = async (item) => {
    setBusy(item.id)
    setNotice(null)
    try {
      await api.delete(`/pack/${meetingId}/items/${item.documentId}`)
      await load(null, true)
    } catch (e) {
      setNotice({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const source = pack?.effectiveSource || pack?.source
  const meta = SOURCE_META[source] || {}
  const SourceIcon = meta.icon || Folder
  const items = pack?.items || []
  const canUpload = capabilities?.writeDocuments && pack?.canUpload && meetingId

  return (
    <div>
      <div
        className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm"
        style={{ borderBottom: '1px solid var(--bp-card-border)' }}
      >
        {source && (
          <span className="bp-badge bp-badge--neutral gap-1" title={meta.hint}>
            <SourceIcon size={11} /> {meta.label || source}
          </span>
        )}

        {trail.length > 0 && <Home size={13} className="bp-subtle shrink-0" />}
        {trail.map((t, i) => (
          <span key={`${t.id}-${i}`} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight size={12} className="bp-subtle shrink-0" />}
            {i === trail.length - 1 ? (
              <span className="font-medium truncate">{t.name}</span>
            ) : (
              <button onClick={() => jumpTo(i)} className="bp-muted hover:underline truncate">{t.name}</button>
            )}
          </span>
        ))}

        <span className="flex-1" />

        {canUpload && (
          <>
            <button onClick={() => fileInput.current?.click()} disabled={busy === 'upload'} className="bp-btn bp-btn-secondary">
              <Upload size={14} /> {busy === 'upload' ? 'Uploading…' : 'Add paper'}
            </button>
            <button
              onClick={() => cameraInput.current?.click()}
              disabled={busy === 'upload'}
              className="bp-btn bp-btn-secondary"
              title="Photograph a paper tabled on the floor — opens the camera on a phone"
            >
              <Camera size={14} /> Table a paper
            </button>
            <input ref={fileInput} type="file" onChange={upload} className="hidden" />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => upload(e, { tabled: true })}
              className="hidden"
            />
          </>
        )}

        {pack?.folder?.webUrl && (
          <a href={pack.folder.webUrl} target="_blank" rel="noreferrer"
             className="text-xs bp-link inline-flex items-center gap-1 shrink-0">
            <ExternalLink size={12} /> Edit in SharePoint
          </a>
        )}
      </div>

      {notice && (
        <p className="px-4 pt-3 text-sm" style={{ color: `var(--bp-${notice.tone}-fg)` }}>{notice.text}</p>
      )}

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
        <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
          <span className="bp-chip bp-chip--info w-10 h-10"><Inbox size={20} /></span>
          <p className="text-sm bp-muted max-w-md">{pack?.message || emptyLabel}</p>
          {pack?.rootWebUrl && (
            <a href={pack.rootWebUrl} target="_blank" rel="noreferrer" className="bp-btn bp-btn-secondary">
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
                    {item.childCount === null || item.childCount === undefined
                      ? 'Folder'
                      : `${item.childCount} item${item.childCount === 1 ? '' : 's'}`}
                  </span>
                </span>
                <ChevronRight size={16} className="bp-subtle shrink-0" />
              </button>
            ) : (
              <div key={item.id} className="px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--bp-neutral-bg)]">
                <span className="bp-chip bp-chip--info w-9 h-9 shrink-0"><FileText size={17} /></span>
                <a
                  href={item.documentId ? `${apiBase}/../uploads/${item.webUrl.replace(/^\/uploads\//, '')}` : item.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1"
                >
                  <span className="block text-sm font-medium truncate">{item.name}</span>
                  <span className="block text-xs bp-subtle truncate">
                    {fmtBytes(item.size)}
                    {item.modifiedAt ? ` · ${fmtDate(item.modifiedAt)}` : ''}
                    {item.modifiedBy ? ` · ${item.modifiedBy}` : ''}
                  </span>
                </a>
                {item.documentId ? <Download size={15} className="bp-subtle shrink-0" />
                                 : <ExternalLink size={15} className="bp-subtle shrink-0" />}
                {capabilities?.writeDocuments && item.documentId && (
                  <button
                    onClick={() => removeLocal(item)}
                    disabled={busy === item.id}
                    className="bp-subtle hover:text-[var(--bp-danger-fg)] p-1.5 shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
