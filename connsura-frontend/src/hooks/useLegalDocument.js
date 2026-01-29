import { useEffect, useState } from 'react'
import { api } from '../services/api'

export const useLegalDocument = (type) => {
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!type) return
    let active = true
    setLoading(true)
    setError('')
    api
      .get(`/legal/${type}`)
      .then((res) => {
        if (!active) return
        setDocument(res.data?.document || null)
      })
      .catch((err) => {
        if (!active) return
        setError(err.response?.data?.error || 'Unable to load legal document')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [type])

  return { document, loading, error }
}
