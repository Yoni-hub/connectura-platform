import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { API_URL, api } from '../services/api'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import AgentCard from '../components/agents/AgentCard'
import AuthenticatorPanel from '../components/settings/AuthenticatorPanel'
import Messages from './Messages'

const navItems = ['Overview', 'Onboarding', 'Clients', 'Messages', 'Settings']

const DEFAULT_AGENT_NOTIFICATION_PREFS = {
  email: 'all',
  inapp: true,
  loginAlerts: true,
  groups: {
    leads: true,
    messages: true,
    system: true,
  },
}

const normalizeAgentNotificationPrefs = (value = {}) => {
  const prefs = value && typeof value === 'object' ? value : {}
  const groups = prefs.groups && typeof prefs.groups === 'object' ? prefs.groups : {}
  const email = ['all', 'important', 'none'].includes(prefs.email) ? prefs.email : 'all'
  return {
    email,
    inapp: typeof prefs.inapp === 'boolean' ? prefs.inapp : true,
    loginAlerts: true,
    groups: {
      leads: typeof groups.leads === 'boolean' ? groups.leads : true,
      messages: typeof groups.messages === 'boolean' ? groups.messages : true,
      system: typeof groups.system === 'boolean' ? groups.system : true,
    },
  }
}

const LEGAL_DOC_META = [
  { type: 'terms', label: 'Terms & Conditions', href: '/terms' },
  { type: 'privacy', label: 'Privacy Policy', href: '/privacy' },
  { type: 'agent-terms', label: 'Agent Responsibilities', href: '/agent-responsibilities' },
  { type: 'data-sharing', label: 'Data Sharing', href: '/data-sharing' },
]

const SETTINGS_ITEMS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'terms', label: 'Terms and conditions' },
]

const resolveSettingsLabel = (id = '') => {
  const match = SETTINGS_ITEMS.find((item) => item.id === id)
  return match?.label || 'Settings'
}

const resolveTabFromSearch = (search = '') => {
  const params = new URLSearchParams(search)
  const value = params.get('tab')
  if (!value) return 'Overview'
  const match = navItems.find((item) => item.toLowerCase() === value.toLowerCase())
  return match || 'Overview'
}

const resolvePhotoUrl = (value = '') => {
  if (!value) return ''
  if (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return value
  return `${API_URL}${value}`
}

const summaryValue = (value) => {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'string') return value.trim() ? value : '—'
  return String(value)
}

const renderSummaryDetails = (details = []) => {
  const filtered = details.filter((detail) => detail && detail.value !== undefined && detail.value !== null)
  if (!filtered.length) {
    return <div className="text-sm text-slate-500">No details provided.</div>
  }
  return (
    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
      {filtered.map((detail) => (
        <div key={detail.label}>
          <span className="font-semibold text-slate-900">{detail.label}:</span> {summaryValue(detail.value)}
        </div>
      ))}
    </div>
  )
}

