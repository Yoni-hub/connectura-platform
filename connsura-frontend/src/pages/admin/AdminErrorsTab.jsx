import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

export default function AdminErrorsTab({ onSessionExpired }) {
  const [errorEvents, setErrorEvents] = useState([])
  const [errorLoading, setErrorLoading] = useState(false)
  const [errorQuery, setErrorQuery] = useState('')
  const [errorLevel, setErrorLevel] = useState('all')
  const [errorSource, setErrorSource] = useState('all')
  const [errorStart, setErrorStart] = useState('')
  const [errorEnd, setErrorEnd] = useState('')
  const [errorPage, setErrorPage] = useState(1)
  const [errorHasMore, setErrorHasMore] = useState(false)
  const [errorTotalPages, setErrorTotalPages] = useState(1)
  const [errorExpandedId, setErrorExpandedId] = useState(null)

  const levels = ['all', 'error', 'warning', 'info']
  const sources = ['all', 'frontend', 'react', 'window', 'unhandledrejection']

  const toIsoDate = (value) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toISOString()
  }

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      if (typeof onSessionExpired === 'function') onSessionExpired()
      toast.error('Session expired')
      return true
    }
    toast.error(err?.response?.data?.error || fallbackMessage)
    return false
  }

  const loadErrorEvents = async ({ page = 1 } = {}) => {
    const trimmedQuery = errorQuery.trim()
    const startIso = errorStart ? toIsoDate(errorStart) : ''
    const endIso = errorEnd ? toIsoDate(errorEnd) : ''

    if (errorStart && !startIso) {
      toast.error('Start date is invalid.')
      return
    }
    if (errorEnd && !endIso) {
      toast.error('End date is invalid.')
      return
    }
    if (startIso && endIso && new Date(endIso) < new Date(startIso)) {
      toast.error('End date must be after the start date.')
      return
    }

    setErrorLoading(true)
    setErrorExpandedId(null)
    try {
      const params = {
        limit: 25,
        page,
      }
      if (trimmedQuery) params.query = trimmedQuery
      if (errorLevel !== 'all') params.level = errorLevel
      if (errorSource !== 'all') params.source = errorSource
      if (startIso) params.start = startIso
      if (endIso) params.end = endIso
      const res = await adminApi.get('/admin/errors', { params })
      setErrorEvents(res.data.errors || [])
      setErrorPage(res.data.page || page)
      setErrorHasMore(Boolean(res.data.hasMore))
      setErrorTotalPages(res.data.totalPages || 1)
    } catch (err) {
      if (handleSessionError(err, 'Failed to load error events')) return
      setErrorEvents([])
      setErrorHasMore(false)
      setErrorTotalPages(1)
    } finally {
      setErrorLoading(false)
    }
  }

  useEffect(() => {
    loadErrorEvents({ page: 1 })
  }, [])

  const toLocal = (value) => {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          Search
          <input
            type="text"
            className="mt-1 w-64 rounded-lg border border-slate-200 px-3 py-2"
            value={errorQuery}
            onChange={(event) => setErrorQuery(event.target.value)}
            placeholder="Message, URL, stack..."
          />
        </label>
        <label className="block text-sm">
          Level
          <select
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2"
            value={errorLevel}
            onChange={(event) => setErrorLevel(event.target.value)}
          >
            {levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Source
          <select
            className="mt-1 w-48 rounded-lg border border-slate-200 px-3 py-2"
            value={errorSource}
            onChange={(event) => setErrorSource(event.target.value)}
          >
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Start
          <input
            type="datetime-local"
            className="mt-1 w-56 rounded-lg border border-slate-200 px-3 py-2"
            value={errorStart}
            onChange={(event) => setErrorStart(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          End
          <input
            type="datetime-local"
            className="mt-1 w-56 rounded-lg border border-slate-200 px-3 py-2"
            value={errorEnd}
            onChange={(event) => setErrorEnd(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="pill-btn-primary px-5"
          onClick={() => loadErrorEvents({ page: 1 })}
          disabled={errorLoading}
        >
          {errorLoading ? 'Loading...' : 'Search'}
        </button>
        <button
          type="button"
          className="pill-btn-ghost px-5"
          onClick={() => loadErrorEvents({ page: errorPage })}
          disabled={errorLoading}
        >
          Refresh
        </button>
      </div>

      {errorLoading && <div className="text-sm text-slate-500">Loading error events...</div>}
      {!errorLoading && !errorEvents.length && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No error events found for this filter.
        </div>
      )}

      <div className="space-y-3">
        {errorEvents.map((event) => {
          const isOpen = errorExpandedId === event.id
          return (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {event.level} · {event.source}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{event.message}</div>
                  <div className="text-xs text-slate-500">
                    {toLocal(event.createdAt)} {event.url ? `· ${event.url}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="pill-btn-ghost px-3 py-1 text-xs"
                  onClick={() => setErrorExpandedId(isOpen ? null : event.id)}
                >
                  {isOpen ? 'Hide details' : 'View details'}
                </button>
              </div>
              {isOpen && (
                <div className="mt-3 space-y-2 text-xs text-slate-700">
                  <div className="flex flex-wrap gap-3 text-slate-600">
                    <span>Event #{event.id}</span>
                    {event.userEmail && <span>User: {event.userEmail}</span>}
                    {event.release && <span>Release: {event.release}</span>}
                    {event.sessionId && <span>Session: {event.sessionId}</span>}
                  </div>
                  {event.stack && (
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
                      {event.stack}
                    </pre>
                  )}
                  {event.componentStack && (
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
                      {event.componentStack}
                    </pre>
                  )}
                  {event.metadata && (
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Page {errorPage} of {errorTotalPages}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="pill-btn-ghost px-3 py-1"
            onClick={() => loadErrorEvents({ page: Math.max(1, errorPage - 1) })}
            disabled={errorLoading || errorPage <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="pill-btn-ghost px-3 py-1"
            onClick={() => loadErrorEvents({ page: errorPage + 1 })}
            disabled={errorLoading || !errorHasMore}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
