import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { API_URL } from '../services/api'
import { adminApi, ADMIN_TOKEN_KEY } from '../services/adminApi'

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '')
  const [admin, setAdmin] = useState(null)
  const [view, setView] = useState('agents')
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState([])
  const [clients, setClients] = useState([])
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState({ email: '', password: '' })

  const isAuthed = Boolean(token)

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      setToken(data.token)
      setAdmin(data.admin)
      toast.success('Admin logged in')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setToken('')
    setAdmin(null)
    setAgents([])
    setClients([])
    setLogs([])
  }

  useEffect(() => {
    const load = async () => {
      if (!isAuthed) return
      setLoading(true)
      try {
        if (view === 'agents') {
          const res = await adminApi.get('/admin/agents')
          setAgents(res.data.agents || [])
        } else if (view === 'clients') {
          const res = await adminApi.get('/admin/clients')
          setClients(res.data.clients || [])
        } else if (view === 'audit') {
          const res = await adminApi.get('/admin/audit')
          setLogs(res.data.logs || [])
        }
      } catch (err) {
        if (err.response?.status === 401) {
          handleLogout()
          toast.error('Session expired')
        } else {
          toast.error('Failed to load data')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAuthed, view])

  const doAgentAction = async (id, action) => {
    try {
      await adminApi.post(`/admin/agents/${id}/${action}`)
      toast.success(`Agent ${action}`)
      const res = await adminApi.get('/admin/agents')
      setAgents(res.data.agents || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  const doAgentUpdate = async (id, payload) => {
    try {
      await adminApi.put(`/admin/agents/${id}`, payload)
      toast.success('Agent updated')
      const res = await adminApi.get('/admin/agents')
      setAgents(res.data.agents || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    }
  }

  const doAgentDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/agents/${id}`)
      toast.success('Agent deleted')
      setAgents((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  const doClientAction = async (id, action) => {
    try {
      await adminApi.post(`/admin/clients/${id}/${action}`)
      toast.success(`Client ${action}`)
      const res = await adminApi.get('/admin/clients')
      setClients(res.data.clients || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    }
  }

  const doClientUpdate = async (id, payload) => {
    try {
      await adminApi.put(`/admin/clients/${id}`, payload)
      toast.success('Client updated')
      const res = await adminApi.get('/admin/clients')
      setClients(res.data.clients || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    }
  }

  const doClientDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/clients/${id}`)
      toast.success('Client deleted')
      setClients((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  const renderAgents = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Agents</h2>
        <div className="text-sm text-slate-500">{agents.length} total</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Availability</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2">{a.email || '—'}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-slate-200 px-2 py-1 text-xs capitalize">
                    {a.isSuspended ? 'suspended' : a.status}
                  </span>
                  {a.underReview && <span className="ml-2 text-xs text-amber-600">under review</span>}
                </td>
                <td className="px-3 py-2">{a.availability}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'approve')}>
                    Approve
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'reject')}>
                    Reject
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'review')}>
                    Review
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'suspend')}>
                    Suspend
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doAgentAction(a.id, 'restore')}>
                    Restore
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => doAgentDelete(a.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderClients = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Clients</h2>
        <div className="text-sm text-slate-500">{clients.length} total</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Preferred agent</th>
              <th className="px-3 py-2">Disabled</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.email || '—'}</td>
                <td className="px-3 py-2">{c.preferredAgentId || '—'}</td>
                <td className="px-3 py-2">{c.isDisabled ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doClientAction(c.id, 'disable')}>
                    Disable
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doClientAction(c.id, 'enable')}>
                    Enable
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => doClientAction(c.id, 'unshare')}>
                    Unshare
                  </button>
                  <button className="pill-btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => doClientDelete(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderAudit = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Audit logs</h2>
        <div className="text-sm text-slate-500">{logs.length} entries</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{l.actorEmail || l.actorId || '—'}</td>
                <td className="px-3 py-2">
                  {l.targetType} #{l.targetId}
                </td>
                <td className="px-3 py-2 capitalize">{l.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const content = useMemo(() => {
    if (!isAuthed) {
      return (
        <form className="max-w-md space-y-4" onSubmit={handleLogin}>
          <div>
            <h1 className="text-2xl font-semibold">Admin login</h1>
            <p className="text-sm text-slate-500">Full control for Connectura admins.</p>
          </div>
          <label className="block text-sm">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              type="email"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              type="password"
            />
          </label>
          <button type="submit" className="pill-btn-primary w-full justify-center">
            Log in
          </button>
        </form>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</div>
            <h1 className="text-2xl font-semibold">Connectura Admin Console</h1>
            <p className="text-sm text-slate-600">Manage agents, clients, and audit logs.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{admin?.email || 'Admin'}</span>
            <button type="button" className="pill-btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'agents', label: 'Agents' },
            { id: 'clients', label: 'Clients' },
            { id: 'audit', label: 'Audit logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view === tab.id ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-h-[300px]">
          {loading && <div className="text-slate-500">Loading...</div>}
          {!loading && view === 'agents' && renderAgents()}
          {!loading && view === 'clients' && renderClients()}
          {!loading && view === 'audit' && renderAudit()}
        </div>
      </div>
    )
  }, [isAuthed, view, loading, agents, clients, logs, admin, form.email, form.password])

  return <main className="page-shell py-8">{content}</main>
}
