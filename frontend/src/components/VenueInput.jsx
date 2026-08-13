import { useEffect, useState } from 'react'
import api from '../lib/api'

/**
 * Location field with the venue list behind it.
 *
 * Suggestions come from two places, merged: venues passed in by the host
 * platform (Mason-View appends ?venues=… to the embed URL — its Venue module's
 * rooms), and every place a meeting has been held before. Free text still
 * types straight in, so an unlisted venue is never a problem.
 */

function hostVenues() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('venues')
    if (fromUrl) {
      window.sessionStorage.setItem('board-portal.venues', fromUrl)
      return fromUrl.split('|').map((v) => v.trim()).filter(Boolean)
    }
    const stored = window.sessionStorage.getItem('board-portal.venues')
    return stored ? stored.split('|').map((v) => v.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export default function VenueInput({ value, onChange, className = 'bp-input w-full mt-1', placeholder = '' }) {
  const [venues, setVenues] = useState(hostVenues)

  useEffect(() => {
    let alive = true
    api.get('/meetings/venues')
      .then(({ data }) => {
        if (!alive || !Array.isArray(data)) return
        setVenues((prev) => {
          const seen = new Set(prev.map((v) => v.toLowerCase()))
          return [...prev, ...data.filter((v) => !seen.has(v.toLowerCase()))]
        })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <>
      <input
        value={value}
        onChange={onChange}
        className={className}
        placeholder={placeholder}
        list="bp-venue-options"
      />
      <datalist id="bp-venue-options">
        {venues.map((v) => <option key={v} value={v} />)}
      </datalist>
    </>
  )
}