export default function AgentDashboard() {
  const { user, lastPassword, setLastPassword, setUser, completeAuth, consentStatus, setConsentStatus } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agent, setAgent] = useState(null)
  const [activeTab, setActiveTab] = useState(() => resolveTabFromSearch(window.location.search))
  const [settingsView, setSettingsView] = useState(null)
  const [settingsReturnTab, setSettingsReturnTab] = useState('Overview')
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_AGENT_NOTIFICATION_PREFS)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const notificationSaveRef = useRef(0)
  const [legalDocs, setLegalDocs] = useState([])
  const [legalLoading, setLegalLoading] = useState(false)
  const [legalError, setLegalError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordUpdating, setPasswordUpdating] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordOtpSent, setPasswordOtpSent] = useState(false)
  const [passwordOtpCode, setPasswordOtpCode] = useState('')
  const [passwordOtpError, setPasswordOtpError] = useState('')
  const [passwordOtpConfirming, setPasswordOtpConfirming] = useState(false)
  const [passwordOtpMessage, setPasswordOtpMessage] = useState('')
  const [passwordOtpCooldown, setPasswordOtpCooldown] = useState(0)
  const [passwordOtpResending, setPasswordOtpResending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    zip: '',
    state: '',
    availability: 'online',
    phone: '',
    email: user?.email || '',
    bio: '',
  })

  useEffect(() => {
    const nextTab = resolveTabFromSearch(location.search)
    setActiveTab(nextTab)
  }, [location.search])

  const updateTab = (nextTab) => {
    if (nextTab === 'Settings') {
      if (activeTab !== 'Settings') {
        setSettingsReturnTab(activeTab || 'Overview')
      }
      setSettingsView(null)
    } else {
      setSettingsView(null)
    }
    setActiveTab(nextTab)
    const params = new URLSearchParams(location.search)
    params.set('tab', nextTab.toLowerCase())
    if (nextTab !== 'Messages') {
      params.delete('conversationId')
      params.delete('agent')
      params.delete('client')
      params.delete('customer')
    }
    nav(`/agent/dashboard?${params.toString()}`, { replace: true })
  }

  useEffect(() => {
    if (activeTab !== 'Settings') return
    if (typeof window === 'undefined') return
    const keySuffix = user?.id ? String(user.id) : 'anon'
    const notificationKey = `connsura_agent_notification_prefs_${keySuffix}`
    setNotificationLoading(true)
    setNotificationMessage('')
    try {
      const stored = localStorage.getItem(notificationKey)
      const parsed = stored ? JSON.parse(stored) : {}
      setNotificationPrefs(normalizeAgentNotificationPrefs(parsed))
    } catch {
      setNotificationPrefs(DEFAULT_AGENT_NOTIFICATION_PREFS)
    } finally {
      setNotificationLoading(false)
    }
  }, [activeTab, user?.id])

  useEffect(() => {
    if (settingsView !== 'terms' && settingsView !== 'privacy') return
    let active = true
    setLegalLoading(true)
    setLegalError('')
    api
      .get('/legal')
      .then((res) => {
        if (!active) return
        setLegalDocs(res.data?.documents || [])
      })
      .catch((err) => {
        if (!active) return
        setLegalError(err.response?.data?.error || 'Unable to load legal documents')
      })
      .finally(() => {
        if (active) setLegalLoading(false)
      })
    return () => {
      active = false
    }
  }, [settingsView])

  useEffect(() => {
    if (!user) return
    if (settingsView !== 'privacy' && settingsView !== 'terms') return
    let active = true
    api
      .get('/legal/status/me')
      .then((res) => {
        if (!active) return
        setConsentStatus({
          required: res.data?.required || [],
          missing: res.data?.missing || [],
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [settingsView, user, setConsentStatus])

  useEffect(() => {
    const fetchAgent = async () => {
      if (!user?.agentId) return
      setLoading(true)
      try {
        const res = await api.get(`/agents/${user.agentId}`)
        const current = res.data.agent
        setAgent({ ...current, phone: current.phone || '', email: current.email || user?.email || '' })
        setPhotoPreview(resolvePhotoUrl(current.photo))
        setPhotoFile(null)
        setForm({
          name: current.name || '',
          address: current.address || '',
          zip: current.zip || '',
          state: Array.isArray(current.states) ? current.states[0] || '' : '',
          availability: current.availability || 'online',
          phone: current.phone || '',
          email: current.email || user?.email || '',
          bio: current.bio || '',
        })
      } catch {
        toast.error('Could not load your agent profile')
      } finally {
        setLoading(false)
      }
    }
    fetchAgent()
  }, [user?.agentId])

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  useEffect(() => {
    if (passwordOtpCooldown <= 0) return undefined
    const timer = setInterval(() => {
      setPasswordOtpCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [passwordOtpCooldown])

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB.')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!agent) return
    setSaving(true)
    try {
      let uploadedPhoto = ''
      if (photoFile) {
        setPhotoUploading(true)
        try {
          const data = new FormData()
          data.append('photo', photoFile)
          const res = await api.post(`/agents/${agent.id}/photo`, data)
          uploadedPhoto = res.data?.agent?.photo || res.data?.photo || ''
          if (uploadedPhoto) {
            setPhotoPreview(resolvePhotoUrl(uploadedPhoto))
          }
          setPhotoFile(null)
        } catch (err) {
          toast.error(err.response?.data?.error || 'Photo upload failed')
          setSaving(false)
          return
        } finally {
          setPhotoUploading(false)
        }
      }
      const payload = {
        name: form.name,
        availability: form.availability,
        address: form.address,
        zip: form.zip,
        states: form.state ? [form.state] : [],
        phone: form.phone,
        email: form.email,
        bio: form.bio,
      }
      const res = await api.put(`/agents/${agent.id}`, payload)
      const updated = res.data.agent
      const photoValue = uploadedPhoto || updated.photo
      setAgent({ ...updated, phone: form.phone, email: form.email, bio: form.bio, photo: photoValue })
      if (setUser && user) {
        setUser({ ...user, email: form.email })
      }
      if (photoValue) {
        setPhotoPreview(resolvePhotoUrl(photoValue))
      }
      setForm({
        name: updated.name || '',
        address: updated.address || '',
        zip: updated.zip || '',
        state: Array.isArray(updated.states) ? updated.states[0] || '' : '',
        availability: updated.availability || 'online',
        phone: form.phone,
        email: form.email,
        bio: updated.bio || form.bio || '',
      })
      toast.success('Agent profile updated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordOtpError('')
    setPasswordOtpMessage('')
    if (!currentPassword) {
      toast.error('Enter your current password')
      return
    }
    if (!newPassword || !confirmPassword) {
      toast.error('Enter and confirm your new password')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setPasswordUpdating(true)
    try {
      await api.post('/auth/password/request', {
        currentPassword,
        newPassword,
      })
      setPasswordOtpSent(true)
      setPasswordOtpCode('')
      setPasswordOtpMessage('Code sent to your email.')
      setPasswordOtpCooldown(3)
      setChangingPassword(false)
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Verification code sent. Check your email.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password')
    } finally {
      setPasswordUpdating(false)
    }
  }

  const handlePasswordOtpConfirm = async () => {
    const trimmed = passwordOtpCode.trim()
    if (!trimmed) {
      setPasswordOtpError('Enter the code from your email.')
      return
    }
    if (passwordOtpConfirming) return
    setPasswordOtpConfirming(true)
    setPasswordOtpError('')
    try {
      const res = await api.post('/auth/password/confirm', { code: trimmed })
      if (res.data?.token && completeAuth) {
        const persist = typeof window !== 'undefined' && localStorage.getItem('connsura_token')
        completeAuth(res.data.token, res.data.user || user, null, { persist: Boolean(persist) })
      } else if (res.data?.user) {
        setUser(res.data.user)
      }
      setLastPassword('')
      setPasswordOtpCode('')
      setPasswordOtpMessage('')
      setPasswordOtpSent(false)
      toast.success('Password updated')
    } catch (err) {
      const message = err.response?.data?.error || 'Verification failed'
      setPasswordOtpError(message)
      toast.error(message)
    } finally {
      setPasswordOtpConfirming(false)
    }
  }

  const handlePasswordOtpResend = async () => {
    setPasswordOtpError('')
    setPasswordOtpMessage('')
    try {
      setPasswordOtpResending(true)
      await api.post('/auth/password/resend')
      setPasswordOtpMessage('Code sent to your email.')
      setPasswordOtpCooldown(3)
      toast.success('Verification code sent')
    } catch (err) {
      const message = err.response?.data?.error || 'Could not resend code'
      setPasswordOtpError(message)
      toast.error(message)
    } finally {
      setPasswordOtpResending(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Enter your password to continue')
      return
    }
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm')
      return
    }
    setDeleting(true)
    try {
      await api.post('/auth/account/delete', { password: deletePassword })
      nav('/account-deleted', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  const saveAgentNotificationPreferences = (nextPrefs) => {
    if (typeof window === 'undefined') return
    const keySuffix = user?.id ? String(user.id) : 'anon'
    const notificationKey = `connsura_agent_notification_prefs_${keySuffix}`
    const saveId = notificationSaveRef.current + 1
    notificationSaveRef.current = saveId
    setNotificationSaving(true)
    setNotificationMessage('')
    try {
      localStorage.setItem(notificationKey, JSON.stringify(nextPrefs))
      if (notificationSaveRef.current !== saveId) return
      setNotificationMessage('Saved')
    } catch {
      if (notificationSaveRef.current !== saveId) return
      setNotificationMessage('Unable to save changes')
    } finally {
      if (notificationSaveRef.current === saveId) {
        setNotificationSaving(false)
      }
    }
  }

  const initials = agent?.name ? agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'AG'
  const previewAgent = {
    id: agent?.id || 0,
    name: form.name || agent?.name || 'Agent',
    photo: photoPreview || resolvePhotoUrl(agent?.photo),
    rating: typeof agent?.rating === 'number' ? agent.rating : 4.8,
    availability: form.availability || agent?.availability || 'online',
    specialty: agent?.specialty || 'Insurance advisor',
    languages: Array.isArray(agent?.languages) && agent.languages.length ? agent.languages : ['English'],
    states:
      Array.isArray(agent?.states) && agent.states.length
        ? agent.states
        : form.state
          ? [form.state]
          : ['Virginia'],
  }
  const previewProducerNumber = agent?.producerNumber || '—'
  const previewProducts =
    Array.isArray(agent?.products) && agent.products.length ? agent.products.join(', ') : '—'
  const previewEmail = form.email || agent?.email || user?.email || '—'
  const previewPhone = form.phone || agent?.phone || '—'
  const previewState =
    form.state || (Array.isArray(agent?.states) ? agent.states[0] : '') || ''
  const previewZip = form.zip || agent?.zip || ''
  const previewAddress = [
    form.address || agent?.address || '',
    [previewState, previewZip].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ') || '—'
  const previewBio = agent?.bio || 'Licensed agent on Connsura.'
  const needsAuthenticator = Boolean(user) && !user.totpEnabled
  const summaryCardClass =
    'w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]'
  const onboardingAccountDetails = [{ label: 'Account email', value: agent?.email || user?.email }]
  const onboardingIdentityDetails = [
    { label: 'Producer #', value: agent?.producerNumber },
    { label: 'States', value: Array.isArray(agent?.states) ? agent.states : [] },
    { label: 'Address', value: agent?.address },
    { label: 'ZIP', value: agent?.zip },
    { label: 'Phone', value: agent?.phone },
    { label: 'Availability', value: agent?.availability },
  ]
  const onboardingProductDetails = [
    { label: 'Specialty', value: agent?.specialty },
    { label: 'Languages', value: Array.isArray(agent?.languages) ? agent.languages : [] },
    { label: 'Products', value: Array.isArray(agent?.products) ? agent.products : [] },
    { label: 'Appointed carriers', value: Array.isArray(agent?.appointedCarriers) ? agent.appointedCarriers : [] },
    { label: 'Bio', value: agent?.bio },
  ]
  const currentNotificationPrefs = notificationPrefs || DEFAULT_AGENT_NOTIFICATION_PREFS
  const missingConsents = consentStatus?.missing || []
  const consentUpToDate = missingConsents.length === 0
  const legalDocsByType = useMemo(() => {
    const map = {}
    legalDocs.forEach((doc) => {
      if (doc?.type) {
        map[doc.type] = doc
      }
    })
    return map
  }, [legalDocs])

  return (
    <main className="page-shell py-8 pb-28 lg:pb-8">
      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="surface fixed bottom-0 left-0 right-0 z-30 rounded-none border-t border-slate-200 border-x-0 border-b-0 bg-white/95 backdrop-blur px-3 py-2 lg:static lg:rounded-2xl lg:border lg:border-transparent lg:bg-white/80 lg:backdrop-blur-0 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 hidden lg:block">Connsura</div>
          <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => updateTab(item)}
                className={`min-w-max rounded-xl px-3 py-2.5 text-sm font-semibold text-center transition whitespace-nowrap lg:w-full lg:text-left flex items-center justify-between gap-2 ${
                  activeTab === item
                    ? 'bg-[#e8f0ff] text-[#0b3b8c] shadow-sm'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{item}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          {activeTab === 'Overview' && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-slate-500">
                  Welcome back{agent?.name ? `, ${agent.name.split(' ')[0]}` : ''}. Track your clients and messages.
                </p>
              </div>
            </div>
          )}

          {loading && <Skeleton className="h-24" />}
          {!loading && !agent && (
            <div className="surface p-5 text-slate-700">
              No agent profile found for your account. Please sign out and sign up as an agent again.
            </div>
          )}

          {agent && (
            <>
              {activeTab === 'Overview' ? (
              <div className="surface p-5">
                {needsAuthenticator && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">
                      Add Google Authenticator for account recovery
                    </div>
                    <p className="mt-1 text-sm text-amber-700">
                      Set it up in Settings to recover access if you forget your password or email.
                    </p>
                    <button
                      type="button"
                      className="pill-btn-primary mt-3 px-4"
                      onClick={() => updateTab('Settings')}
                    >
                      Set up now
                    </button>
                  </div>
                )}
              </div>
              ) : activeTab === 'Messages' ? (
              <Messages embedded />
              ) : activeTab === 'Settings' ? (
              <div className="space-y-6">
                {!settingsView && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">Settings</h2>
                      <button
                        type="button"
                        className="pill-btn-ghost px-4"
                        onClick={() => updateTab(settingsReturnTab || 'Overview')}
                      >
                        Back
                      </button>
                    </div>
                    <div className="space-y-3">
                      {SETTINGS_ITEMS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                          onClick={() => setSettingsView(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {settingsView && (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="pill-btn-ghost px-4"
                      onClick={() => setSettingsView(null)}
                    >
                      Back
                    </button>
                    <div className="text-sm font-semibold text-slate-700">{resolveSettingsLabel(settingsView)}</div>
                  </div>
                )}

                {settingsView === 'account' && (
                  <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
                    <form className="surface p-4 space-y-2 max-w-md w-full" onSubmit={handleSave}>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold">Profile & availability</h2>
                        <Badge label="Visible to customers" tone="green" />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center overflow-hidden border border-slate-200">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Agent profile" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-lg font-semibold">{initials}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label
                            className={`pill-btn-ghost px-4 py-1.5 text-sm inline-flex items-center gap-2 ${
                              photoUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            Upload photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handlePhotoChange}
                              disabled={photoUploading || saving}
                            />
                          </label>
                          <div className="text-xs text-slate-500">JPG or PNG, up to 2MB.</div>
                        </div>
                      </div>

                      <label className="block text-sm">
                        Agent/Agency name
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </label>

                      <label className="block text-sm">
                        Email
                        <input
                          type="email"
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </label>

                      <label className="block text-sm">
                        Phone number
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="e.g., (555) 123-4567"
                        />
                      </label>

                      <label className="block text-sm">
                        Address
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block text-sm">
                          ZIP
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                            value={form.zip}
                            onChange={(e) => setForm({ ...form, zip: e.target.value })}
                          />
                        </label>
                        <label className="block text-sm">
                          State
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                            value={form.state}
                            onChange={(e) => setForm({ ...form, state: e.target.value })}
                          />
                        </label>
                      </div>

                            <label className="block text-sm">
                              Availability
                              <select
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                                value={form.availability}
                                onChange={(e) => setForm({ ...form, availability: e.target.value })}
                              >
                                <option value="online">Online</option>
                                <option value="busy">Busy</option>
                                <option value="offline">Offline</option>
                              </select>
                            </label>

                            <label className="block text-sm">
                              Bio
                              <textarea
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                rows={4}
                                value={form.bio}
                                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                                placeholder="Share a short description of your experience."
                              />
                            </label>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          className="pill-btn-ghost"
                          onClick={() => {
                            if (!agent) return
                                  setForm({
                                    name: agent.name || '',
                                    address: agent.address || '',
                                    zip: agent.zip || '',
                                    state: Array.isArray(agent.states) ? agent.states[0] || '' : '',
                                    availability: agent.availability || 'online',
                                    phone: agent.phone || '',
                                    email: agent.email || user?.email || '',
                                    bio: agent.bio || '',
                                  })
                            setPhotoFile(null)
                            setPhotoPreview(resolvePhotoUrl(agent.photo))
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" disabled={saving || photoUploading} className="pill-btn-primary px-8">
                          {saving || photoUploading ? 'Saving...' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                    <div className="surface p-4 space-y-3 min-h-[420px]">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold">What clients see</h3>
                        <Badge label="Preview" tone="blue" />
                      </div>
                      <p className="text-sm text-slate-500">
                        This is the public profile card customers see when they search for agents.
                      </p>
                      <AgentCard agent={previewAgent} />
                      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                        <div className="grid gap-2 text-sm text-slate-600">
                          <div>
                            <span className="text-slate-500">Producer #:</span> {previewProducerNumber}
                          </div>
                          <div>
                            <span className="text-slate-500">Products:</span> {previewProducts}
                          </div>
                          <div>
                            <span className="text-slate-500">Email:</span> {previewEmail}
                          </div>
                          <div>
                            <span className="text-slate-500">Phone:</span> {previewPhone}
                          </div>
                          <div>
                            <span className="text-slate-500">Address:</span> {previewAddress}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Bio</div>
                          <p>{previewBio}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsView === 'security' && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                      <div className="flex items-center justify-between gap-3">
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
                          onClick={() => {
                            if (changingPassword) {
                              setCurrentPassword('')
                              setNewPassword('')
                              setConfirmPassword('')
                            }
                            setChangingPassword((v) => !v)
                          }}
                        >
                          {changingPassword ? 'Cancel' : 'Change password'}
                        </button>
                      </div>
                      {changingPassword && (
                        <form className="space-y-2" onSubmit={handlePasswordSubmit}>
                          <label className="block text-sm">
                            Current password
                            <input
                              type="password"
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                          </label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block text-sm">
                              New password
                              <input
                                type={showPassword ? 'text' : 'password'}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                            </label>
                            <label className="block text-sm">
                              Confirm password
                              <input
                                type="password"
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                              />
                            </label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="submit" className="pill-btn-primary px-5" disabled={passwordUpdating}>
                              {passwordUpdating ? 'Saving...' : 'Save password'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    {passwordOtpSent && (
                      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                        <div className="text-sm font-semibold text-slate-900">Verify password change</div>
                        <p className="text-xs text-slate-500">
                          Enter the 6-digit code sent to {user?.email || 'your email'}.
                        </p>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={passwordOtpCode}
                          onChange={(event) => {
                            const next = event.target.value.replace(/\D/g, '').slice(0, 6)
                            setPasswordOtpCode(next)
                          }}
                          placeholder="Enter 6-digit code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                        {passwordOtpMessage && (
                          <div className="text-xs font-semibold text-emerald-600">{passwordOtpMessage}</div>
                        )}
                        {passwordOtpError && (
                          <div className="text-xs font-semibold text-rose-600">{passwordOtpError}</div>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="pill-btn-ghost px-4"
                            onClick={handlePasswordOtpResend}
                            disabled={passwordOtpResending || passwordOtpCooldown > 0}
                          >
                            {passwordOtpCooldown > 0 ? `Resend in ${passwordOtpCooldown}s` : 'Resend code'}
                          </button>
                          <button
                            type="button"
                            className="pill-btn-primary px-5"
                            onClick={handlePasswordOtpConfirm}
                            disabled={passwordOtpConfirming}
                          >
                            {passwordOtpConfirming ? 'Verifying...' : 'Verify password'}
                          </button>
                        </div>
                      </div>
                    )}
                    <AuthenticatorPanel />

                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                      <div className="text-sm font-semibold text-rose-700">Delete account</div>
                      <p className="text-xs text-rose-700">
                        This permanently deletes your account, profile, and messages. This cannot be undone.
                      </p>
                      {!deleteOpen ? (
                        <button
                          type="button"
                          className="pill-btn-ghost text-rose-700 border-rose-200 hover:border-rose-300"
                          onClick={() => setDeleteOpen(true)}
                        >
                          Delete account
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-sm text-rose-800">
                            Password
                            <input
                              type="password"
                              className="mt-1 w-full rounded-xl border border-rose-200 px-3 py-1.5"
                              value={deletePassword}
                              onChange={(e) => setDeletePassword(e.target.value)}
                              placeholder="Enter your password"
                            />
                          </label>
                          <label className="block text-sm text-rose-800">
                            Type DELETE to confirm
                            <input
                              type="text"
                              className="mt-1 w-full rounded-xl border border-rose-200 px-3 py-1.5 uppercase tracking-widest"
                              value={deleteConfirm}
                              onChange={(e) => setDeleteConfirm(e.target.value)}
                              placeholder="DELETE"
                            />
                          </label>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="pill-btn-ghost"
                              onClick={() => {
                                setDeleteOpen(false)
                                setDeletePassword('')
                                setDeleteConfirm('')
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="pill-btn-primary px-5"
                              onClick={handleDeleteAccount}
                              disabled={deleting}
                            >
                              {deleting ? 'Deleting...' : 'Delete account'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {settingsView === 'privacy' && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      We only use essential cookies for sign-in, security, and session management. No ads or tracking.
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-slate-500">Consent status</div>
                        <div
                          className={`text-xs font-semibold ${
                            consentUpToDate ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {consentUpToDate ? 'Up to date' : 'Action required'}
                        </div>
                      </div>
                      <div className="text-sm text-slate-700">
                        {`Version ${legalDocsByType.privacy?.version || '1.4'} • ${
                          legalDocsByType.privacy?.publishedAt
                            ? new Date(legalDocsByType.privacy.publishedAt).toLocaleDateString('en-US')
                            : '1/29/2026'
                        }`}
                      </div>
                      <Link to="/privacy" className="text-sm font-semibold text-[#0b3b8c] hover:underline">
                        View document
                      </Link>
                    </div>
                  </div>
                )}

                {settingsView === 'notifications' && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">Notifications</h3>
                      <p className="text-xs text-slate-500">Control how we keep you updated.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">Changes save automatically.</div>
                        {notificationSaving && <div className="text-xs text-slate-500">Saving...</div>}
                        {!notificationSaving && notificationMessage && (
                          <div
                            className={`text-xs font-semibold ${
                              notificationMessage === 'Saved' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {notificationMessage}
                          </div>
                        )}
                      </div>

                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Email notifications</div>
                          <div className="text-xs text-slate-500">Updates about messages and new leads.</div>
                        </div>
                        <select
                          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                          value={currentNotificationPrefs.email}
                          onChange={(event) => {
                            const next = normalizeAgentNotificationPrefs({
                              ...currentNotificationPrefs,
                              email: event.target.value,
                            })
                            setNotificationPrefs(next)
                            saveAgentNotificationPreferences(next)
                          }}
                          disabled={notificationLoading}
                        >
                          <option value="all">All</option>
                          <option value="important">Important only</option>
                          <option value="none">None</option>
                        </select>
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">In-app notifications</div>
                          <div className="text-xs text-slate-500">Badges and reminders in your dashboard.</div>
                        </div>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={currentNotificationPrefs.inapp}
                          onChange={(event) => {
                            const next = normalizeAgentNotificationPrefs({
                              ...currentNotificationPrefs,
                              inapp: event.target.checked,
                            })
                            setNotificationPrefs(next)
                            saveAgentNotificationPreferences(next)
                          }}
                          disabled={notificationLoading}
                        />
                      </label>

                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm text-left"
                        disabled
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Login alerts</div>
                          <div className="text-xs text-slate-500">Enabled (required for security)</div>
                        </div>
                        <input type="checkbox" className="h-4 w-4" checked readOnly disabled />
                      </button>

                      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                        <div className="text-sm font-semibold text-slate-900">Notification groups</div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                            New leads
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={currentNotificationPrefs.groups.leads}
                              onChange={(event) => {
                                const next = normalizeAgentNotificationPrefs({
                                  ...currentNotificationPrefs,
                                  groups: {
                                    ...currentNotificationPrefs.groups,
                                    leads: event.target.checked,
                                  },
                                })
                                setNotificationPrefs(next)
                                saveAgentNotificationPreferences(next)
                              }}
                              disabled={notificationLoading}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                            Messages
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={currentNotificationPrefs.groups.messages}
                              onChange={(event) => {
                                const next = normalizeAgentNotificationPrefs({
                                  ...currentNotificationPrefs,
                                  groups: {
                                    ...currentNotificationPrefs.groups,
                                    messages: event.target.checked,
                                  },
                                })
                                setNotificationPrefs(next)
                                saveAgentNotificationPreferences(next)
                              }}
                              disabled={notificationLoading}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                            System
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={currentNotificationPrefs.groups.system}
                              onChange={(event) => {
                                const next = normalizeAgentNotificationPrefs({
                                  ...currentNotificationPrefs,
                                  groups: {
                                    ...currentNotificationPrefs.groups,
                                    system: event.target.checked,
                                  },
                                })
                                setNotificationPrefs(next)
                                saveAgentNotificationPreferences(next)
                              }}
                              disabled={notificationLoading}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsView === 'terms' && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">Terms & Conditions</h3>
                      <p className="text-xs text-slate-500">Accepted policy versions for your agent account.</p>
                    </div>
                    {legalLoading && <div className="text-sm text-slate-600">Loading legal documents...</div>}
                    {!legalLoading && legalError && (
                      <div className="text-sm font-semibold text-rose-600">{legalError}</div>
                    )}
                    {!legalLoading && !legalError && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {LEGAL_DOC_META.filter((doc) => doc.type !== 'privacy').map((doc) => {
                          const latest = legalDocsByType[doc.type]
                          return (
                            <div key={doc.type} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {doc.label}
                              </div>
                              <div className="text-sm text-slate-700">
                                {latest?.version ? `Version ${latest.version}` : 'Latest version'}
                                {latest?.publishedAt
                                  ? ` • ${new Date(latest.publishedAt).toLocaleDateString()}`
                                  : ''}
                              </div>
                              <Link to={doc.href} className="text-sm font-semibold text-[#0b3b8c] hover:underline">
                                View document
                              </Link>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              ) : activeTab === 'Onboarding' ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Review the onboarding details you submitted.</p>
                  <div className={summaryCardClass}>
                    <div className="text-sm font-semibold text-slate-900">Account credentials</div>
                    {renderSummaryDetails(onboardingAccountDetails)}
                  </div>
                  <div className={summaryCardClass}>
                    <div className="text-sm font-semibold text-slate-900">Identity & licensing</div>
                    {renderSummaryDetails(onboardingIdentityDetails)}
                  </div>
                  <div className={summaryCardClass}>
                    <div className="text-sm font-semibold text-slate-900">Products & audiences</div>
                    {renderSummaryDetails(onboardingProductDetails)}
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


