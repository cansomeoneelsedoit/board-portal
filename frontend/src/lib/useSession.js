import { createContext, createElement, useContext, useEffect, useState } from 'react'
import api from './api'

/**
 * Who is signed in and what they may do.
 *
 * The host vertical authenticates and forwards the role; this app only decides
 * what to OFFER. Anything that matters is enforced server-side (and, for files,
 * by SharePoint itself) — hiding a button is presentation, not security.
 */
const SessionContext = createContext({
  role: 'MEMBER',
  capabilities: { manageMeetings: false, manageIntegration: false, writeDocuments: false },
  loading: true,
})

export function SessionProvider({ children }) {
  const [session, setSession] = useState({
    role: 'MEMBER',
    capabilities: { manageMeetings: false, manageIntegration: false, writeDocuments: false },
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    api.get('/session')
      .then(({ data }) => { if (!cancelled) setSession({ ...data, loading: false }) })
      // Fail closed: if we cannot tell, show the member view.
      .catch(() => { if (!cancelled) setSession((s) => ({ ...s, loading: false })) })
    return () => { cancelled = true }
  }, [])

  return createElement(SessionContext.Provider, { value: session }, children)
}

export const useSession = () => useContext(SessionContext)
export default useSession
