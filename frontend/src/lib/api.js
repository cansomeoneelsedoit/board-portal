import axios from 'axios'

/**
 * Single point of contact with the Board Portal API.
 *
 * This is the seam for embedding. Standalone, requests go to `/api` (proxied by
 * vite in dev, by VITE_API_URL in production). Inside a MasonsView/HotelView
 * vertical, the host sets `window.__BOARD_PORTAL__ = { apiBase, userId, orgKey }`
 * before mount and nothing else in the app needs to change.
 */
const host = (typeof window !== 'undefined' && window.__BOARD_PORTAL__) || {}

export const apiBase = host.apiBase || import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
})

// Identity is supplied by the host application; standalone runs unauthenticated.
api.interceptors.request.use((config) => {
  if (host.userId) config.headers['x-user-id'] = host.userId
  if (host.orgKey) config.headers['x-org-key'] = host.orgKey
  return config
})

// Normalise errors so pages can render one consistent message.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.statusText ||
      error.message ||
      'Request failed'
    return Promise.reject(Object.assign(new Error(message), { status: error.response?.status }))
  }
)

export const endpoints = {
  dashboard:    () => '/dashboard',
  users:        () => '/users',
  boards:       () => '/boards',
  meetings:     () => '/meetings',
  meeting:      (id) => `/meetings/${id}`,
  agenda:       () => '/agenda',
  documents:    () => '/documents',
  motions:      () => '/motions',
  votes:        () => '/votes',
  attendance:   () => '/attendance',
  minutes:      () => '/minutes',
  coi:          () => '/coi',
  proxies:      () => '/proxies',
  integrations: () => '/integrations',
  audit:        () => '/audit',
}

export default api
