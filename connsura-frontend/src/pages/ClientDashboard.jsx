import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useAgents } from '../context/AgentContext'
import { API_URL, api } from '../services/api'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import AgentCard from '../components/agents/AgentCard'
import MessageAgentModal from '../components/modals/MessageAgentModal'

const navItems = ['Overview', 'Profile', 'Forms', 'Agents', 'Messages', 'Appointments', 'Settings']

const parseFullName = (fullName = '') => {
  const parts = fullName.trim().split(' ').filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : parts[1] || ''
  return { firstName, middleName, lastName }
}

const formatTimestamp = (value) => (value ? new Date(value).toLocaleString() : '')

const getInitials = (name = '', fallback = 'AG') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return fallback
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const formatLangs = (value) => {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'string') return value
  return ''
}

const parseLangs = (value = '') =>
  value
    .split(',')
    .map((lang) => lang.trim())
    .filter(Boolean)

const resolvePhotoUrl = (value = '') => {
  if (!value) return ''
  if (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return value
  return `${API_URL}${value}`
}

export default function ClientDashboard() {
  const { user, lastPassword, setLastPassword, logout } = useAuth()
  const { getAgent } = useAgents()
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [client, setClient] = useState(null)
  const [savedAgent, setSavedAgent] = useState(null)
  const [savedAgentLoading, setSavedAgentLoading] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageAgent, setMessageAgent] = useState(null)
  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    zip: '',
    state: '',
    availability: 'online',
    preferredLangs: '',
    notes: '',
  })

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.customerId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await api.get(`/customers/${user.customerId}/profile`)
        const profile = res.data.profile
        setClient(profile)
        const nameParts = parseFullName(profile?.name || '')
        const details = profile?.profileData || {}
        setPhotoPreview(resolvePhotoUrl(details.photo))
        setPhotoFile(null)
        setForm({
          firstName: details.firstName || nameParts.firstName,
          middleName: details.middleName || nameParts.middleName,
          lastName: details.lastName || nameParts.lastName,
          email: details.email || user?.email || '',
          phone: details.phone || '',
          address: details.address || '',
          zip: details.zip || '',
          state: details.state || '',
          availability: details.availability || 'online',
          preferredLangs: formatLangs(details.preferredLangs || profile?.preferredLangs || []),
          notes: details.notes || '',
        })
      } catch {
        setClient(null)
        setPhotoPreview('')
        setPhotoFile(null)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [user?.customerId, user?.email])

  useEffect(() => {
    const preferredId = client?.preferredAgentId
    if (!preferredId) {
      setSavedAgent(null)
      return
    }
    let active = true
    setSavedAgentLoading(true)
    getAgent(preferredId)
      .then((agent) => {
        if (active) setSavedAgent(agent)
      })
      .finally(() => {
        if (active) setSavedAgentLoading(false)
      })
    return () => {
      active = false
    }
  }, [client?.preferredAgentId, getAgent])

  const loadThreads = async () => {
    if (!user?.customerId) return
    setThreadsLoading(true)
    try {
      const res = await api.get(`/messages/customer/${user.customerId}/threads`)
      setThreads(res.data.threads || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load messages')
    } finally {
      setThreadsLoading(false)
    }
  }

  const loadThread = async (agentId) => {
    if (!user?.customerId || !agentId) return
    setThreadLoading(true)
    try {
      const res = await api.get(`/messages/customer/${user.customerId}/thread/${agentId}`)
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
    if (!activeThread?.agent?.id) {
      toast.error('Select an agent to message')
      return
    }
    setSendingReply(true)
    try {
      await api.post('/messages', { agentId: activeThread.agent.id, body: trimmed })
      setReplyBody('')
      await loadThread(activeThread.agent.id)
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
  }, [activeTab, user?.customerId])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (!threads.length) {
      setActiveThread(null)
      setThreadMessages([])
      return
    }
    const match = activeThread
      ? threads.find((thread) => thread.agent?.id === activeThread.agent?.id)
      : null
    setActiveThread(match || threads[0])
  }, [threads, activeTab])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (activeThread?.agent?.id) {
      loadThread(activeThread.agent.id)
    }
  }, [activeTab, activeThread?.agent?.id])

  useEffect(() => {
    setReplyBody('')
  }, [activeThread?.agent?.id])

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  const handleMessage = (agent) => {
    if (!user) {
      toast.error('Login to send a message')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can message agents')
      return
    }
    setMessageAgent(agent)
    setMessageOpen(true)
  }

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

  const initials = useMemo(() => {
    if (form.firstName || form.lastName) {
      return `${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`.toUpperCase() || 'CL'
    }
    if (user?.email) return user.email[0]?.toUpperCase() ?? 'CL'
    return 'CL'
  }, [form.firstName, form.lastName, user?.email])

  const displayName = form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : user?.email || 'client'
  const profileDetails = client?.profileData || {}
  const rawAddress = profileDetails.address
  const addressLine =
    form.address ||
    (typeof rawAddress === 'string' ? rawAddress : rawAddress?.street) ||
    ''
  const addressState = form.state || profileDetails.state || rawAddress?.state || ''
  const addressZip = form.zip || profileDetails.zip || rawAddress?.zip || ''
  const previewAddress =
    [addressLine, [addressState, addressZip].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '-'
  const previewName =
    [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') ||
    client?.name ||
    user?.email ||
    'Customer'
  const previewEmail = form.email || profileDetails.email || user?.email || '-'
  const previewPhone = form.phone || profileDetails.phone || profileDetails.contact?.phone || '-'
  const previewAvailability = (form.availability || profileDetails.availability || 'online').toLowerCase()
  const previewAvailabilityLabel = previewAvailability
    ? `${previewAvailability[0].toUpperCase()}${previewAvailability.slice(1)}`
    : 'Online'
  const previewStatusTone =
    previewAvailability === 'online' ? 'green' : previewAvailability === 'busy' ? 'amber' : 'gray'
  const previewPhoto = photoPreview || resolvePhotoUrl(profileDetails.photo)
  const preferredLangsList = form.preferredLangs?.trim()
    ? parseLangs(form.preferredLangs)
    : Array.isArray(client?.preferredLangs) && client.preferredLangs.length
      ? client.preferredLangs
      : parseLangs(formatLangs(profileDetails.preferredLangs || ''))
  const previewLangs = preferredLangsList.length ? preferredLangsList.join(', ') : '-'
  const previewNotes = form.notes || profileDetails.notes || profileDetails.claimsHistory || '-'

  const resetProfileForm = () => {
    if (client) {
      const nameParts = parseFullName(client?.name || '')
      const details = client?.profileData || {}
      setPhotoPreview(resolvePhotoUrl(details.photo))
      setPhotoFile(null)
      setForm({
        firstName: details.firstName || nameParts.firstName,
        middleName: details.middleName || nameParts.middleName,
        lastName: details.lastName || nameParts.lastName,
        email: details.email || user?.email || '',
        phone: details.phone || '',
        address: details.address || '',
        zip: details.zip || '',
        state: details.state || '',
        availability: details.availability || 'online',
        preferredLangs: formatLangs(details.preferredLangs || client?.preferredLangs || []),
        notes: details.notes || '',
      })
    } else {
      setPhotoPreview('')
      setPhotoFile(null)
      setForm({
        firstName: '',
        middleName: '',
        lastName: '',
        email: user?.email || '',
        phone: '',
        address: '',
        zip: '',
        state: '',
        availability: 'online',
        preferredLangs: '',
        notes: '',
      })
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    if (!user?.customerId) {
      toast.error('Customer account required')
      return
    }
    setSaving(true)
    let uploadedPhoto = ''
    if (photoFile) {
      setPhotoUploading(true)
      try {
        const data = new FormData()
        data.append('photo', photoFile)
        const res = await api.post(`/customers/${user.customerId}/photo`, data)
        uploadedPhoto = res.data?.profile?.profileData?.photo || res.data?.photo || ''
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
    const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ')
    const preferredLangs = parseLangs(form.preferredLangs)
    setClient((prev) => {
      const currentPhoto = uploadedPhoto || prev?.profileData?.photo || ''
      return {
        ...(prev || {}),
        name: fullName,
        preferredLangs,
        profileData: {
          ...(prev?.profileData || {}),
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          zip: form.zip,
          state: form.state,
          availability: form.availability,
          preferredLangs: form.preferredLangs,
          notes: form.notes,
          photo: currentPhoto,
        },
      }
    })
    toast.success('Profile saved')
    setSaving(false)
  }

  const handlePasswordSubmit = (e) => {
    e?.preventDefault()
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
    setShowPassword(false)
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Password updated locally (connect backend to persist)')
  }

  const passwordDisplay = showPassword ? lastPassword || 'Not captured this session' : '********'

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
                  activeTab === item ? 'bg-[#e8f0ff] text-[#0b3b8c] shadow-sm' : 'text-slate-700 hover:bg-slate-50'
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
              <h1 className="text-2xl font-semibold">Connsura Client Dashboard</h1>
              <p className="text-slate-500">
                Welcome back{displayName ? `, ${displayName}` : ''}. Track your policies and appointments.
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
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#006aff]/12 text-[#0b3b8c] font-bold overflow-hidden">
                {previewPhoto ? (
                  <img src={previewPhoto} alt={previewName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
            </div>
          </div>

          {loading && <Skeleton className="h-24" />}

          {!loading && activeTab === 'Overview' && (
            <div className="surface p-5">
              <h2 className="text-xl font-semibold mb-2">Overview</h2>
              <p className="text-slate-600">
                Stay on top of your insurance profile, saved agents, and upcoming appointments.
              </p>
            </div>
          )}

          {!loading && activeTab === 'Profile' && (
            <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
              <form className="surface p-4 space-y-2 max-w-md w-full" onSubmit={handleProfileSave}>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">Profile & availability</h2>
                  <Badge label="Visible to agents" tone="green" />
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center overflow-hidden border border-slate-200">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Client profile" className="h-full w-full object-cover" />
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

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block text-sm">
                    First name
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Middle name
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                      value={form.middleName}
                      onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    Last name
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
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
                    />
                  </label>
                </div>

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
                  Preferred languages
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                    value={form.preferredLangs}
                    onChange={(e) => setForm({ ...form, preferredLangs: e.target.value })}
                    placeholder="e.g., English, Spanish"
                  />
                </label>

                <label className="block text-sm">
                  Notes
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[96px]"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="pill-btn-ghost" onClick={resetProfileForm}>
                    Cancel
                  </button>
                  <button type="submit" className="pill-btn-primary px-8" disabled={saving || photoUploading}>
                    {saving || photoUploading ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>

              <div className="surface p-4 space-y-3 min-h-[420px]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">What agents see</h3>
                  <Badge label="Preview" tone="blue" />
                </div>
                <p className="text-sm text-slate-500">
                  This is the profile snapshot agents see when you share your details.
                </p>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center overflow-hidden border border-slate-200">
                      {previewPhoto ? (
                        <img src={previewPhoto} alt={previewName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-semibold">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{previewName}</div>
                      <div className="text-xs text-slate-500 truncate">{previewEmail}</div>
                      <div className="mt-2">
                        <Badge label={previewAvailabilityLabel} tone={previewStatusTone} />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600">
                    <div>
                      <span className="text-slate-500">Phone:</span> {previewPhone}
                    </div>
                    <div>
                      <span className="text-slate-500">Address:</span> {previewAddress}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                  <div className="grid gap-2 text-sm text-slate-600">
                    <div>
                      <span className="text-slate-500">Preferred languages:</span> {previewLangs}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Notes</div>
                    <p>{previewNotes}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'Forms' && (
            <div className="surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Forms</h2>
                  <p className="text-slate-600">
                    Complete your insurance profile once and securely share it with licensed agents.
                  </p>
                </div>
                <button type="button" className="pill-btn-primary px-5" onClick={() => nav('/client_forms')}>
                  Open forms workspace
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-1">
                  <div className="text-sm font-semibold text-slate-700">Start or continue</div>
                  <div className="text-sm text-slate-600">
                    Choose any line—auto, home, business—and complete the steps at your pace.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-1">
                  <div className="text-sm font-semibold text-slate-700">Share with agents</div>
                  <div className="text-sm text-slate-600">
                    Keep your details in one place and share them only with matched, licensed agents.
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'Agents' && (
            <div className="surface p-5">
              <h2 className="text-xl font-semibold mb-2">Agents</h2>
              <p className="text-slate-600">Saved and matched agents will show up here.</p>
              <div className="mt-4">
                {savedAgentLoading && <Skeleton className="h-24" />}
                {!savedAgentLoading && savedAgent && (
                  <AgentCard
                    agent={savedAgent}
                    onVoice={() => nav(`/call/voice/${savedAgent.id}`)}
                    onVideo={() => nav(`/call/video/${savedAgent.id}`)}
                    onMessage={handleMessage}
                  />
                )}
                {!savedAgentLoading && !savedAgent && (
                  <div className="text-sm text-slate-500">No saved agents yet.</div>
                )}
              </div>
            </div>
          )}

          {!loading && activeTab === 'Messages' && (
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
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agents</div>
                  {threadsLoading && <Skeleton className="h-20" />}
                  {!threadsLoading && threads.length === 0 && (
                    <div className="text-sm text-slate-500">No messages yet.</div>
                  )}
                  {!threadsLoading && threads.length > 0 && (
                    <div className="space-y-2">
                      {threads.map((thread) => {
                        const agentLabel = thread.agent?.name || thread.agent?.email || 'Agent'
                        const previewPrefix = thread.lastMessage?.senderRole === 'CUSTOMER' ? 'You: ' : ''
                        const preview = `${previewPrefix}${thread.lastMessage?.body || ''}`.trim()
                        const isActive = activeThread?.agent?.id === thread.agent?.id
                        return (
                          <button
                            key={thread.agent.id}
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
                                <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 grid place-items-center font-semibold overflow-hidden">
                                  {thread.agent?.photo ? (
                                    <img src={thread.agent.photo} alt={agentLabel} className="h-full w-full object-cover" />
                                  ) : (
                                    getInitials(agentLabel)
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">{agentLabel}</div>
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
                    <div className="text-sm text-slate-500">Select an agent to start chatting.</div>
                  )}
                  {activeThread && (
                    <>
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {activeThread.agent?.name || activeThread.agent?.email || 'Agent'}
                          </div>
                          {activeThread.agent?.email && (
                            <div className="text-xs text-slate-500">{activeThread.agent.email}</div>
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
                            const isCustomer = message.senderRole === 'CUSTOMER'
                            return (
                              <div
                                key={message.id}
                                className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                                    isCustomer
                                      ? 'bg-[#0b3b8c] text-white'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {message.body}
                                  <div
                                    className={`mt-1 text-[11px] ${
                                      isCustomer ? 'text-white/70' : 'text-slate-400'
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
                          placeholder="Write a message..."
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
          )}

          {!loading && activeTab === 'Appointments' && (
            <div className="surface p-5">
              <h2 className="text-xl font-semibold mb-2">Appointments</h2>
              <p className="text-slate-600">Track your upcoming calls and meetings.</p>
            </div>
          )}

          {!loading && activeTab === 'Settings' && (
            <div className="surface p-4 space-y-2 max-w-md w-full">
              <h2 className="text-xl font-semibold">Settings</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="text-sm text-slate-500">Email</div>
                  <div className="font-semibold">{form.email || 'Not set'}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="text-sm text-slate-500">Name</div>
                  <div className="font-semibold">
                    {[form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || 'Not set'}
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                Manage notifications and account preferences (coming soon).
              </div>

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
                    <div className="font-semibold">{passwordDisplay}</div>
                  </div>
                  <button
                    type="button"
                    className="pill-btn-ghost text-sm px-4"
                    onClick={() => setChangingPassword((v) => !v)}
                  >
                    {changingPassword ? 'Cancel' : 'Change password'}
                  </button>
                </div>

                {changingPassword && (
                  <div className="space-y-2">
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
                      <button
                        type="button"
                        className="pill-btn-ghost"
                        onClick={() => {
                          setChangingPassword(false)
                          setNewPassword('')
                          setConfirmPassword('')
                        }}
                      >
                        Cancel
                      </button>
                      <button type="button" className="pill-btn-primary px-5" onClick={handlePasswordSubmit}>
                        Save password
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <MessageAgentModal open={messageOpen} agent={messageAgent} onClose={() => setMessageOpen(false)} />
    </main>
  )
}
