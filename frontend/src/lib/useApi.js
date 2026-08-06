import { useCallback, useEffect, useState } from 'react'
import api from './api'

/**
 * Fetch a path from the API with loading/error state and a refetch handle.
 * `path` may be null to skip the request (e.g. waiting on a route param).
 */
export function useApi(path, { initial = null } = {}) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!path) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(path)
      setData(res.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refetch: load }
}

export default useApi
