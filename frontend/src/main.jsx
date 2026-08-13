import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SkinProvider } from './theme/SkinProvider'
import { SessionProvider } from './lib/useSession'
import './index.css'

/**
 * Standalone entry point.
 *
 * When embedded in a host vertical, the host mounts <App /> itself and supplies
 * window.__BOARD_PORTAL__ (apiBase, userId, orgKey, skin, embedded, basename).
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SkinProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </SkinProvider>
  </React.StrictMode>
)
