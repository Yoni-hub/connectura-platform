import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

const PAGE_SIZES = [25, 50, 100, 200]
const ROW_HEIGHT = 64
const MIN_HEIGHT = 220
const MAX_HEIGHT = 520
const OVERSCAN = 6

export default function AdminAgentsTab({ onOpenAgent, onSessionExpired, refreshKey = 0 }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(PAGE_SIZES[0])
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const scrollRef = useRef(null)

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      if (typeof onSessionExpired === 'function') onSessionExpired()
      toast.error('Session expired')
      return true
    }
    toast.error(err?.response?.data?.error || fallbackMessage)
    return false
  }

  const loadAgents = async ({ page: nextPage = page, limit: nextLimit = limit } = {}) => {
    setLoading(true)
    try {
      const params = {
        page: nextPage,
        limit: nextLimit,
      }
      const trimmedQuery = query.trim()
      if (trimmedQuery) params.query = trimmedQuery
      if (statusFilter !== 'all') params.status = statusFilter
      if (availabilityFilter !== 'all') params.availability = availabilityFilter
      const res = await adminApi.get('/admin/agents', { params })
      setAgents(res.data.agents || [])
      setPage(res.data.page || nextPage)
      setTotalPages(res.data.totalPages || 1)
      setHasMore(Boolean(res.data.hasMore))
      setTotalCount(Number(res.data.total || 0))
    } catch (err) {
      handleSessionError(err, 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAgents({ page })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [agents])

  const doAgentAction = async (id, action) => {
    try {
      await adminApi.post(`/admin/agents/${id}/${action}`)
      toast.success(`Agent ${action}`)
      await loadAgents({ page })
    } catch (err) {
      if (handleSessionError(err, 'Action failed')) return
    }
  }

  const doAgentDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/agents/${id}`)
      toast.success('Agent deleted')
      await loadAgents({ page: Math.max(1, page - (agents.length === 1 ? 1 : 0)) })
    } catch (err) {
      if (handleSessionError(err, 'Delete failed')) return
    }
  }

  const applyFilters = () => {
    setPage(1)
    loadAgents({ page: 1 })
  }

  const handleLimitChange = (value) => {
    const nextLimit = Number(value)
    setLimit(nextLimit)
    setPage(1)
    loadAgents({ page: 1, limit: nextLimit })
  }

  const listHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, agents.length * ROW_HEIGHT))
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(agents.length, Math.ceil((scrollTop + listHeight) / ROW_HEIGHT) + OVERSCAN)
  const visibleAgents = agents.slice(startIndex, endIndex)
  const paddingTop = startIndex * ROW_HEIGHT
  const paddingBottom = (agents.length - endIndex) * ROW_HEIGHT

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Agents</h2>
        <div className="text-sm text-slate-500">{totalCount || agents.length} total</div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          Search
          <input
            className="mt-1 w-64 rounded-lg border border-slate-200 px-3 py-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters()
            }}
            placeholder="Name, email, or ID"
          />
        </label>
        <label className="block text-sm">
          Status
          <select
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="block text-sm">
          Availability
          <select
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2"
            value={availabilityFilter}
            onChange={(event) => setAvailabilityFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
        </label>
        <label className="block text-sm">
          Page size
          <select
            className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2"
            value={limit}
            onChange={(event) => handleLimitChange(event.target.value)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="pill-btn-primary px-5" onClick={applyFilters} disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
        <button type="button" className="pill-btn-ghost px-5" onClick={() => loadAgents({ page })} disabled={loading}>
          Refresh
        </button>
      </div>
      {loading && <div className="text-sm text-slate-500">Loading agents...</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_360px] bg-slate-50 text-left text-slate-600 text-sm">
            <div className="px-3 py-2 font-semibold">Name</div>
            <div className="px-3 py-2 font-semibold">Email</div>
            <div className="px-3 py-2 font-semibold">Status</div>
            <div className="px-3 py-2 font-semibold">Availability</div>
            <div className="px-3 py-2 font-semibold">Actions</div>
          </div>
          {!loading && agents.length === 0 && (
            <div className="border-t border-slate-100 p-4 text-sm text-slate-500">No agents found.</div>
          )}
          {agents.length > 0 && (
            <div
              ref={scrollRef}
              className="overflow-y-auto"
              style={{ height: listHeight }}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <div style={{ paddingTop, paddingBottom }}>
                {visibleAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_360px] items-center border-t border-slate-100 px-3"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="py-2">
                      <button
                        type="button"
                        className="text-[#0b3b8c] hover:underline"
                        onClick={() => onOpenAgent(agent)}
                      >
                        {agent.name || `Agent #${agent.id}`}
                      </button>
                    </div>
                    <div className="py-2 text-sm text-slate-700">{agent.email || '--'}</div>
                    <div className="py-2">
                      <span className="rounded-full border border-slate-200 px-2 py-1 text-xs capitalize">
                        {agent.isSuspended ? 'suspended' : agent.status}
                      </span>
                      {agent.underReview && <span className="ml-2 text-xs text-amber-600">under review</span>}
                    </div>
                    <div className="py-2 text-sm text-slate-700">{agent.availability}</div>
                    <div className="py-2">
                      <div className="flex flex-nowrap gap-2">
                        <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(agent.id, 'approve')}>
                          Approve
                        </button>
                        <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(agent.id, 'reject')}>
                          Reject
                        </button>
                        <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(agent.id, 'review')}>
                          Review
                        </button>
                        <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(agent.id, 'suspend')}>
                          Suspend
                        </button>
                        <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(agent.id, 'restore')}>
                          Restore
                        </button>
                        <button
                          className="pill-btn-ghost px-2 py-1 text-xs text-red-600"
                          onClick={() => doAgentDelete(agent.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="pill-btn-ghost px-3 py-1"
            onClick={() => loadAgents({ page: Math.max(1, page - 1) })}
            disabled={loading || page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="pill-btn-ghost px-3 py-1"
            onClick={() => loadAgents({ page: page + 1 })}
            disabled={loading || !hasMore}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
