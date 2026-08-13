import { useState } from 'react'
import { Folder, ChevronRight, Home, Loader2, Check } from 'lucide-react'
import api from '../lib/api'

/**
 * The meeting's SharePoint pack folder: paste the URL straight from the
 * browser's address bar, or navigate the linked library to find it. Either way
 * the value is a folder URL stored against the meeting, so the meeting carries
 * a direct link to its own pack.
 */
export default function PackFolderField({ value, onChange }) {
  const [browsing, setBrowsing] = useState(false)
  const [trail, setTrail] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (folderId) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(
        `/sharepoint/browse${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''}`
      )
      setItems((data.items || []).filter((i) => i.isFolder))
      if (!folderId) setTrail(data.folder ? [{ id: data.folder.id, name: data.folder.name, webUrl: data.folder.webUrl }] : [])
      return data
    } catch (e) {
      setError(
        e.status === 400
          ? 'Browsing needs the board linked to a library first (Integrations) — or just paste the folder URL above.'
          : e.message
      )
      return null
    } finally {
      setLoading(false)
    }
  }

  const openBrowse = async () => {
    setBrowsing(true)
    await load(null)
  }

  const drill = async (item) => {
    const data = await load(item.id)
    if (data) setTrail((t) => [...t, { id: item.id, name: item.name, webUrl: item.webUrl }])
  }

  const jump = async (index) => {
    const target = trail[index]
    const data = await load(index === 0 ? null : target.id)
    if (data) setTrail((t) => t.slice(0, index + 1))
  }

  const current = trail[trail.length - 1]

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium">Board pack folder (SharePoint URL)</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bp-input w-full mt-1"
          placeholder="https://…sharepoint.com/…/Filing Cabinet/BOM INC Board/2026/08 - 5 August 2026"
        />
        <span className="block text-xs bp-muted mt-1">
          This meeting links directly to that folder. Leave blank to match by meeting date instead.
        </span>
      </label>

      {!browsing ? (
        <button type="button" onClick={openBrowse} className="bp-btn bp-btn-secondary">
          <Folder size={14} /> Browse the library
        </button>
      ) : (
        <div className="bp-card">
          <div className="px-3 py-2 flex flex-wrap items-center gap-1 text-xs"
            style={{ borderBottom: '1px solid var(--bp-card-border)' }}>
            <Home size={12} className="bp-subtle" />
            {trail.map((t, i) => (
              <span key={`${t.id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={11} className="bp-subtle" />}
                <button type="button" onClick={() => jump(i)}
                  className={i === trail.length - 1 ? 'font-medium' : 'bp-muted hover:underline'}>
                  {t.name}
                </button>
              </span>
            ))}
            <span className="flex-1" />
            {loading && <Loader2 size={12} className="animate-spin bp-subtle" />}
          </div>

          {error && <p className="p-3 text-xs" style={{ color: 'var(--bp-danger-fg)' }}>{error}</p>}

          {!error && (
            <div className="max-h-48 overflow-y-auto bp-divide">
              {items.length === 0 && !loading && (
                <p className="p-3 text-xs bp-muted">No sub-folders here.</p>
              )}
              {items.map((f) => (
                <div key={f.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                  <Folder size={14} className="bp-subtle shrink-0" />
                  <button type="button" onClick={() => drill(f)} className="flex-1 text-left truncate hover:underline">
                    {f.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => { onChange(f.webUrl); setBrowsing(false) }}
                    className="bp-btn bp-btn-secondary"
                  >
                    <Check size={12} /> Use
                  </button>
                </div>
              ))}
            </div>
          )}

          {current && !error && (
            <div className="p-2 flex justify-end gap-2" style={{ borderTop: '1px solid var(--bp-card-border)' }}>
              <button type="button" onClick={() => setBrowsing(false)} className="bp-btn bp-btn-secondary">
                Close
              </button>
              <button
                type="button"
                onClick={() => { onChange(current.webUrl); setBrowsing(false) }}
                className="bp-btn bp-btn-primary"
              >
                <Check size={13} /> Use “{current.name}”
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
