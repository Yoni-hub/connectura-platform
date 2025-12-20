import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'

const navItems = ['Overview', 'Profile', 'Clients', 'Messages', 'Appointments', 'Settings']

const formatTimestamp = (value) => (value ? new Date(value).toLocaleString() : '')

const getInitials = (name = '', fallback = 'CU') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return fallback
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function AgentDashboard() {
  const { user, lastPassword, setLastPassword, logout, setUser } = useAuth()
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agent, setAgent] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    zip: '',
    state: '',
    availability: 'online',
    phone: '',
    email: user?.email || '',
  })

  useEffect(() => {
    const fetchAgent = async () => {
      if (!user?.agentId) return
      setLoading(true)
      try {
        const res = await api.get(`/agents/${user.agentId}`)
        const current = res.data.agent
        setAgent({ ...current, phone: current.phone || '', email: current.email || user?.email || '' })
        setForm({
          name: current.name || '',
          address: current.address || '',
          zip: current.zip || '',
          state: Array.isArray(current.states) ? current.states[0] || '' : '',
          availability: current.availability || 'online',
          phone: current.phone || '',
          email: current.email || user?.email || '',
        })
      } catch {
        toast.error('Could not load your agent profile')
      } finally {
        setLoading(false)
      }
    }
    fetchAgent()
  }, [user?.agentId])

  const loadThreads = async () => {
    if (!user?.agentId) return
    setThreadsLoading(true)
    try {
      const res = await api.get(`/messages/agent/${user.agentId}/threads`)
      setThreads(res.data.threads || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load messages')
    } finally {
      setThreadsLoading(false)
    }
  }

  const loadThread = async (customerId) => {
    if (!user?.agentId || !customerId) return
    setThreadLoading(true)
    try {
      const res = await api.get(`/messages/agent/${user.agentId}/thread/${customerId}`)
      setThreadMessages(res.data.messages || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load conversation')
    } finally {
      setThreadLoading(false)
    }
  }

  const handleSendReply = async () => {
    const trimmed = replyBody.trim()
    if (!trimmed) {
      toast.error('Message cannot be empty')
      return
    }
    if (!activeThread?.customer?.id) {
      toast.error('Select a customer to reply')
      return
    }
    setSendingReply(true)
    try {
      await api.post('/messages', { customerId: activeThread.customer.id, body: trimmed })
      setReplyBody('')
      await loadThread(activeThread.customer.id)
      await loadThreads()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message')
    } finally {
      setSendingReply(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'Messages') return
    loadThreads()
  }, [activeTab, user?.agentId])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (!threads.length) {
      setActiveThread(null)
      setThreadMessages([])
      return
    }
    const match = activeThread
      ? threads.find((thread) => thread.customer?.id === activeThread.customer?.id)
      : null
    setActiveThread(match || threads[0])
  }, [threads, activeTab])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (activeThread?.customer?.id) {
      loadThread(activeThread.customer.id)
    }
  }, [activeTab, activeThread?.customer?.id])

  useEffect(() => {
    setReplyBody('')
  }, [activeThread?.customer?.id])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!agent) return
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        availability: form.availability,
        address: form.address,
        zip: form.zip,
        states: form.state ? [form.state] : [],
        phone: form.phone,
        email: form.email,
      }
      const res = await api.put(`/agents/${agent.id}`, payload)
      const updated = res.data.agent
      setAgent({ ...updated, phone: form.phone, email: form.email })
      if (setUser && user) {
        setUser({ ...user, email: form.email })
      }
      setForm({
        name: updated.name || '',
        address: updated.address || '',
        zip: updated.zip || '',
        state: Array.isArray(updated.states) ? updated.states[0] || '' : '',
        availability: updated.availability || 'online',
        phone: form.phone,
        email: form.email,
      })
      toast.success('Agent profile updated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) {
      toast.error('Enter and confirm your new password')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLastPassword(newPassword)
    setChangingPassword(false)
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Password updated locally (wire backend to persist)')
  }

  const initials = agent?.name ? agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'AG'

  return (
    <main className="page-shell py-8">
      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="surface p-4 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Connsura</div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={`w-full text-left rounded-xl px-3 py-2.5 font-semibold transition ${
                  activeTab === item
                    ? 'bg-[#e8f0ff] text-[#0b3b8c] shadow-sm'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Connsura Agent Dashboard</h1>
              <p className="text-slate-500">
                Welcome back{agent?.name ? `, ${agent.name.split(' ')[0]}` : ''}. Track your leads and appointments.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="pill-btn-ghost px-4"
                onClick={() => {
                  logout()
                  nav('/')
                }}
              >
                Log out
              </button>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#006aff]/12 text-[#0b3b8c] font-bold">
                {initials}
              </div>
            </div>
          </div>

          {loading && <Skeleton className="h-24" />}
          {!loading && !agent && (
            <div className="surface p-5 text-slate-700">
              No agent profile found for your account. Please sign out and sign up as an agent again.
            </div>
          )}

          {agent && (
            <>
              {activeTab === 'Settings' ? (
              <div className="surface p-5 space-y-3">
                <h2 className="text-xl font-semibold">Settings</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="text-sm text-slate-500">Email</div>
                    <div className="font-semibold">{user?.email || 'Not set'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="text-sm text-slate-500">Name</div>
                    <div className="font-semibold">{agent?.name || 'Not set'}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>Password</span>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-800"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18m-4.5-4.5A7 7 0 017 12m7 7a7 7 0 01-7-7m0 0a7 7 0 0111.667-5M12 9a3 3 0 013 3" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="font-semibold">
                      {showPassword ? lastPassword || 'No password captured this session' : '••••••••'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pill-btn-ghost text-sm px-4"
                    onClick={() => setChangingPassword((v) => !v)}
                  >
                    {changingPassword ? 'Cancel' : 'Change'}
                  </button>
                </div>
                {changingPassword && (
                  <form className="space-y-3" onSubmit={handlePasswordSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        New password
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        Confirm password
                        <input
                          type="password"
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="submit" className="pill-btn-primary px-5">
                        Save password
                      </button>
                    </div>
                  </form>
                )}
              </div>
                ) : activeTab === 'Profile' ? (
                <>
                  <form className="surface p-5 space-y-3" onSubmit={handleSave}>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">Profile & availability</h2>
                      <Badge label="Visible to customers" tone="green" />
                    </div>

                    <label className="block text-sm">
                      Agent/Agency name
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label className="block text-sm">
                  Email
                    <input
                      type="email"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>

                <label className="block text-sm">
                  Phone number
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                  />
                </label>

                <label className="block text-sm">
                  Address
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                      />
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm">
                        ZIP
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                          value={form.zip}
                          onChange={(e) => setForm({ ...form, zip: e.target.value })}
                        />
                      </label>
                      <label className="block text-sm">
                        State
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                        />
                      </label>
                    </div>

                    <label className="block text-sm">
                      Availability
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={form.availability}
                        onChange={(e) => setForm({ ...form, availability: e.target.value })}
                      >
                        <option value="online">Online</option>
                        <option value="busy">Busy</option>
                        <option value="offline">Offline</option>
                      </select>
                    </label>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          className="pill-btn-ghost"
                          onClick={() =>
                            agent &&
                            setForm({
                              name: agent.name || '',
                              address: agent.address || '',
                              zip: agent.zip || '',
                              state: Array.isArray(agent.states) ? agent.states[0] || '' : '',
                              availability: agent.availability || 'online',
                              phone: agent.phone || '',
                              email: agent.email || user?.email || '',
                            })
                          }
                        >
                          Cancel
                      </button>
                      <button type="submit" disabled={saving} className="pill-btn-primary px-8">
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </>
              ) : activeTab === 'Messages' ? (
                <div className="surface p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Messages</h2>
                    <button
                      type="button"
                      className="pill-btn-ghost px-4"
                      onClick={loadThreads}
                      disabled={threadsLoading}
                    >
                      {threadsLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customers</div>
                      {threadsLoading && <Skeleton className="h-20" />}
                      {!threadsLoading && threads.length === 0 && (
                        <div className="text-sm text-slate-500">No messages yet.</div>
                      )}
                      {!threadsLoading && threads.length > 0 && (
                        <div className="space-y-2">
                          {threads.map((thread) => {
                            const customerLabel =
                              thread.customer?.name || thread.customer?.email || 'Customer'
                            const previewPrefix = thread.lastMessage?.senderRole === 'AGENT' ? 'You: ' : ''
                            const preview = `${previewPrefix}${thread.lastMessage?.body || ''}`.trim()
                            const isActive = activeThread?.customer?.id === thread.customer?.id
                            return (
                              <button
                                key={thread.customer.id}
                                type="button"
                                onClick={() => setActiveThread(thread)}
                                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                  isActive
                                    ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 grid place-items-center font-semibold">
                                      {getInitials(customerLabel)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-900 truncate">{customerLabel}</div>
                                      <div className="text-xs text-slate-500 truncate">
                                        {preview || 'Start a conversation'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {formatTimestamp(thread.lastMessage?.createdAt)}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col min-h-[360px]">
                      {!activeThread && (
                        <div className="text-sm text-slate-500">Select a customer to start chatting.</div>
                      )}
                      {activeThread && (
                        <>
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div>
                              <div className="font-semibold text-slate-900">
                                {activeThread.customer?.name || activeThread.customer?.email || 'Customer'}
                              </div>
                              {activeThread.customer?.email && (
                                <div className="text-xs text-slate-500">{activeThread.customer.email}</div>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">
                              {formatTimestamp(activeThread.lastMessage?.createdAt)}
                            </div>
                          </div>

                          <div className="flex-1 space-y-3 overflow-y-auto py-4">
                            {threadLoading && <Skeleton className="h-24" />}
                            {!threadLoading && threadMessages.length === 0 && (
                              <div className="text-sm text-slate-500">No messages in this conversation.</div>
                            )}
                            {!threadLoading &&
                              threadMessages.map((message) => {
                                const isAgent = message.senderRole === 'AGENT'
                                return (
                                  <div key={message.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                                        isAgent
                                          ? 'bg-[#0b3b8c] text-white'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {message.body}
                                      <div
                                        className={`mt-1 text-[11px] ${
                                          isAgent ? 'text-white/70' : 'text-slate-400'
                                        }`}
                                      >
                                        {formatTimestamp(message.createdAt)}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>

                          <div className="flex gap-3 border-t border-slate-100 pt-3">
                            <textarea
                              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[44px]"
                              value={replyBody}
                              onChange={(e) => setReplyBody(e.target.value)}
                              placeholder="Write a reply..."
                            />
                            <button
                              type="button"
                              className="pill-btn-primary px-5"
                              onClick={handleSendReply}
                              disabled={sendingReply}
                            >
                              {sendingReply ? 'Sending...' : 'Send'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                null
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
