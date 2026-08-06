import { useSkin } from '../theme/SkinProvider'
import Layout from './Layout'
import LayoutMasonsView from './LayoutMasonsView'

/**
 * Picks the shell for the active skin.
 *
 * `Layout` is the original Board Portal design, kept intact as the revert
 * target. `LayoutMasonsView` matches the host product.
 */
export default function AppLayout() {
  const { skin } = useSkin()
  return skin === 'classic' ? <Layout /> : <LayoutMasonsView />
}
