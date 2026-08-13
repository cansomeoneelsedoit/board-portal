import { Outlet } from 'react-router-dom'
import { useSkin } from '../theme/SkinProvider'
import Layout from './Layout'
import LayoutMasonsView from './LayoutMasonsView'
import { isEmbedded } from '../lib/embedded'

/**
 * Picks the shell for the active skin.
 *
 * `Layout` is the original Board Portal design, kept intact as the revert
 * target. `LayoutMasonsView` matches the host product.
 *
 * Embedded (inside Mason-View's chrome) there is no shell at all — the host's
 * sidebar is the navigation and its menu items deep-link to our routes, so
 * rendering our own sidebar would nest one product inside another.
 */
export default function AppLayout() {
  const { skin } = useSkin()

  if (isEmbedded()) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bp-bg)' }}>
        <div className="mx-auto max-w-screen-2xl p-2">
          <Outlet />
        </div>
      </main>
    )
  }

  return skin === 'classic' ? <Layout /> : <LayoutMasonsView />
}
