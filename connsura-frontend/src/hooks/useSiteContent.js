import { useEffect, useState } from 'react'
import { api } from '../services/api'

export const useSiteContent = (slug, fallback = null) => {
  const [content, setContent] = useState(fallback)
  const [loading, setLoading] = useState(Boolean(slug))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get(`/site-content/${slug}`)
        if (!active) return
        setContent(res.data?.content || fallback)
      } catch (err) {
        if (!active) return
        setContent(fallback)
        setError(err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [slug, fallback])

  return { content, loading, error }
}
