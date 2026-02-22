import { Suspense, lazy, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { API_URL } from '../services/api'
import { adminApi, clearAdminToken, setAdminToken } from '../services/adminApi'
import AdminDetailPanel from './admin/AdminDetailPanel'
import { validatePasswordPolicy } from '../utils/passwordPolicy'

const AdminClientsTab = lazy(() => import('./admin/AdminClientsTab'))
const AdminAuditTab = lazy(() => import('./admin/AdminAuditTab'))
const AdminErrorsTab = lazy(() => import('./admin/AdminErrorsTab'))
const AdminContentTab = lazy(() => import('./admin/AdminContentTab'))
const AdminFormsTab = lazy(() => import('./admin/AdminFormsTab'))
const AdminLegalTab = lazy(() => import('./admin/AdminLegalTab'))
const AdminNotificationLogsTab = lazy(() => import('./admin/AdminNotificationLogsTab'))
const AdminOtpTab = lazy(() => import('./admin/AdminOtpTab'))

export default function Admin({ initialView = 'clients' }) {
  const [admin, setAdmin] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [view, setView] = useState(initialView)
  const [form, setForm] = useState({ email: '', password: '' })
  const [detailTabs, setDetailTabs] = useState([])
  const [activeDetailKey, setActiveDetailKey] = useState(null)
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0)

  const isAuthed = Boolean(admin)

  useEffect(() => {
    let active = true
    const checkSession = async () => {
      try {
        const res = await adminApi.get('/admin/me')
        if (!active) return
        setAdmin(res.data.admin)
      } catch {
        if (!active) return
        setAdmin(null)
      } finally {
        if (active) setAuthChecking(false)
      }
    }
    checkSession()
    return () => {
      active = false
    }
  }, [])

  const activeDetailTab =
    detailTabs.find((t) => t.key === activeDetailKey) || (detailTabs.length ? detailTabs[detailTabs.length - 1] : null)

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      handleLogout()
      toast.error('Session expired')
      return true
    }
    if (fallbackMessage) {
      toast.error(err?.response?.data?.error || fallbackMessage)
    }
    return false
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      if (data?.token) {
        setAdminToken(data.token)
      }
      setAdmin(data.admin)
      setAuthChecking(false)
      toast.success('Admin logged in')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  const handleLogout = () => {
    adminApi.post('/admin/logout').catch(() => {})
    clearAdminToken()
    setAdmin(null)
    setDetailTabs([])
    setActiveDetailKey(null)
    setClientsRefreshKey(0)
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
          password: '',
          isDisabled: Boolean(detail.isDisabled),
        },
      })
    } catch (err) {
      handleSessionError(err, 'Failed to load client details')
      patchTab(key, { loading: false })
    }
  }

  const saveClientTab = async (tab) => {
    const payload = {
      name: tab.form.name,
      email: tab.form.email,
      isDisabled: Boolean(tab.form.isDisabled),
    }
    const nextPassword = String(tab.form.password || '')
    if (nextPassword.trim()) {
      const passwordPolicy = validatePasswordPolicy(nextPassword)
      if (!passwordPolicy.valid) {
        toast.error(passwordPolicy.message)
        return
      }
      payload.password = nextPassword
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
          password: '',
          isDisabled: Boolean(updated.isDisabled),
        },
      })
      setClientsRefreshKey((prev) => prev + 1)
      toast.success('Client saved')
    } catch (err) {
      patchTab(tab.key, { saving: false })
      handleSessionError(err, 'Save failed')
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

  let content
  if (authChecking) {
    content = <div className="text-sm text-slate-500">Checking admin session...</div>
  } else if (!isAuthed) {
    content = (
      <form className="max-w-md space-y-4" onSubmit={handleLogin}>
        <div>
          <h1 className="text-2xl font-semibold">Admin login</h1>
          <p className="text-sm text-slate-500">Full control for Connsura admins.</p>
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
  } else {
    content = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</div>
            <h1 className="text-2xl font-semibold">Connsura Admin Console</h1>
            <p className="text-sm text-slate-600">Manage clients, content, and audit logs.</p>
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
            { id: 'clients', label: 'Clients' },
            { id: 'audit', label: 'Audit logs' },
            { id: 'errors', label: 'Errors' },
            { id: 'otp', label: 'Email OTP Lookup' },
            { id: 'notifications', label: 'Notification Logs' },
            { id: 'content', label: 'Website Content Manager' },
            { id: 'forms', label: 'Forms Content Manager' },
            { id: 'legal', label: 'Legal & Consents' },
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
            <AdminDetailPanel
              tab={activeDetailTab}
              closeTab={closeTab}
              saveClientTab={saveClientTab}
              patchTabForm={patchTabForm}
            />
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-h-[300px]">
          <Suspense fallback={<div className="text-sm text-slate-500">Loading tab...</div>}>
            {view === 'clients' && (
              <AdminClientsTab
                onOpenClient={openClientTab}
                onSessionExpired={handleLogout}
                refreshKey={clientsRefreshKey}
              />
            )}
            {view === 'audit' && <AdminAuditTab onSessionExpired={handleLogout} />}
            {view === 'errors' && <AdminErrorsTab onSessionExpired={handleLogout} />}
            {view === 'otp' && <AdminOtpTab onSessionExpired={handleLogout} />}
            {view === 'notifications' && <AdminNotificationLogsTab onSessionExpired={handleLogout} />}
            {view === 'content' && <AdminContentTab onSessionExpired={handleLogout} />}
            {view === 'forms' && <AdminFormsTab onSessionExpired={handleLogout} />}
            {view === 'legal' && <AdminLegalTab onSessionExpired={handleLogout} />}
          </Suspense>
        </div>
      </div>
    )
  }

  return <main className="page-shell py-8">{content}</main>
}



