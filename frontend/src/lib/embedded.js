/**
 * Whether this app is running inside a host product's chrome.
 *
 * Embedded means: render NO sidebar and NO header — the host's navigation is
 * the navigation, and each host menu item deep-links straight to one of our
 * routes. Detection, in order:
 *
 *   1. window.__BOARD_PORTAL__.embedded  — host-injected config (same origin)
 *   2. ?embedded=1                       — cross-origin iframes, e.g. Mason-View
 *
 * The query param is remembered in sessionStorage so client-side navigation
 * inside the iframe stays chromeless after the param drops off the URL.
 */
export function isEmbedded() {
  if (typeof window === 'undefined') return false

  if (window.__BOARD_PORTAL__?.embedded) return true

  try {
    if (new URLSearchParams(window.location.search).get('embedded') === '1') {
      window.sessionStorage.setItem('board-portal.embedded', '1')
      return true
    }
    return window.sessionStorage.getItem('board-portal.embedded') === '1'
  } catch {
    return false
  }
}
