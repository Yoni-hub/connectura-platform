import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

const AUDIT_PAGE_SIZE = 10

export default function AdminAuditTab({ onSessionExpired }) {
  const [logs, setLogs] = useState([])
  const [auditMode, setAuditMode] = useState('client')
  const [auditQuery, setAuditQuery] = useState('')
  const [auditStart, setAuditStart] = useState('')
  const [auditEnd, setAuditEnd] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [auditSearched, setAuditSearched] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditHasMore, setAuditHasMore] = useState(false)
  const [auditViewAll, setAuditViewAll] = useState(false)
  const [auditLastFilters, setAuditLastFilters] = useState(null)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const auditSearchTimerRef = useRef(null)
  const auditRequestIdRef = useRef(0)

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
    if (fallbackMessage) {
      setAuditError(err?.response?.data?.error || fallbackMessage)
    }
    return false
  }

  const handleAuditSearch = async (options = {}) => {
    const {
      page = 1,
      mode = auditMode,
      viewAll = auditViewAll,
      useLastFilters = false,
    } = options
    const lastFilters = auditLastFilters
    const filters = useLastFilters && lastFilters ? lastFilters : { mode, query: auditQuery, start: auditStart, end: auditEnd, viewAll }
    const trimmedQuery = String(filters.query || '').trim()
    const hasRawCriteria = Boolean(trimmedQuery || filters.start || filters.end)
    const useViewAll = Boolean(filters.viewAll || !hasRawCriteria)
    const startIso = useViewAll ? '' : toIsoDate(filters.start)
    const endIso = useViewAll ? '' : toIsoDate(filters.end)

    setAuditError('')
    if (!useViewAll) {
      if (filters.start && !startIso) {
        setAuditError('Start date is invalid.')
        setLogs([])
        setAuditSearched(false)
        setAuditHasMore(false)
        setAuditPage(1)
        return
      }
      if (filters.end && !endIso) {
        setAuditError('End date is invalid.')
        setLogs([])
        setAuditSearched(false)
        setAuditHasMore(false)
        setAuditPage(1)
        return
      }
      if (startIso && endIso && new Date(endIso) < new Date(startIso)) {
        setAuditError('End date must be after the start date.')
        setLogs([])
        setAuditSearched(false)
        setAuditHasMore(false)
        setAuditPage(1)
        return
      }
    }

    const requestId = auditRequestIdRef.current + 1
    auditRequestIdRef.current = requestId
    setAuditLoading(true)
    try {
      const params = {
        type: filters.mode,
        limit: AUDIT_PAGE_SIZE,
        page,
      }
      if (!useViewAll) {
        if (trimmedQuery) params.query = trimmedQuery
        if (startIso) params.start = startIso
        if (endIso) params.end = endIso
      }
      setAuditLastFilters({
        mode: filters.mode,
        query: useViewAll ? '' : trimmedQuery,
        start: useViewAll ? '' : filters.start,
        end: useViewAll ? '' : filters.end,
        viewAll: useViewAll,
      })
      const res = await adminApi.get('/admin/audit', { params })
      if (auditRequestIdRef.current === requestId) {
        setLogs(res.data.logs || [])
        setAuditSearched(true)
        setAuditHasMore(Boolean(res.data.hasMore))
        setAuditPage(res.data.page || page)
        setAuditTotalPages(res.data.totalPages || 1)
        setAuditViewAll(useViewAll)
      }
    } catch (err) {
      if (handleSessionError(err, 'Failed to load audit logs.')) return
      if (auditRequestIdRef.current === requestId) {
        setLogs([])
        setAuditHasMore(false)
        setAuditTotalPages(1)
        setAuditSearched(true)
      }
    } finally {
      if (auditRequestIdRef.current === requestId) {
        setAuditLoading(false)
      }
    }
  }

  const handleAuditViewAll = (mode) => {
    if (auditSearchTimerRef.current) {
      clearTimeout(auditSearchTimerRef.current)
    }
    setAuditMode(mode)
    setAuditQuery('')
    setAuditStart('')
    setAuditEnd('')
    setAuditError('')
    setAuditSearched(false)
    setAuditHasMore(false)
    setAuditPage(1)
    setAuditViewAll(true)
    setLogs([])
    handleAuditSearch({ page: 1, mode, viewAll: true })
  }

  useEffect(() => {
    if (auditMode === 'admin') return
    if (auditViewAll) return
    const trimmed = auditQuery.trim()
    const hasStart = Boolean(auditStart)
    const hasEnd = Boolean(auditEnd)
    if (!trimmed && !hasStart && !hasEnd) {
      if (auditSearchTimerRef.current) {
        clearTimeout(auditSearchTimerRef.current)
      }
      setAuditSearched(false)
      setAuditError('')
      setAuditHasMore(false)
      setAuditPage(1)
      setAuditTotalPages(1)
      setLogs([])
      return
    }
    if (auditSearchTimerRef.current) {
      clearTimeout(auditSearchTimerRef.current)
    }
    auditSearchTimerRef.current = setTimeout(() => {
      handleAuditSearch({ page: 1 })
    }, 400)
    return () => {
      if (auditSearchTimerRef.current) {
        clearTimeout(auditSearchTimerRef.current)
      }
    }
  }, [auditQuery, auditStart, auditEnd, auditMode, auditViewAll])

  const modes = [
    { key: 'client', label: 'Client logs', viewAllLabel: 'View all clients' },
    { key: 'agent', label: 'Agent logs', viewAllLabel: 'View all agents' },
    { key: 'admin', label: 'Admin logs', viewAllLabel: 'View all admin logs' },
  ]
  const modeLabel = auditMode === 'agent' ? 'agent' : 'client'
  const searchLabel = `Search ${modeLabel} logs`
  const searchPlaceholder = 'Name, email, or ID'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              auditMode === mode.key
                ? 'border-[#0b3b8c] bg-[#e8f0ff] text-[#0b3b8c]'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => {
              setAuditMode(mode.key)
              setAuditQuery('')
              setAuditError('')
              setAuditSearched(false)
              setAuditHasMore(false)
              setAuditPage(1)
              setAuditViewAll(false)
              setAuditLastFilters(null)
              setLogs([])
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {modes.map((mode) => (
          <button
            key={`${mode.key}-view-all`}
            type="button"
            className="pill-btn-ghost px-3 py-1 text-xs font-semibold"
            onClick={() => handleAuditViewAll(mode.key)}
            disabled={auditLoading && auditMode === mode.key}
          >
            {mode.viewAllLabel}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        {auditMode !== 'admin' && (
          <label className="block text-sm">
            {searchLabel}
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={auditQuery}
              onChange={(event) => {
                setAuditQuery(event.target.value)
                setAuditViewAll(false)
                setAuditHasMore(false)
                setAuditPage(1)
                setAuditLastFilters(null)
              }}
              placeholder={searchPlaceholder}
            />
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Start date/time
            <span className="ml-2 text-xs text-slate-400">Optional</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={auditStart}
              onChange={(event) => {
                setAuditStart(event.target.value)
                setAuditViewAll(false)
                setAuditHasMore(false)
                setAuditPage(1)
                setAuditLastFilters(null)
              }}
            />
          </label>
          <label className="block text-sm">
            End date/time
            <span className="ml-2 text-xs text-slate-400">Optional</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={auditEnd}
              onChange={(event) => {
                setAuditEnd(event.target.value)
                setAuditViewAll(false)
                setAuditHasMore(false)
                setAuditPage(1)
                setAuditLastFilters(null)
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="pill-btn-primary px-4"
            onClick={() => handleAuditSearch({ page: 1 })}
            disabled={auditLoading}
          >
            {auditLoading ? 'Searching...' : auditMode === 'admin' ? 'Load logs' : 'Search logs'}
          </button>
          {auditError && <div className="text-sm text-rose-600">{auditError}</div>}
        </div>
      </div>

      {auditSearched && !auditLoading && logs.length === 0 && (
        <div className="text-sm text-slate-500">No logs found.</div>
      )}

      {auditSearched && logs.length > 0 && (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{log.actorName || log.actorEmail || `#${log.actorId || 'unknown'}`}</td>
                    <td className="px-3 py-2">{log.targetLabel || log.targetId || '--'}</td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2">
                      {log.diff ? (
                        <pre className="whitespace-pre-wrap text-xs text-slate-600">{log.diff}</pre>
                      ) : (
                        '--'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <div>
              Page {auditPage} of {auditTotalPages}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="pill-btn-ghost px-3 py-1"
                onClick={() => handleAuditSearch({ page: Math.max(1, auditPage - 1), useLastFilters: true })}
                disabled={auditPage <= 1 || auditLoading}
              >
                Previous
              </button>
              <button
                type="button"
                className="pill-btn-ghost px-3 py-1"
                onClick={() => handleAuditSearch({ page: auditPage + 1, useLastFilters: true })}
                disabled={!auditHasMore || auditLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
