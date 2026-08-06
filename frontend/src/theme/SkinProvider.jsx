import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export const SKINS = {
  masonsview: { id: 'masonsview', label: 'Mason-View', hint: 'Matches the host product' },
  classic:    { id: 'classic',    label: 'Classic',    hint: 'Original Board Portal design' },
}

const STORAGE_KEY = 'board-portal.skin'

const hostConfig = (typeof window !== 'undefined' && window.__BOARD_PORTAL__) || {}

/**
 * Resolution order, highest priority first:
 *   1. ?skin=classic in the URL  (also persisted, so it survives navigation)
 *   2. the host application's declared skin (when embedded as a module)
 *   3. whatever the user last chose, from localStorage
 *   4. VITE_DEFAULT_SKIN, else masonsview
 */
function resolveInitialSkin() {
  if (typeof window === 'undefined') return 'masonsview'

  const fromQuery = new URLSearchParams(window.location.search).get('skin')
  if (fromQuery && SKINS[fromQuery]) {
    try { window.localStorage.setItem(STORAGE_KEY, fromQuery) } catch { /* private mode */ }
    return fromQuery
  }

  // When embedded, the host decides and the user toggle is hidden.
  if (hostConfig.skin && SKINS[hostConfig.skin]) return hostConfig.skin

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && SKINS[stored]) return stored
  } catch { /* private mode */ }

  const fallback = import.meta.env.VITE_DEFAULT_SKIN
  return SKINS[fallback] ? fallback : 'masonsview'
}

const SkinContext = createContext({ skin: 'masonsview', setSkin: () => {}, embedded: false })

export function SkinProvider({ children }) {
  const [skin, setSkinState] = useState(resolveInitialSkin)

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin)
  }, [skin])

  const setSkin = useCallback((next) => {
    if (!SKINS[next]) return
    setSkinState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
  }, [])

  const value = useMemo(
    () => ({ skin, setSkin, embedded: Boolean(hostConfig.embedded) }),
    [skin, setSkin]
  )

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export const useSkin = () => useContext(SkinContext)
