import { useEffect, useState } from 'react'
import {
  Cloud, CloudOff, ChevronRight, Folder, ExternalLink, Check, AlertCircle, Loader2, Home,
} from 'lucide-react'
import api from '../lib/api'
import { Card, CardHeader } from './ui'

/**
 * SharePoint destination picker.
 *
 * Mirrors the SMSF platform's folder picker: resolve a site, list its document
 * libraries, drill into folders, then save the chosen folder against the board.
 * Files themselves are never copied here — the folder is simply where board
 * packs live from then on.
 */
export default function SharePointSetup() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [siteInput, setSiteInput] = useState('')
  const [site, setSite] = useState(null)
  const [drives, setDrives] = useState([])
  const [drive, setDrive] = useState(null)
  const [trail, setTrail] = useState([])          // [{id, name}] — 'root' first
  const [folders, setFolders] = useState([])
  const [working, setWorking] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await api.get('/sharepoint/status')
      setStatus(res.data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  const resolveSite = async (e) => {
    e?.preventDefault()
    setWorking(true)
    setError(null)
    try {
      const params = siteInput.trim() ? { siteId: siteInput.trim() } : {}
      const siteRes = await api.get('/sharepoint/site', { params })
      setSite(siteRes.data)
      const driveRes = await api.get('/sharepoint/drives', { params })
      setDrives(driveRes.data)
      setDrive(null)
      setTrail([])
      setFolders([])
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  const openDrive = async (d) => {
    setWorking(true)
    setError(null)
    try {
      const res = await api.get('/sharepoint/folders', { params: { driveId: d.id, folderId: 'root' } })
      setDrive(d)
      setTrail([{ id: 'root', name: d.name }])
      setFolders(res.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  const openFolder = async (folder, depth) => {
    setWorking(true)
    setError(null)
    try {
      const res = await api.get('/sharepoint/folders', {
        params: { driveId: drive.id, folderId: folder.id },
      })
      setTrail((t) => [...t.slice(0, depth + 1), { id: folder.id, name: folder.name }])
      setFolders(res.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  const saveHere = async () => {
    const current = trail[trail.length - 1]
    if (!drive || !current) return
    setWorking(true)
    setError(null)
    try {
      await api.post('/sharepoint/destination', {
        siteId: site?.id,
        driveId: drive.id,
        folderId: current.id,
      })
      setSite(null); setDrives([]); setDrive(null); setTrail([]); setFolders([])
      await loadStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  const unlink = async () => {
    setWorking(true)
    try {
      await api.delete('/sharepoint/destination')
      await loadStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 bp-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Checking SharePoint…
      </Card>
    )
  }

  const tone = status?.linked && status?.reachable ? 'success' : status?.configured ? 'warning' : 'info'

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {status?.linked ? <Cloud size={16} /> : <CloudOff size={16} />} SharePoint — board packs
          </span>
        }
        action={
          <span className={`bp-badge bp-badge--${tone}`}>
            {status?.linked && status?.reachable
              ? 'Connected'
              : status?.configured
                ? status?.reachable ? 'Not linked' : 'Credentials rejected'
                : 'Not configured'}
          </span>
        }
      />

      <div className="p-5 space-y-4">
        <p className="text-sm bp-muted">{status?.message}</p>

        {error && (
          <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--bp-danger-fg)' }}>
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Not configured — tell them exactly what to set, no picker. */}
        {!status?.configured && (
          <div className="text-sm space-y-2">
            <p className="font-medium">To connect:</p>
            <ol className="list-decimal ml-5 space-y-1 bp-muted">
              <li>Register an app in Azure AD (or reuse the SMSF platform's).</li>
              <li>
                Grant the <strong>application</strong> permission{' '}
                <code className="text-xs">Sites.ReadWrite.All</code> and click{' '}
                <em>Grant admin consent</em>.
              </li>
              <li>
                Set <code className="text-xs">MICROSOFT_TENANT_ID</code>,{' '}
                <code className="text-xs">MICROSOFT_CLIENT_ID</code> and{' '}
                <code className="text-xs">MICROSOFT_CLIENT_SECRET</code> on the backend.
              </li>
            </ol>
          </div>
        )}

        {/* Linked — show where, and allow unlinking. */}
        {status?.linked && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="bp-chip bp-chip--success w-9 h-9"><Folder size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {status.folder?.name || status.board?.name}
              </p>
              <p className="text-xs bp-muted">Board packs are read from and written to this folder</p>
            </div>
            {status.folder?.webUrl && (
              <a href={status.folder.webUrl} target="_blank" rel="noreferrer" className="bp-btn bp-btn-secondary">
                <ExternalLink size={15} /> Open
              </a>
            )}
            <button onClick={unlink} disabled={working} className="bp-btn bp-btn-secondary">
              Unlink
            </button>
          </div>
        )}

        {/* Configured and reachable but not linked — run the picker. */}
        {status?.configured && status?.reachable && !status?.linked && (
          <div className="space-y-4">
            <form onSubmit={resolveSite} className="flex flex-wrap gap-2 items-end">
              <label className="flex-1 min-w-[18rem]">
                <span className="text-sm font-medium">SharePoint site</span>
                <input
                  value={siteInput}
                  onChange={(e) => setSiteInput(e.target.value)}
                  placeholder="contoso.sharepoint.com:/sites/BoardPacks"
                  className="bp-input w-full mt-1"
                />
              </label>
              <button type="submit" disabled={working} className="bp-btn bp-btn-primary">
                {working ? 'Loading…' : 'Browse'}
              </button>
            </form>

            {drives.length > 0 && !drive && (
              <div>
                <p className="text-xs uppercase tracking-wide bp-subtle font-medium mb-2">
                  Document libraries{site ? ` in ${site.name}` : ''}
                </p>
                <div className="bp-card bp-divide">
                  {drives.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => openDrive(d)}
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-[var(--bp-neutral-bg)]"
                    >
                      <Folder size={16} className="bp-subtle shrink-0" />
                      <span className="text-sm flex-1 truncate">{d.name}</span>
                      <ChevronRight size={15} className="bp-subtle" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {drive && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1 text-sm">
                  <Home size={13} className="bp-subtle" />
                  {trail.map((t, i) => (
                    <span key={t.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight size={12} className="bp-subtle" />}
                      <button
                        onClick={() => i < trail.length - 1 && openFolder(t, i - 1)}
                        className={i === trail.length - 1 ? 'font-medium' : 'bp-muted hover:underline'}
                      >
                        {t.name}
                      </button>
                    </span>
                  ))}
                </div>

                <div className="bp-card bp-divide max-h-64 overflow-y-auto">
                  {folders.length === 0 && (
                    <p className="p-3 text-sm bp-muted">No sub-folders — save here to use this folder.</p>
                  )}
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => openFolder(f, trail.length - 1)}
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-[var(--bp-neutral-bg)]"
                    >
                      <Folder size={16} className="bp-subtle shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <ChevronRight size={15} className="bp-subtle" />
                    </button>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => { setDrive(null); setFolders([]); setTrail([]) }} className="bp-btn bp-btn-secondary">
                    Back
                  </button>
                  <button onClick={saveHere} disabled={working} className="bp-btn bp-btn-primary">
                    <Check size={15} /> Use “{trail[trail.length - 1]?.name}”
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
