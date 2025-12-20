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
  const [detailTabs, setDetailTabs] = useState([])
  const [activeDetailKey, setActiveDetailKey] = useState(null)

  const isAuthed = Boolean(token)

  const splitList = (value = '') =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

  const joinList = (value = []) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : '')

  const activeDetailTab =
    detailTabs.find((t) => t.key === activeDetailKey) || (detailTabs.length ? detailTabs[detailTabs.length - 1] : null)

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
    setDetailTabs([])
    setActiveDetailKey(null)
  }

  const upsertTab = (tab) => {
    setDetailTabs((prev) => {
      const existing = prev.find((t) => t.key === tab.key)
      if (existing) {
        return prev.map((t) => (t.key === tab.key ? { ...t, ...tab } : t))
      }
      return [...prev, tab]
    })
    setActiveDetailKey(tab.key)
  }

  const patchTab = (key, patch) =>
    setDetailTabs((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  const patchTabForm = (key, patch) =>
    setDetailTabs((prev) =>
      prev.map((t) => (t.key === key ? { ...t, form: { ...(t.form || {}), ...patch } } : t))
    )

  const openAgentTab = async (agent) => {
    const key = `agent-${agent.id}`
    upsertTab({
      key,
      type: 'agent',
      id: agent.id,
      label: agent.name || `Agent #${agent.id}`,
      loading: true,
      saving: false,
      form: null,
      data: null,
    })
    try {
      const res = await adminApi.get(`/admin/agents/${agent.id}`)
      const detail = res.data.agent
      patchTab(key, {
        loading: false,
        data: detail,
        label: detail.name || `Agent #${agent.id}`,
        form: {
          name: detail.name || '',
          email: detail.email || '',
          password: detail.userPassword || '',
          bio: detail.bio || '',
          phone: detail.phone || '',
          address: detail.address || '',
          zip: detail.zip || '',
          availability: detail.availability || 'online',
          languages: joinList(detail.languages),
          states: joinList(detail.states),
          products: joinList(detail.products),
          appointedCarriers: joinList(detail.appointedCarriers),
          specialty: detail.specialty || '',
          producerNumber: detail.producerNumber || '',
          status: detail.status || 'pending',
          underReview: Boolean(detail.underReview),
          isSuspended: Boolean(detail.isSuspended),
          rating: detail.rating ?? '',
        },
      })
    } catch (err) {
      toast.error('Failed to load agent details')
      patchTab(key, { loading: false })
    }
  }

  const openClientTab = async (client) => {
    const key = `client-${client.id}`
    upsertTab({
      key,
      type: 'client',
      id: client.id,
      label: client.name || `Client #${client.id}`,
      loading: true,
      saving: false,
      form: null,
      data: null,
    })
    try {
      const res = await adminApi.get(`/admin/clients/${client.id}`)
      const detail = res.data.client
      patchTab(key, {
        loading: false,
        data: detail,
        label: detail.name || `Client #${client.id}`,
        form: {
          name: detail.name || '',
          email: detail.email || '',
          password: detail.userPassword || '',
          preferredLangs: joinList(detail.preferredLangs),
          coverages: joinList(detail.coverages),
          priorInsurance: joinList(detail.priorInsurance),
          profileData: JSON.stringify(detail.profileData || {}, null, 2),
          sharedWithAgent: Boolean(detail.sharedWithAgent),
          preferredAgentId: detail.preferredAgentId ?? '',
          isDisabled: Boolean(detail.isDisabled),
        },
      })
    } catch (err) {
      toast.error('Failed to load client details')
      patchTab(key, { loading: false })
    }
  }

  const saveAgentTab = async (tab) => {
    const payload = {
      name: tab.form.name,
      email: tab.form.email,
      password: tab.form.password,
      bio: tab.form.bio,
      phone: tab.form.phone,
      address: tab.form.address,
      zip: tab.form.zip,
      availability: tab.form.availability,
      specialty: tab.form.specialty,
      producerNumber: tab.form.producerNumber,
      languages: splitList(tab.form.languages),
      states: splitList(tab.form.states),
      products: splitList(tab.form.products),
      appointedCarriers: splitList(tab.form.appointedCarriers),
      status: tab.form.status,
      underReview: Boolean(tab.form.underReview),
      isSuspended: Boolean(tab.form.isSuspended),
    }
    if (tab.form.rating !== '' && tab.form.rating !== null && tab.form.rating !== undefined) {
      const ratingNumber = Number(tab.form.rating)
      if (!Number.isNaN(ratingNumber)) payload.rating = ratingNumber
    }
    patchTab(tab.key, { saving: true })
    try {
      const res = await adminApi.put(`/admin/agents/${tab.id}`, payload)
      const updated = res.data.agent
      patchTab(tab.key, {
        saving: false,
        data: updated,
        label: updated.name || tab.label,
        form: {
          ...tab.form,
          name: updated.name || '',
          email: updated.email || '',
          password: updated.userPassword || tab.form.password,
          bio: updated.bio || '',
          phone: updated.phone || '',
          address: updated.address || '',
          zip: updated.zip || '',
          availability: updated.availability || 'online',
          languages: joinList(updated.languages),
          states: joinList(updated.states),
          products: joinList(updated.products),
          appointedCarriers: joinList(updated.appointedCarriers),
          specialty: updated.specialty || '',
          producerNumber: updated.producerNumber || '',
          status: updated.status || 'pending',
          underReview: Boolean(updated.underReview),
          isSuspended: Boolean(updated.isSuspended),
          rating: updated.rating ?? '',
        },
      })
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))
      toast.success('Agent saved')
    } catch (err) {
      patchTab(tab.key, { saving: false })
      toast.error(err.response?.data?.error || 'Save failed')
    }
  }

  const saveClientTab = async (tab) => {
    let profileDataParsed = {}
    try {
      profileDataParsed = tab.form.profileData ? JSON.parse(tab.form.profileData) : {}
    } catch (err) {
      toast.error('Profile data must be valid JSON')
      return
    }
    const payload = {
      name: tab.form.name,
      email: tab.form.email,
      password: tab.form.password,
      preferredLangs: splitList(tab.form.preferredLangs),
      coverages: splitList(tab.form.coverages),
      priorInsurance: splitList(tab.form.priorInsurance),
      profileData: profileDataParsed,
      sharedWithAgent: Boolean(tab.form.sharedWithAgent),
      preferredAgentId:
        tab.form.preferredAgentId === '' || tab.form.preferredAgentId === null
          ? null
          : Number(tab.form.preferredAgentId),
      isDisabled: Boolean(tab.form.isDisabled),
    }
    if (payload.preferredAgentId !== null && Number.isNaN(payload.preferredAgentId)) {
      payload.preferredAgentId = null
    }
    patchTab(tab.key, { saving: true })
    try {
      const res = await adminApi.put(`/admin/clients/${tab.id}`, payload)
      const updated = res.data.client
      patchTab(tab.key, {
        saving: false,
        data: updated,
        label: updated.name || tab.label,
        form: {
          ...tab.form,
          name: updated.name || '',
          email: updated.email || '',
          password: updated.userPassword || tab.form.password,
          preferredLangs: joinList(updated.preferredLangs),
          coverages: joinList(updated.coverages),
          priorInsurance: joinList(updated.priorInsurance),
          profileData: JSON.stringify(updated.profileData || {}, null, 2),
          sharedWithAgent: Boolean(updated.sharedWithAgent),
          preferredAgentId: updated.preferredAgentId ?? '',
          isDisabled: Boolean(updated.isDisabled),
        },
      })
      setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      toast.success('Client saved')
    } catch (err) {
      patchTab(tab.key, { saving: false })
      toast.error(err.response?.data?.error || 'Save failed')
    }
  }


  const closeTab = (key) => {
    setDetailTabs((prev) => {
      const next = prev.filter((t) => t.key !== key)
      if (activeDetailKey === key) {
        setActiveDetailKey(next.length ? next[next.length - 1].key : null)
      }
      return next
    })
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
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-[#0b3b8c] hover:underline"
                    onClick={() => openAgentTab(a)}
                  >
                    {a.name || `Agent #${a.id}`}
                  </button>
                </td>
                <td className="px-3 py-2">{a.email || '--'}</td>
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
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-[#0b3b8c] hover:underline"
                    onClick={() => openClientTab(c)}
                  >
                    {c.name || `Client #${c.id}`}
                  </button>
                </td>
                <td className="px-3 py-2">{c.email || '--'}</td>
                <td className="px-3 py-2">{c.preferredAgentId || '--'}</td>
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
                <td className="px-3 py-2">{l.actorEmail || l.actorId || '--'}</td>
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

  const renderDetailContent = (tab) => {
    if (!tab) return null
    if (tab.loading) return <div className="text-slate-600">Loading details...</div>
    if (!tab.form) return <div className="text-slate-500">No details loaded.</div>
    const input = 'mt-1 w-1/5 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm'
    const textarea = `${input} min-h-[100px]`
    if (tab.type === 'agent') {
      return (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-slate-600">
              Agent #{tab.id} - editable onboarding and sign-up details (password shown hashed)
            </div>
            <div className="flex gap-2">
              <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
                Close tab
              </button>
              <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveAgentTab(tab)} disabled={tab.saving}>
                {tab.saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2.5">
              <label className="block text-[13px] font-semibold text-slate-700">
                Name
                <input className={input} value={tab.form.name} onChange={(e) => patchTabForm(tab.key, { name: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Email
                <input
                  className={input}
                  value={tab.form.email}
                  onChange={(e) => patchTabForm(tab.key, { email: e.target.value })}
                  type="email"
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Password (hashed)
                <input
                  className={input}
                  value={tab.form.password}
                  onChange={(e) => patchTabForm(tab.key, { password: e.target.value })}
                  type="text"
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Status
                <select
                  className={input}
                  value={tab.form.status}
                  onChange={(e) => patchTabForm(tab.key, { status: e.target.value })}
                >
                  {['pending', 'approved', 'rejected', 'suspended'].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3 text-[13px] font-semibold text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!tab.form.underReview}
                    onChange={(e) => patchTabForm(tab.key, { underReview: e.target.checked })}
                  />
                  Under review
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!tab.form.isSuspended}
                    onChange={(e) => patchTabForm(tab.key, { isSuspended: e.target.checked })}
                  />
                  Suspended
                </label>
              </div>
              <label className="block text-[13px] font-semibold text-slate-700">
                Rating
                <input
                  className={input}
                  value={tab.form.rating}
                  type="number"
                  step="0.1"
                  onChange={(e) => patchTabForm(tab.key, { rating: e.target.value })}
                />
              </label>
            </div>
            <div className="space-y-2.5">
              <label className="block text-[13px] font-semibold text-slate-700">
                Phone
                <input className={input} value={tab.form.phone} onChange={(e) => patchTabForm(tab.key, { phone: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Availability
                <select
                  className={input}
                  value={tab.form.availability}
                  onChange={(e) => patchTabForm(tab.key, { availability: e.target.value })}
                >
                  <option value="online">Online</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Address
                <input
                  className={input}
                  value={tab.form.address}
                  onChange={(e) => patchTabForm(tab.key, { address: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                ZIP
                <input className={input} value={tab.form.zip} onChange={(e) => patchTabForm(tab.key, { zip: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Producer/license number
                <input
                  className={input}
                  value={tab.form.producerNumber}
                  onChange={(e) => patchTabForm(tab.key, { producerNumber: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Specialty
                <input
                  className={input}
                  value={tab.form.specialty}
                  onChange={(e) => patchTabForm(tab.key, { specialty: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className="grid gap-2.5 md:grid-cols-4">
            <label className="block text-[13px] font-semibold text-slate-700">
              Languages (comma-separated)
              <input
                className={input}
                value={tab.form.languages}
                onChange={(e) => patchTabForm(tab.key, { languages: e.target.value })}
              />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              States (comma-separated)
              <input className={input} value={tab.form.states} onChange={(e) => patchTabForm(tab.key, { states: e.target.value })} />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Products (comma-separated)
              <input
                className={input}
                value={tab.form.products}
                onChange={(e) => patchTabForm(tab.key, { products: e.target.value })}
              />
            </label>
            <label className="block text-[13px] font-semibold text-slate-700">
              Appointed carriers (comma-separated)
              <input
                className={input}
                value={tab.form.appointedCarriers}
                onChange={(e) => patchTabForm(tab.key, { appointedCarriers: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-[13px] font-semibold text-slate-700">
            Bio
            <textarea
              className={textarea}
              value={tab.form.bio}
              onChange={(e) => patchTabForm(tab.key, { bio: e.target.value })}
              placeholder="Short bio used in onboarding"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
              Close tab
            </button>
            <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveAgentTab(tab)} disabled={tab.saving}>
              {tab.saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )
    }
    if (tab.type === 'client') {
      return (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-slate-600">Client #{tab.id} - full profile and sign-up details</div>
            <div className="flex gap-2">
              <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
                Close tab
              </button>
              <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveClientTab(tab)} disabled={tab.saving}>
                {tab.saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2.5">
              <label className="block text-[13px] font-semibold text-slate-700">
                Name
                <input className={input} value={tab.form.name} onChange={(e) => patchTabForm(tab.key, { name: e.target.value })} />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Email
                <input
                  className={input}
                  value={tab.form.email}
                  onChange={(e) => patchTabForm(tab.key, { email: e.target.value })}
                  type="email"
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Password (hashed)
                <input
                  className={input}
                  value={tab.form.password}
                  onChange={(e) => patchTabForm(tab.key, { password: e.target.value })}
                  type="text"
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Preferred agent ID
                <input
                  className={input}
                  value={tab.form.preferredAgentId}
                  onChange={(e) => patchTabForm(tab.key, { preferredAgentId: e.target.value })}
                  type="number"
                  min="1"
                />
              </label>
              <div className="flex items-center gap-3 text-[13px] font-semibold text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!tab.form.sharedWithAgent}
                    onChange={(e) => patchTabForm(tab.key, { sharedWithAgent: e.target.checked })}
                  />
                  Shared with agent
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!tab.form.isDisabled}
                    onChange={(e) => patchTabForm(tab.key, { isDisabled: e.target.checked })}
                  />
                  Disabled
                </label>
              </div>
            </div>
            <div className="space-y-2.5">
              <label className="block text-[13px] font-semibold text-slate-700">
                Preferred languages (comma-separated)
                <input
                  className={input}
                  value={tab.form.preferredLangs}
                  onChange={(e) => patchTabForm(tab.key, { preferredLangs: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Coverages (comma-separated)
                <input
                  className={input}
                  value={tab.form.coverages}
                  onChange={(e) => patchTabForm(tab.key, { coverages: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Prior insurance (comma-separated)
                <input
                  className={input}
                  value={tab.form.priorInsurance}
                  onChange={(e) => patchTabForm(tab.key, { priorInsurance: e.target.value })}
                />
              </label>
              <label className="block text-[13px] font-semibold text-slate-700">
                Profile data (JSON)
                <textarea
                  className={textarea}
                  value={tab.form.profileData}
                  onChange={(e) => patchTabForm(tab.key, { profileData: e.target.value })}
                  spellCheck={false}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="pill-btn-ghost px-3 py-1" onClick={() => closeTab(tab.key)}>
              Close tab
            </button>
            <button type="button" className="pill-btn-primary px-3 py-1" onClick={() => saveClientTab(tab)} disabled={tab.saving}>
              {tab.saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )
    }
    return null
  }

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
        <div className="flex flex-wrap items-center gap-2">
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
          {detailTabs.length > 0 && <span className="ml-1 text-xs font-semibold uppercase text-slate-400">Open tabs</span>}
          {detailTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                activeDetailTab?.key === tab.key
                  ? 'border-[#0b3b8c] bg-white text-[#0b3b8c]'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setActiveDetailKey(tab.key)}
            >
              <span>{tab.label}</span>
              <span
                role="button"
                className="text-slate-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.key)
                }}
              >
                x
              </span>
            </button>
          ))}
        </div>
        {activeDetailTab && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm max-w-xl md:max-w-3xl">
            {renderDetailContent(activeDetailTab)}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-h-[300px]">
          {loading && <div className="text-slate-500">Loading...</div>}
          {!loading && view === 'agents' && renderAgents()}
          {!loading && view === 'clients' && renderClients()}
          {!loading && view === 'audit' && renderAudit()}
        </div>
      </div>
    )
  }, [isAuthed, view, loading, agents, clients, logs, admin, form.email, form.password, detailTabs, activeDetailTab])

  return <main className="page-shell py-8">{content}</main>
}
