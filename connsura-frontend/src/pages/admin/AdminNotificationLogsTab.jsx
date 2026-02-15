import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

const EVENT_TYPE_OPTIONS = [
  'LOGIN_ALERT',
  'PASSWORD_CHANGED',
  'EMAIL_CHANGED',
  'EMAIL_VERIFICATION',
  'NAME_CHANGE_VERIFICATION',
  'PASSWORD_CHANGE_VERIFICATION',
  'EMAIL_VERIFIED',
  'LEGAL_POLICY_UPDATE',
  'PROFILE_SHARED',
  'ACCESS_REVOKED',
  'PROFILE_UPDATED_BY_RECIPIENT',
  'PROFILE_UPDATED',
  'FEATURE_UPDATE',
  'MARKETING',
  'ACCOUNT_DELETED',
  'ACCOUNT_DEACTIVATED',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_DISABLED',
  'LOGOUT_OTHER_DEVICES',
  'IN_APP_NOTICE',
]

const CHANNEL_OPTIONS = ['all', 'EMAIL', 'IN_APP']
const STATUS_OPTIONS = ['all', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED']
const REQUIRED_OPTIONS = ['all', 'true', 'false']

const toIso = (value) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

const toLocal = (value) => {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

const buildParams = (filters, cursor) => {
  const params = {
    limit: 50,
    sort: filters.sort,
  }
  if (cursor) params.cursor = cursor
  if (filters.q) params.q = filters.q.trim()
  if (filters.channel !== 'all') params.channel = filters.channel
  if (filters.status !== 'all') params.status = filters.status
  if (filters.required !== 'all') params.required = filters.required
  if (filters.eventType) params.event_type = filters.eventType.trim()
  if (filters.userId) params.user_id = filters.userId.trim()
  if (filters.recipientEmail) params.recipient_email = filters.recipientEmail.trim()
  if (filters.dateFrom) params.date_from = toIso(filters.dateFrom)
  if (filters.dateTo) params.date_to = toIso(filters.dateTo)
  return params
}

const copyText = async (value, label) => {
  if (!value) return
  try {
    await navigator.clipboard.writeText(String(value))
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

export default function AdminNotificationLogsTab({ onSessionExpired }) {
  const [filters, setFilters] = useState({
    q: '',
    channel: 'all',
    eventType: '',
    status: 'all',
    required: 'all',
    userId: '',
    recipientEmail: '',
    dateFrom: '',
    dateTo: '',
    sort: 'desc',
  })
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [cursorStack, setCursorStack] = useState([])
  const [currentCursor, setCurrentCursor] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [metadataExpanded, setMetadataExpanded] = useState(false)
  const [preferenceExpanded, setPreferenceExpanded] = useState(false)

  const validateDates = () => {
    const startIso = filters.dateFrom ? toIso(filters.dateFrom) : ''
    const endIso = filters.dateTo ? toIso(filters.dateTo) : ''
    if (filters.dateFrom && !startIso) {
      toast.error('Start date is invalid.')
      return false
    }
    if (filters.dateTo && !endIso) {
      toast.error('End date is invalid.')
      return false
    }
    if (startIso && endIso && new Date(endIso) < new Date(startIso)) {
      toast.error('End date must be after the start date.')
      return false
    }
    return true
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

  const loadLogs = async ({ cursor = null, reset = false } = {}) => {
    if (!validateDates()) return
    setLoading(true)
    if (reset) {
      setCursorStack([])
      setCurrentCursor(cursor)
    }
    try {
      const params = buildParams(filters, cursor)
      const res = await adminApi.get('/admin/notification-logs', { params })
      setLogs(res.data?.logs || [])
      setNextCursor(res.data?.nextCursor || null)
      setCurrentCursor(cursor)
    } catch (err) {
      if (handleSessionError(err, 'Failed to load notification logs')) return
      setLogs([])
      setNextCursor(null)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await adminApi.get(`/admin/notification-logs/${id}`)
      setSelectedLog(res.data?.log || null)
      setMetadataExpanded(false)
      setPreferenceExpanded(false)
    } catch (err) {
      handleSessionError(err, 'Failed to load notification log')
    } finally {
      setDetailLoading(false)
    }
  }

  const exportCsv = async () => {
    if (!validateDates()) return
    try {
      const params = buildParams(filters, null)
      const res = await adminApi.get('/admin/notification-logs/export', {
        params,
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'notification-logs.csv')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      handleSessionError(err, 'Failed to export notification logs')
    }
  }

  useEffect(() => {
    loadLogs({ cursor: null, reset: true })
  }, [])

  const goNext = () => {
    if (!nextCursor || loading) return
    setCursorStack((prev) => [...prev, currentCursor])
    loadLogs({ cursor: nextCursor, reset: false })
  }

  const goPrev = () => {
    if (!cursorStack.length || loading) return
    const prevStack = [...cursorStack]
    const prevCursor = prevStack.pop() ?? null
    setCursorStack(prevStack)
    loadLogs({ cursor: prevCursor, reset: false })
  }

  const metadataText = useMemo(() => {
    if (!selectedLog?.metadata) return ''
    return JSON.stringify(selectedLog.metadata, null, 2)
  }, [selectedLog])

  const preferenceText = useMemo(() => {
    if (!selectedLog?.preferenceSnapshot) return ''
    return JSON.stringify(selectedLog.preferenceSnapshot, null, 2)
  }, [selectedLog])

  const renderJsonBlock = (text, expanded, onToggle) => {
    if (!text) return null
    const preview = text.length > 600 ? `${text.slice(0, 600)}...` : text
    return (
      <div className="space-y-2">
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
          {expanded ? text : preview}
        </pre>
        {text.length > 600 && (
          <button type="button" className="pill-btn-ghost px-3 py-1 text-xs" onClick={onToggle}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          Search
          <input
            type="text"
            className="mt-1 w-64 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Subject, email, message ID"
          />
        </label>
        <label className="block text-sm">
          Channel
          <select
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.channel}
            onChange={(event) => setFilters((prev) => ({ ...prev, channel: event.target.value }))}
          >
            {CHANNEL_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Event type
          <input
            list="notification-event-types"
            className="mt-1 w-56 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.eventType}
            onChange={(event) => setFilters((prev) => ({ ...prev, eventType: event.target.value }))}
            placeholder="PROFILE_SHARED"
          />
        </label>
        <datalist id="notification-event-types">
          {EVENT_TYPE_OPTIONS.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <label className="block text-sm">
          Status
          <select
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Required
          <select
            className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.required}
            onChange={(event) => setFilters((prev) => ({ ...prev, required: event.target.value }))}
          >
            {REQUIRED_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          User ID
          <input
            type="text"
            className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.userId}
            onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))}
            placeholder="123"
          />
        </label>
        <label className="block text-sm">
          Recipient email
          <input
            type="text"
            className="mt-1 w-56 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.recipientEmail}
            onChange={(event) => setFilters((prev) => ({ ...prev, recipientEmail: event.target.value }))}
            placeholder="user@email.com"
          />
        </label>
        <label className="block text-sm">
          Start
          <input
            type="datetime-local"
            className="mt-1 w-56 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </label>
        <label className="block text-sm">
          End
          <input
            type="datetime-local"
            className="mt-1 w-56 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Sort
          <select
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2"
            value={filters.sort}
            onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}
          >
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </select>
        </label>
        <button
          type="button"
          className="pill-btn-primary px-5"
          onClick={() => loadLogs({ cursor: null, reset: true })}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
        <button
          type="button"
          className="pill-btn-ghost px-5"
          onClick={() => loadLogs({ cursor: currentCursor, reset: false })}
          disabled={loading}
        >
          Refresh
        </button>
        <button type="button" className="pill-btn-ghost px-5" onClick={exportCsv} disabled={loading}>
          Export CSV
        </button>
      </div>

      {loading && <div className="text-sm text-slate-500">Loading notification logs...</div>}
      {!loading && !logs.length && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No logs found.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="py-2 pr-3">Date/Time</th>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Event</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Required</th>
              <th className="py-2 pr-3">Recipient</th>
              <th className="py-2 pr-3">User</th>
              <th className="py-2 pr-3">Subject</th>
              <th className="py-2 pr-3">Provider Msg ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  setSelectedLog(log)
                  loadDetail(log.id)
                }}
              >
                <td className="py-2 pr-3">{toLocal(log.createdAt)}</td>
                <td className="py-2 pr-3">{log.channel}</td>
                <td className="py-2 pr-3">{log.eventType}</td>
                <td className="py-2 pr-3">{log.status}</td>
                <td className="py-2 pr-3">{log.required ? 'Yes' : 'No'}</td>
                <td className="py-2 pr-3">{log.recipientEmail || '--'}</td>
                <td className="py-2 pr-3">{log.userId ? `#${log.userId}` : '--'}</td>
                <td className="py-2 pr-3">{log.subject || '--'}</td>
                <td className="py-2 pr-3">{log.providerMessageId || '--'}</td>
              </tr>
            ))}
            {!logs.length && !loading && (
              <tr>
                <td className="py-3 text-slate-500" colSpan={9}>
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>{logs.length ? `Showing ${logs.length} logs` : 'No results'}</div>
        <div className="flex gap-2">
          <button type="button" className="pill-btn-ghost px-3 py-1" onClick={goPrev} disabled={loading || !cursorStack.length}>
            Previous
          </button>
          <button type="button" className="pill-btn-ghost px-3 py-1" onClick={goNext} disabled={loading || !nextCursor}>
            Next
          </button>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notification log</div>
                <h3 className="text-xl font-semibold text-slate-900">{selectedLog.eventType}</h3>
                <div className="text-xs text-slate-500">{toLocal(selectedLog.createdAt)}</div>
              </div>
              <button
                type="button"
                className="pill-btn-ghost px-3 py-1"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>

            {detailLoading && <div className="mt-4 text-sm text-slate-500">Loading log details...</div>}
            {!detailLoading && (
              <div className="mt-4 space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-slate-400">Log ID</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-700">{selectedLog.id}</span>
                      <button
                        type="button"
                        className="pill-btn-ghost px-2 py-1 text-xs"
                        onClick={() => copyText(selectedLog.id, 'Log ID')}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Status</div>
                    <div className="text-slate-700">{selectedLog.status}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Channel</div>
                    <div className="text-slate-700">{selectedLog.channel}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Severity</div>
                    <div className="text-slate-700">{selectedLog.severity}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Required</div>
                    <div className="text-slate-700">{selectedLog.required ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">User</div>
                    <div className="text-slate-700">{selectedLog.userId ? `#${selectedLog.userId}` : '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Recipient</div>
                    <div className="text-slate-700">{selectedLog.recipientEmail || '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Provider</div>
                    <div className="text-slate-700">{selectedLog.provider || '--'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Provider Message ID</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-700">{selectedLog.providerMessageId || '--'}</span>
                      {selectedLog.providerMessageId && (
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs"
                          onClick={() => copyText(selectedLog.providerMessageId, 'Provider message ID')}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Correlation ID</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-700">{selectedLog.correlationId || '--'}</span>
                      {selectedLog.correlationId && (
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs"
                          onClick={() => copyText(selectedLog.correlationId, 'Correlation ID')}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Actor</div>
                    <div className="text-slate-700">
                      {selectedLog.actorType}
                      {selectedLog.actorUserId ? ` #${selectedLog.actorUserId}` : ''}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400">Subject</div>
                  <div className="text-slate-700">{selectedLog.subject || '--'}</div>
                </div>

                {selectedLog.failureReason && (
                  <div>
                    <div className="text-xs uppercase text-slate-400">Failure reason</div>
                    <div className="text-rose-600">{selectedLog.failureReason}</div>
                  </div>
                )}

                {selectedLog.preferenceSnapshot && (
                  <div>
                    <div className="text-xs uppercase text-slate-400">Preference snapshot</div>
                    {renderJsonBlock(preferenceText, preferenceExpanded, () => setPreferenceExpanded((prev) => !prev))}
                  </div>
                )}

                {selectedLog.metadata && (
                  <div>
                    <div className="text-xs uppercase text-slate-400">Metadata</div>
                    {renderJsonBlock(metadataText, metadataExpanded, () => setMetadataExpanded((prev) => !prev))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
