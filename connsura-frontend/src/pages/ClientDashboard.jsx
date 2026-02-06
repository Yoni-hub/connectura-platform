import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { API_URL, api } from '../services/api'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import AgentCard from '../components/agents/AgentCard'
import ShareProfileModal from '../components/modals/ShareProfileModal'
import ReviewShareEditsModal from '../components/modals/ReviewShareEditsModal'
import RateAgentModal from '../components/modals/RateAgentModal'
import AuthenticatorPanel from '../components/settings/AuthenticatorPanel'
import ShareSummary from '../components/share/ShareSummary'
import Modal from '../components/ui/Modal'
import CreateProfile from './CreateProfile'

const navItems = ['Overview', 'My Insurance Passport', 'Forms', 'Agents', 'Messages', 'Settings']

const resolveTabFromSearch = (search = '') => {
  const params = new URLSearchParams(search)
  const value = params.get('tab')
  if (!value) return 'Overview'
  const match = navItems.find((item) => item.toLowerCase() === value.toLowerCase())
  return match || 'Overview'
}

const parseFullName = (fullName = '') => {
  const parts = fullName.trim().split(' ').filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : parts[1] || ''
  return { firstName, middleName, lastName }
}

const formatTimestamp = (value) => (value ? new Date(value).toLocaleString() : '')
const reminderLinkClass =
  'inline-flex text-sm font-semibold text-[#0b3b8c] hover:underline disabled:text-slate-400 disabled:hover:no-underline'

const getInitials = (name = '', fallback = 'AG') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return fallback
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const resolvePhotoUrl = (value = '') => {
  if (!value) return ''
  if (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return value
  return `${API_URL}${value}`
}

const hasNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.some(hasNonEmptyValue)
  if (typeof value === 'object') return Object.values(value).some(hasNonEmptyValue)
  return false
}

const safeArray = (value) => (Array.isArray(value) ? value : [])

const householdDetailFields = [
  { key: 'dob', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'marital-status', label: 'Marital Status' },
  { key: 'education-level', label: 'Education Level' },
  { key: 'employment', label: 'Employment' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'driver-status', label: 'Driver Status' },
  { key: 'license-type', label: "Driver's License Type" },
  { key: 'license-status', label: 'License Status' },
  { key: 'years-licensed', label: 'Years Licensed' },
  { key: 'license-state', label: 'License State' },
  { key: 'license-number', label: 'License Number' },
  { key: 'accident-prevention', label: 'Accident Prevention Course' },
  { key: 'sr22', label: 'SR-22 Required?' },
  { key: 'fr44', label: 'FR-44 Required?' },
]

const addressDetailFields = [
  { key: 'address1', label: 'Street Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip Code' },
]

const buildHouseholdDetails = (person = {}) => {
  const details = []
  if (hasNonEmptyValue(person?.relation)) {
    details.push({ label: 'Relation to Applicant', value: person.relation })
  }
  householdDetailFields.forEach((field) => {
    const value = person?.[field.key]
    if (hasNonEmptyValue(value)) {
      details.push({ label: field.label, value })
    }
  })
  return details
}

const buildAddressDetails = (residentialEntry = {}) => {
  const details = []
  addressDetailFields.forEach((field) => {
    const value = residentialEntry?.[field.key]
    if (hasNonEmptyValue(value)) {
      details.push({ label: field.label, value })
    }
  })
  return details
}

const getAdditionalAddressLabel = (entry = {}, index = 0) => {
  const rawType = entry?.addressType || entry?.residential?.addressType || ''
  const type = rawType ? rawType.trim() : ''
  return type || `Additional Address ${index + 1}`
}

const buildPersonName = (person = {}) => {
  const nameParts = [person['first-name'] || person.firstName, person['middle-initial'] || person.middleInitial, person['last-name'] || person.lastName]
    .filter(Boolean)
  const baseName = nameParts.join(' ')
  if (!person?.suffix) {
    return baseName
  }
  return baseName ? `${baseName}, ${person.suffix}` : person.suffix
}

const formatCountLabel = (count, singular, plural) => {
  if (count === 1) return `1 ${singular}`
  return `${count} ${plural || `${singular}s`}`
}

const resolveDetail = (detail, hasData, emptyText, filledText) => {
  if (!hasData) return emptyText
  return detail || filledText
}

const resolveFormsSectionKey = (value = '') => {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('summary')) return 'summary'
  if (normalized.includes('additional')) return 'additional'
  if (normalized.includes('address')) return 'address'
  if (normalized.includes('household')) return 'household'
  return ''
}

const DEFAULT_NOTIFICATION_PREFS = {
  email: 'all',
  inapp: true,
  loginAlerts: true,
  groups: {
    messages: true,
    passport: true,
    system: true,
  },
}

const normalizeNotificationPrefs = (value = {}) => {
  const prefs = value && typeof value === 'object' ? value : {}
  const groups = prefs.groups && typeof prefs.groups === 'object' ? prefs.groups : {}
  const email = ['all', 'important', 'none'].includes(prefs.email) ? prefs.email : 'all'
  return {
    email,
    inapp: typeof prefs.inapp === 'boolean' ? prefs.inapp : true,
    loginAlerts: true,
    groups: {
      messages: typeof groups.messages === 'boolean' ? groups.messages : true,
      passport: typeof groups.passport === 'boolean' ? groups.passport : true,
      system: typeof groups.system === 'boolean' ? groups.system : true,
    },
  }
}

const getSessionId = () => {
  if (typeof window === 'undefined') return 'server'
  const key = 'connsura_session_id'
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(key, value)
  }
  return value
}

export default function ClientDashboard() {
  const { user, lastPassword, setLastPassword, logout, setUser, completeAuth } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const focusAgentId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const value = Number(params.get('agent'))
    return Number.isFinite(value) && value > 0 ? value : null
  }, [location.search])
  const [activeTab, setActiveTab] = useState(() => resolveTabFromSearch(window.location.search))
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareSnapshot, setShareSnapshot] = useState(null)
  const [formsDraft, setFormsDraft] = useState(null)
  const [formsStarting, setFormsStarting] = useState(false)
  const [formsStartSection, setFormsStartSection] = useState(null)
  const [formsStartKey, setFormsStartKey] = useState(0)
  const [, setFormsSaving] = useState(false)
  const [pendingShares, setPendingShares] = useState([])
  const [activeShares, setActiveShares] = useState([])
  const [revokingShare, setRevokingShare] = useState('')
  const [reviewShare, setReviewShare] = useState(null)
  const formsSaveRef = useRef(null)
  const autoReviewRef = useRef('')
  const tabLogRef = useRef('')
  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [savedAgents, setSavedAgents] = useState([])
  const [savedAgentsLoading, setSavedAgentsLoading] = useState(false)
  const [savedAgentIdOverrides, setSavedAgentIdOverrides] = useState([])
  const [focusAgent, setFocusAgent] = useState(null)
  const [focusAgentLoading, setFocusAgentLoading] = useState(false)
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [rateAgent, setRateAgent] = useState(null)
  const [settingsModal, setSettingsModal] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordUpdating, setPasswordUpdating] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nameEditing, setNameEditing] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMessage, setNameMessage] = useState(null)
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)
  const [emailDraft, setEmailDraft] = useState(user?.email || '')
  const [languageDraft, setLanguageDraft] = useState('')
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [preferencesMessage, setPreferencesMessage] = useState('')
  const [loginActivity, setLoginActivity] = useState([])
  const [loginActivityLoading, setLoginActivityLoading] = useState(false)
  const [loginActivityOpen, setLoginActivityOpen] = useState(false)
  const [loginActivityPage, setLoginActivityPage] = useState(1)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsMessage, setSessionsMessage] = useState(null)
  const [sharedActivity, setSharedActivity] = useState([])
  const [sharedActivityLoading, setSharedActivityLoading] = useState(false)
  const [sharedActivityOpen, setSharedActivityOpen] = useState(false)
  const [sharedActivityPage, setSharedActivityPage] = useState(1)
  const [consentHistory, setConsentHistory] = useState([])
  const [consentLoading, setConsentLoading] = useState(false)
  const [consentHistoryOpen, setConsentHistoryOpen] = useState(false)
  const [consentHistoryPage, setConsentHistoryPage] = useState(1)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivatePassword, setDeactivatePassword] = useState('')
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateMessage, setDeactivateMessage] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState(null)
  const [notificationPrefs, setNotificationPrefs] = useState(null)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const notificationSaveRef = useRef(0)
  const [cookiePref, setCookiePref] = useState('all')
  const [cookieSaving, setCookieSaving] = useState(false)
  const [cookieMessage, setCookieMessage] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationSending, setVerificationSending] = useState(false)
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [verificationConfirming, setVerificationConfirming] = useState(false)
  const [verificationPurpose, setVerificationPurpose] = useState('email')
  const [pendingNameChange, setPendingNameChange] = useState(null)
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: user?.email || '',
  })
  const sessionId = useMemo(() => getSessionId(), [])

  useEffect(() => {
    const nextTab = resolveTabFromSearch(location.search)
    setActiveTab(nextTab)
  }, [location.search])

  useEffect(() => {
    if (user?.email) {
      setEmailDraft(user.email)
    }
  }, [user?.email])

  useEffect(() => {
    if (!user?.email) return
    setForm((prev) => ({ ...prev, email: user.email }))
  }, [user?.email])

  useEffect(() => {
    if (!client?.profileData) return
    setLanguageDraft(client.profileData.language || '')
    if (client.profileData.cookie_preference) {
      setCookiePref(client.profileData.cookie_preference)
    }
  }, [
    client?.profileData?.language,
    client?.profileData?.cookie_preference,
  ])

  useEffect(() => {
    if (emailEditing) return
    setEmailDraft(user?.emailPending || user?.email || '')
  }, [user?.emailPending, user?.email, emailEditing])


  const updateTab = (nextTab) => {
    setActiveTab(nextTab)
    const params = new URLSearchParams(location.search)
    params.set('tab', nextTab.toLowerCase())
    nav(`/client/dashboard?${params.toString()}`, { replace: true })
  }

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
      const photoValue = details.photo || ''
      setPhotoPreview(resolvePhotoUrl(photoValue))
      setPhotoFile(null)
      setForm({
        firstName: details.firstName || nameParts.firstName,
        middleName: details.middleName || nameParts.middleName,
        lastName: details.lastName || nameParts.lastName,
        email: details.email || user?.email || '',
      })
      setEmailDraft(details.email || user?.email || '')
      setLanguageDraft(details.language || '')
    } catch {
      setClient(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [user?.customerId, user?.email])

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

  const loadSavedAgents = async () => {
    if (!user?.customerId) return
    setSavedAgentsLoading(true)
    try {
      const res = await api.get(`/customers/${user.customerId}/saved-agents`)
      setSavedAgents(res.data.agents || [])
      setSavedAgentIdOverrides([])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load saved agents')
    } finally {
      setSavedAgentsLoading(false)
    }
  }

  const loadPendingShares = async () => {
    if (!user?.customerId) return
    try {
      const res = await api.get('/shares/pending')
      setPendingShares(res.data.shares || [])
    } catch (err) {
      if (err.response?.status !== 404) {
        console.warn('Failed to load pending share edits', err)
      }
    }
  }

  const loadActiveShares = async () => {
    if (!user?.customerId) return
    try {
      const res = await api.get('/shares/active')
      setActiveShares(res.data.shares || [])
    } catch (err) {
      if (err.response?.status !== 404) {
        console.warn('Failed to load active shares', err)
      }
    }
  }

  const loadThread = async (agentId) => {
    if (!user?.customerId || !agentId) return
    setThreadLoading(true)
    try {
      const res = await api.get(`/messages/customer/${user.customerId}/thread/${agentId}`)
      setThreadMessages(res.data.messages || [])
      setThreads((prev) =>
        prev.map((thread) => (thread.agent?.id === agentId ? { ...thread, unreadCount: 0 } : thread))
      )
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

  const handleRemoveAgent = async (agentId) => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return
    }
    const confirmed = window.confirm(
      'Remove this agent? All messages with this agent will also be deleted.'
    )
    if (!confirmed) return
    try {
      await api.delete(`/customers/${user.customerId}/saved-agents/${agentId}`)
      await api.delete(`/messages/customer/${user.customerId}/thread/${agentId}`)
      toast.success('Agent removed')
      await loadSavedAgents()
      await loadThreads()
      if (activeThread?.agent?.id === agentId) {
        setActiveThread(null)
        setThreadMessages([])
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove agent')
    }
  }

  const handleSaveAgent = async (agent) => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return
    }
    const agentId = agent?.id
    if (!agentId) {
      toast.error('Agent not found')
      return
    }
    if (savedAgentIds.has(agentId)) {
      return
    }
    setSavedAgentIdOverrides((prev) => (prev.includes(agentId) ? prev : [...prev, agentId]))
    try {
      await api.post(`/customers/${user.customerId}/saved-agents`, { agentId })
      toast.success('Agent saved')
      await loadSavedAgents()
    } catch (err) {
      setSavedAgentIdOverrides((prev) => prev.filter((id) => id !== agentId))
      toast.error(err.response?.data?.error || 'Failed to save agent')
    }
  }

  const handleMessageAgent = (agent) => {
    if (!user) {
      toast.error('Login to send a message')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can message agents')
      return
    }
    nav(`/client/dashboard?tab=messages&agent=${agent.id}`)
  }

  const handleRateAgent = (agent) => {
    if (!user) {
      toast.error('Login to rate an agent')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can rate agents')
      return
    }
    setRateAgent(agent)
    setRateOpen(true)
  }

  const handleRemoveAgentCard = (agent) => {
    handleRemoveAgent(agent.id)
  }

  const handleViewProfile = (agent) => {
    if (!agent?.id) return
    nav(`/agents/${agent.id}`)
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
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    const previewUrl = URL.createObjectURL(file)
    setPhotoFile(file)
    setPhotoPreview(previewUrl)
    handlePhotoUpload(file, previewUrl)
  }

  const handlePhotoReset = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    const existing = client?.profileData?.photo || ''
    setPhotoPreview(resolvePhotoUrl(existing))
  }

  const handlePhotoUpload = async (fileOverride, previewOverride) => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return
    }
    const uploadFile = fileOverride || photoFile
    if (!uploadFile) {
      toast.error('Select a photo to upload')
      return
    }
    if (photoUploading) return
    setPhotoUploading(true)
    try {
      const data = new FormData()
      data.append('photo', uploadFile)
      data.append('sessionId', sessionId)
      const res = await api.post(`/customers/${user.customerId}/photo`, data)
      const updatedProfile = res.data?.profile
      if (updatedProfile) {
        setClient(updatedProfile)
      }
      const updatedPhoto = updatedProfile?.profileData?.photo || res.data?.photo || ''
      setPhotoPreview(resolvePhotoUrl(updatedPhoto))
      setPhotoFile(null)
      toast.success('Profile photo updated')
    } catch (err) {
      if (previewOverride && previewOverride.startsWith('blob:')) {
        URL.revokeObjectURL(previewOverride)
      }
      handlePhotoReset()
      toast.error(err.response?.data?.error || 'Photo upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handlePhotoRemove = async () => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return
    }
    if (photoUploading) return
    setPhotoUploading(true)
    try {
      const res = await api.post(`/customers/${user.customerId}/photo/remove`, { sessionId })
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      setPhotoPreview('')
      setPhotoFile(null)
      toast.success('Profile photo removed')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove photo')
    } finally {
      setPhotoUploading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'Messages') return
    loadThreads()
    loadSavedAgents()
  }, [activeTab, user?.customerId])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (!focusAgentId) {
      setFocusAgent(null)
      setFocusAgentLoading(false)
      return
    }
    if (focusAgent?.id === focusAgentId) return
    if (threads.some((thread) => thread.agent?.id === focusAgentId)) {
      setFocusAgent(null)
      return
    }
    if (savedAgents.some((agent) => agent.id === focusAgentId)) {
      setFocusAgent(null)
      return
    }
    let isActive = true
    const loadFocusAgent = async () => {
      setFocusAgentLoading(true)
      try {
        const res = await api.get(`/agents/${focusAgentId}`)
        if (!isActive) return
        setFocusAgent(res.data?.agent || null)
      } catch {
        if (!isActive) return
        setFocusAgent(null)
      } finally {
        if (isActive) {
          setFocusAgentLoading(false)
        }
      }
    }
    loadFocusAgent()
    return () => {
      isActive = false
    }
  }, [activeTab, focusAgentId, focusAgent?.id, threads, savedAgents])

  useEffect(() => {
    if (!user?.customerId) return
    loadThreads()
    loadSavedAgents()
    const interval = setInterval(() => {
      loadThreads()
    }, 12000)
    return () => clearInterval(interval)
  }, [user?.customerId])

  useEffect(() => {
    loadPendingShares()
  }, [user?.customerId])

  useEffect(() => {
    loadActiveShares()
  }, [user?.customerId])

  useEffect(() => {
    if (!user?.customerId) return
    const pendingInterval = setInterval(() => {
      loadPendingShares()
    }, 2000)
    const activeInterval = setInterval(() => {
      loadActiveShares()
    }, 20000)
    return () => {
      clearInterval(pendingInterval)
      clearInterval(activeInterval)
    }
  }, [user?.customerId])

  useEffect(() => {
    if (reviewShare || pendingShares.length === 0) return
    const nextShare = pendingShares[0]
    const key = `${nextShare?.token || ''}-${nextShare?.pendingAt || ''}`
    if (autoReviewRef.current === key) return
    autoReviewRef.current = key
    setReviewShare(nextShare)
  }, [pendingShares, reviewShare])

  useEffect(() => {
    if (activeTab !== 'Settings') return
    if (!user?.customerId) return
    let isActive = true
    setNotificationMessage('')
    setNotificationLoading(true)
    api
      .get(`/customers/${user.customerId}/notification-preferences`, {
        params: { sessionId },
      })
      .then((res) => {
        if (!isActive) return
        setNotificationPrefs(normalizeNotificationPrefs(res.data?.preferences || {}))
      })
      .catch((err) => {
        if (!isActive) return
        toast.error(err.response?.data?.error || 'Could not load notification preferences')
        setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS)
      })
      .finally(() => {
        if (isActive) setNotificationLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [activeTab, user?.customerId, sessionId])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (!threads.length) {
      if (!focusAgentId) {
        setActiveThread(null)
        setThreadMessages([])
      }
      return
    }
    if (focusAgentId) return
    if (activeThread?.agent?.id) {
      const match = threads.find((thread) => thread.agent?.id === activeThread.agent?.id)
      if (match) {
        setActiveThread(match)
      }
    }
  }, [threads, activeTab, activeThread, focusAgentId])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (focusAgentId) return
    setActiveThread(null)
    setThreadMessages([])
  }, [activeTab, focusAgentId])

  useEffect(() => {
    if (activeTab !== 'Messages') return
    if (!focusAgentId) return
    const match = threads.find((thread) => thread.agent?.id === focusAgentId)
    if (match) {
      setActiveThread(match)
      return
    }
    const savedMatch = savedAgents.find((agent) => agent.id === focusAgentId)
    if (savedMatch) {
      setActiveThread({ agent: savedMatch, lastMessage: null, unreadCount: 0 })
      setThreadMessages([])
      return
    }
    if (focusAgent) {
      setActiveThread({ agent: focusAgent, lastMessage: null, unreadCount: 0 })
      setThreadMessages([])
    }
  }, [activeTab, focusAgentId, threads, savedAgents, focusAgent])

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

  useEffect(() => {
    if (!user?.customerId || !formsDraft) return
    if (formsSaveRef.current) {
      clearTimeout(formsSaveRef.current)
    }
    const payload = formsDraft
    formsSaveRef.current = setTimeout(async () => {
      setFormsSaving(true)
      try {
        const res = await api.patch(`/customers/${user.customerId}/profile-data`, {
          profileData: { forms: payload },
        })
        setClient((prev) =>
          prev ? { ...prev, profileData: res.data.profile?.profileData || prev.profileData } : prev
        )
      } catch (err) {
        toast.error(err.response?.data?.error || 'Unable to save profile changes')
      } finally {
        setFormsSaving(false)
      }
    }, 800)
    return () => {
      if (formsSaveRef.current) clearTimeout(formsSaveRef.current)
    }
  }, [formsDraft, user?.customerId])

  const isEmailVerified = user?.emailVerified === true
  const hasPendingEmail = Boolean(user?.emailPending)
  const needsAuthenticator = Boolean(user) && !user.totpEnabled
  const needsEmailVerification = Boolean(user) && !isEmailVerified
  const verificationTargetEmail =
    verificationPurpose === 'name' ? user?.email || '' : user?.emailPending || user?.email || ''
  const verificationTitle = verificationPurpose === 'name' ? 'Verify name change' : 'Verify email'
  const verificationConfirmLabel =
    verificationPurpose === 'name' ? 'Verify name change' : 'Verify email'
  const formsStarted = Boolean(client?.profileData?.forms_started)
  const formsCompleted = client?.profileData?.profile_status === 'completed'
  const formsCurrentSection = useMemo(
    () => (activeTab === 'Forms' ? client?.profileData?.current_section || '' : ''),
    [activeTab, client?.profileData?.current_section]
  )
  const formsSectionKey = useMemo(
    () => resolveFormsSectionKey(client?.profileData?.current_section),
    [client?.profileData?.current_section]
  )
  useEffect(() => {
    if (!user?.customerId || !activeTab) return
    if (activeTab === 'Agents' && savedAgentsLoading) return
    if (tabLogRef.current === activeTab) return
    tabLogRef.current = activeTab
    const profileStatus = formsCompleted ? 'completed' : formsStarted ? 'draft' : 'none'
    api.post(`/customers/${user.customerId}/tab-view`, {
      tabName: activeTab,
      sessionId,
      profileStatus,
      currentSection: activeTab === 'Forms' ? formsCurrentSection || null : null,
      savedAgentsCount: activeTab === 'Agents' ? savedAgents.length : null,
    }).catch(() => {})
  }, [
    activeTab,
    user?.customerId,
    formsCompleted,
    formsStarted,
    sessionId,
    formsCurrentSection,
    savedAgents.length,
    savedAgentsLoading,
  ])
  const displayName = client?.name || user?.name || user?.email || 'client'
  const savedAgentIds = useMemo(() => {
    const ids = new Set(savedAgents.map((agent) => agent.id))
    savedAgentIdOverrides.forEach((id) => ids.add(id))
    return ids
  }, [savedAgents, savedAgentIdOverrides])
  const totalUnread = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0),
    [threads]
  )
  const hasAgentReply = useMemo(
    () => threads.some((thread) => thread.lastMessage?.senderRole === 'AGENT'),
    [threads]
  )
  const waitingOnAgentReply = useMemo(
    () => threads.some((thread) => thread.lastMessage?.senderRole === 'CUSTOMER'),
    [threads]
  )
  const displayThreads = useMemo(() => {
    if (!focusAgent) return threads
    if (threads.some((thread) => thread.agent?.id === focusAgent.id)) return threads
    return [{ agent: focusAgent, lastMessage: null, unreadCount: 0 }, ...threads]
  }, [threads, focusAgent])
  const passportForms = formsDraft || client?.profileData?.forms || {}
  const householdForms = passportForms.household || {}
  const namedInsured = householdForms.namedInsured || {}
  const additionalHouseholds = safeArray(householdForms.additionalHouseholds)
  const additionalHouseholdCount = additionalHouseholds.filter(hasNonEmptyValue).length
  const primaryHouseholdFilled = hasNonEmptyValue(namedInsured)
  const householdCount = (primaryHouseholdFilled ? 1 : 0) + additionalHouseholdCount
  const primaryHouseholdName = buildPersonName(namedInsured)
  const householdDetail = resolveDetail(
    primaryHouseholdName ? `Primary: ${primaryHouseholdName}` : '',
    householdCount > 0,
    'Add household details in Forms.',
    'Household details saved.'
  )

  const addressForms = passportForms.address || {}
  const contacts = safeArray(addressForms.contacts)
  const primaryContact = contacts[0] || {}
  const residential = addressForms.residential || {}
  const mailing = addressForms.mailing || {}
  const additionalAddresses = safeArray(addressForms.additionalAddresses)
  const primaryAddressFilled =
    hasNonEmptyValue(primaryContact) || hasNonEmptyValue(residential) || hasNonEmptyValue(mailing)
  const additionalAddressCount = additionalAddresses.filter(hasNonEmptyValue).length
  const addressCount = (primaryAddressFilled ? 1 : 0) + additionalAddressCount
  const primaryAddressLine = [residential.address1, residential.city, residential.state, residential.zip]
    .filter(Boolean)
    .join(', ')
  const addressDetail = resolveDetail(
    primaryAddressLine,
    addressCount > 0,
    'Add address details in Forms.',
    'Address details saved.'
  )

  const additionalForms = safeArray(passportForms.additional?.additionalForms)
  const additionalNames = additionalForms
    .map((form) => form?.name || form?.productName)
    .filter(Boolean)
  const additionalCount = additionalForms.filter((form) =>
    hasNonEmptyValue(form?.questions) || hasNonEmptyValue(form?.name) || hasNonEmptyValue(form?.productName)
  ).length
  const additionalDetail = resolveDetail(
    additionalNames.length
      ? `${additionalNames.slice(0, 2).join(', ')}${
          additionalNames.length > 2 ? ` +${additionalNames.length - 2} more` : ''
        }`
      : '',
    additionalCount > 0,
    'Add custom forms in Forms.',
    'Custom forms saved.'
  )

  const passportSections = [
    {
      id: 'household',
      label: 'Household',
      count: householdCount,
      singular: 'member',
      detail: householdDetail,
    },
    {
      id: 'address',
      label: 'Address',
      count: addressCount,
      singular: 'address',
      plural: 'addresses',
      detail: addressDetail,
    },
    {
      id: 'additional',
      label: 'Additional Forms',
      count: additionalCount,
      singular: 'form',
      detail: additionalDetail,
    },
  ]
  const passportCompletedCount = passportSections.filter((section) => section.count > 0).length
  const passportHasData = passportCompletedCount > 0
  const passportStatus = !passportHasData ? 'Not started' : formsCompleted ? 'Completed' : 'In progress'
  const passportShareSections = {
    household: householdCount > 0,
    address: addressCount > 0,
    additional: additionalCount > 0,
  }
  const passportSnapshotFallback = useMemo(() => {
    const primaryLabel = namedInsured?.relation ? namedInsured.relation : 'Primary Applicant'
    const primary = {
      label: primaryLabel,
      fullName: buildPersonName(namedInsured),
      details: buildHouseholdDetails(namedInsured),
    }
    const additional = additionalHouseholds
      .filter(hasNonEmptyValue)
      .map((person) => ({
        label: person?.relation || 'Additional Household Member',
        fullName: buildPersonName(person),
        details: buildHouseholdDetails(person),
      }))
    const primaryAddress = {
      label: 'Primary Address',
      street1: residential?.address1 || '',
      details: buildAddressDetails(residential),
    }
    const additionalAddressSnapshots = additionalAddresses
      .filter(hasNonEmptyValue)
      .map((entry, index) => ({
        label: getAdditionalAddressLabel(entry, index),
        street1: entry?.residential?.address1 || '',
        details: buildAddressDetails(entry?.residential || {}),
      }))
    const additionalFormSnapshots = additionalForms
      .map((form) => ({
        name: form?.name || form?.productName || '',
        questions: (form?.questions || [])
          .filter((question) => hasNonEmptyValue(question?.input))
          .map((question) => ({
            question: question?.question || '',
            input: question?.input || '',
          })),
      }))
      .filter((form) => form.questions.length > 0)
    return {
      household: { primary, additional },
      address: { primary: primaryAddress, additional: additionalAddressSnapshots },
      additionalForms: additionalFormSnapshots,
      forms: passportForms,
    }
  }, [
    additionalAddresses,
    additionalForms,
    additionalHouseholds,
    contacts,
    namedInsured,
    passportForms,
    residential,
  ])
  const resolvedShareSnapshot = shareSnapshot ?? passportSnapshotFallback

  const requestEmailVerification = async () => {
    if (!user?.email) {
      toast.error('Email not available for verification')
      return
    }
    setVerificationPurpose('email')
    setVerificationSending(true)
    setVerificationError('')
    try {
      const res = await api.post('/auth/email-otp/request', { sessionId })
      if (res.data?.verified) {
        setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev))
        toast.success('Email already verified')
        return
      }
      const delivery = res.data?.delivery
      setVerificationSent(true)
      setVerificationCode('')
      setVerificationOpen(true)
      toast.success(delivery === 'log' ? 'Verification email generated. Check the server logs.' : 'Verification email sent.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send verification code')
    } finally {
      setVerificationSending(false)
    }
  }

  const requestNameChangeVerification = async () => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return
    }
    if (!pendingNameChange?.firstName || !pendingNameChange?.lastName) {
      toast.error('Name change details not available')
      return
    }
    setVerificationPurpose('name')
    setVerificationSending(true)
    setVerificationError('')
    try {
      const res = await api.post(`/customers/${user.customerId}/name-change/request`, {
        ...pendingNameChange,
        sessionId,
      })
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      setVerificationSent(true)
      setVerificationCode('')
      setVerificationOpen(true)
      toast.success('Verification email sent.')
    } catch (err) {
      const message = err.response?.data?.error || 'Could not send verification code'
      setVerificationError(message)
      toast.error(message)
    } finally {
      setVerificationSending(false)
    }
  }

  const handleVerifyCodeConfirm = async () => {
    const trimmed = verificationCode.trim()
    if (!trimmed) {
      setVerificationError('Enter the code from your email.')
      return
    }
    if (verificationConfirming) return
    if (verificationPurpose === 'name' && !user?.customerId) {
      setVerificationError('Customer profile not found.')
      return
    }
    setVerificationConfirming(true)
    setVerificationError('')
    try {
      if (verificationPurpose === 'name') {
        const res = await api.post(`/customers/${user.customerId}/name-change/confirm`, {
          code: trimmed,
          sessionId,
        })
        if (res.data?.profile) {
          setClient(res.data.profile)
          setUser((prev) =>
            prev ? { ...prev, name: res.data.profile?.name || prev.name } : prev
          )
        }
        setPendingNameChange(null)
        setVerificationOpen(false)
        setVerificationPurpose('email')
        setNameMessage({
          type: 'success',
          text: 'Name changed successfully. Name changes can only be done once in 24 hours.',
        })
      } else {
        const res = await api.post('/auth/email-otp/confirm', { code: trimmed, sessionId })
        if (res.data?.user) {
          setUser(res.data.user)
          setEmailDraft(res.data.user.email || '')
        } else {
          setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev))
        }
        setVerificationOpen(false)
        toast.success('Email verified')
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Verification failed'
      setVerificationError(message)
      toast.error(message)
    } finally {
      setVerificationConfirming(false)
    }
  }

  const handleShareClick = () => {
    if (!isEmailVerified) {
      toast.error('Verify your email to share your profile')
      return
    }
    setShareOpen(true)
  }

  const openFormsFlow = () => {
    setFormsStartSection('household')
    setFormsStartKey((prev) => prev + 1)
    nav('/client/dashboard?tab=forms', { replace: false })
  }

  const openFormsSection = (sectionId) => {
    if (!sectionId) return
    setFormsStartSection(sectionId)
    setFormsStartKey((prev) => prev + 1)
  }

  const handleStartForms = async () => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return
    }
    if (formsStarting) return
    setFormsStarting(true)
    try {
      const res = await api.post(`/customers/${user.customerId}/forms/start`)
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      setFormsStartSection('household')
      setFormsStartKey((prev) => prev + 1)
      setTimeout(() => {
        nav('/client/dashboard?tab=forms', { replace: false })
        setFormsStarting(false)
      }, 200)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to start forms')
      setFormsStarting(false)
    }
  }

  const handleContinueForms = () => {
    const nextSection = formsSectionKey || 'household'
    setFormsStartSection(nextSection)
    setFormsStartKey((prev) => prev + 1)
    nav('/client/dashboard?tab=forms', { replace: false })
  }

  const handleCancelForms = () => {
    const confirmed = window.confirm('Return to Overview? Your progress is saved.')
    if (!confirmed) return
    updateTab('Overview')
  }

  const handleTalkToAgent = async () => {
    if (user?.customerId) {
      try {
        await api.post(`/customers/${user.customerId}/agent-search/click`)
      } catch (err) {
        console.warn('Unable to log agent search click', err)
      }
    }
    nav('/agents')
  }

  const handleSectionSave = async ({ section, nextSection, forms, profileStatus, logClick }) => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return { success: false }
    }
    try {
      const res = await api.post(`/customers/${user.customerId}/forms/section-save`, {
        section,
        nextSection,
        profileStatus,
        logClick,
        profileData: {
          profile_status: profileStatus || 'draft',
          current_section: nextSection,
          forms_started: true,
          forms,
        },
      })
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      if (forms) {
        setFormsDraft(forms)
      }
      return { success: true }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save forms section')
      return { success: false }
    }
  }

  const handleApproveEdits = async (token) => {
    if (!token) return
    try {
      await api.post(`/shares/${token}/approve`)
      toast.success('Changes approved')
      setReviewShare(null)
      await fetchProfile()
      await loadPendingShares()
      await loadActiveShares()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to approve changes')
    }
  }

  const handleDeclineEdits = async (token) => {
    if (!token) return
    try {
      await api.post(`/shares/${token}/decline`)
      toast.success('Sharing stopped')
      setReviewShare(null)
      await loadPendingShares()
      await loadActiveShares()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to decline changes')
    }
  }

  const handleStopSharing = async (token) => {
    if (!token) return
    setRevokingShare(token)
    try {
      await api.post(`/shares/${token}/revoke`)
      toast.success('Sharing stopped')
      await loadActiveShares()
      await loadPendingShares()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to stop sharing')
    } finally {
      setRevokingShare('')
    }
  }

  const handlePasswordSubmit = async (e) => {
    e?.preventDefault()
    setPasswordMessage(null)
    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Enter your current password.' })
      return
    }
    if (!newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Enter and confirm your new password.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setPasswordUpdating(true)
    try {
      const res = await api.post('/auth/password', {
        currentPassword,
        newPassword,
        sessionId,
      })
      if (res.data?.token && completeAuth) {
        const persist = typeof window !== 'undefined' && localStorage.getItem('connsura_token')
        completeAuth(res.data.token, res.data.user || user, newPassword, { persist: Boolean(persist) })
      } else {
        if (res.data?.user) {
          setUser(res.data.user)
        }
        setLastPassword(newPassword)
      }
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({
        type: 'success',
        text: "Password updated. If you didn't do this, contact us immediately.",
      })
      await logInappNotice('password_changed')
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update password.',
      })
    } finally {
      setPasswordUpdating(false)
    }
  }

  const handleNameSave = async () => {
    if (!user?.customerId) {
      setNameMessage({ type: 'error', text: 'Customer profile not found.' })
      return
    }
    if (nameSaving) return
    const payload = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim(),
      lastName: form.lastName.trim(),
      sessionId,
    }
    if (!payload.firstName || !payload.lastName) {
      setNameMessage({ type: 'error', text: 'First and last name are required.' })
      return
    }
    setNameSaving(true)
    setNameMessage(null)
    try {
      const res = await api.post(`/customers/${user.customerId}/name-change/request`, payload)
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      setPendingNameChange({
        firstName: payload.firstName,
        middleName: payload.middleName,
        lastName: payload.lastName,
      })
      setNameEditing(false)
      setVerificationPurpose('name')
      setVerificationSent(true)
      setVerificationCode('')
      setVerificationOpen(true)
      setNameMessage({ type: 'success', text: 'Verification code sent. Check your email.' })
    } catch (err) {
      setNameMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update name.',
      })
    } finally {
      setNameSaving(false)
    }
  }

  const resetNameForm = () => {
    const nameParts = parseFullName(client?.name || '')
    const details = client?.profileData || {}
    setForm((prev) => ({
      ...prev,
      firstName: details.firstName || nameParts.firstName,
      middleName: details.middleName || nameParts.middleName,
      lastName: details.lastName || nameParts.lastName,
    }))
  }

  const handleEmailSave = async () => {
    const trimmed = emailDraft.trim().toLowerCase()
    if (!trimmed) {
      setEmailMessage({ type: 'error', text: 'Email is required.' })
      return
    }
    if (trimmed === String(user?.email || '').trim().toLowerCase()) {
      setEmailMessage({ type: 'error', text: 'Email is unchanged.' })
      return
    }
    if (emailSaving) return
    setEmailSaving(true)
    setEmailMessage(null)
    try {
      const res = await api.post('/auth/email-change/request', { email: trimmed, sessionId })
      if (res.data?.user) {
        setUser(res.data.user)
      }
      setEmailEditing(false)
      setVerificationPurpose('email')
      setVerificationSent(true)
      setVerificationCode('')
      setVerificationOpen(true)
      setEmailMessage({
        type: 'success',
        text: 'Email updated. Please verify your new email to keep your account secure.',
      })
      await logInappNotice('email_change')
    } catch (err) {
      setEmailMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update email.',
      })
    } finally {
      setEmailSaving(false)
    }
  }

  const handlePreferencesSave = async (nextLanguage) => {
    if (!user?.customerId) return
    if (preferencesSaving) return
    setPreferencesSaving(true)
    setPreferencesMessage('')
    try {
      const res = await api.patch(`/customers/${user.customerId}/preferences`, {
        language: nextLanguage,
        sessionId,
      })
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      setPreferencesMessage('Saved')
    } catch (err) {
      setPreferencesMessage(err.response?.data?.error || 'Unable to save preferences')
    } finally {
      setPreferencesSaving(false)
    }
  }

  const loadLoginActivity = async () => {
    if (!user?.customerId) return
    setLoginActivityLoading(true)
    try {
      const res = await api.get(`/customers/${user.customerId}/login-activity`, {
        params: { sessionId },
      })
      setLoginActivity(res.data?.activity || [])
      setLoginActivityPage(1)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to load login activity')
    } finally {
      setLoginActivityLoading(false)
    }
  }

  const loadSessions = async () => {
    if (!user?.customerId) return
    setSessionsLoading(true)
    try {
      const res = await api.get(`/customers/${user.customerId}/active-sessions`, {
        params: { sessionId },
      })
      setSessions(res.data?.sessions || [])
      setSessionsPage(1)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleLogoutOtherSessions = async () => {
    if (!user) return
    const confirmed = window.confirm('Log out all other sessions? Your current session stays active.')
    if (!confirmed) return
    setSessionsMessage(null)
    try {
      const res = await api.post('/auth/sessions/revoke-others', { sessionId })
      if (res.data?.token && completeAuth) {
        const persist = typeof window !== 'undefined' && localStorage.getItem('connsura_token')
        completeAuth(res.data.token, res.data.user || user, null, { persist: Boolean(persist) })
      }
      setSessionsMessage({ type: 'success', text: 'Other sessions logged out.' })
      await loadSessions()
    } catch (err) {
      setSessionsMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to log out other sessions',
      })
    }
  }

  const loadSharedActivity = async () => {
    if (!user?.customerId) return
    setSharedActivityLoading(true)
    try {
      const res = await api.get(`/customers/${user.customerId}/shared-profile-activity`, {
        params: { sessionId },
      })
      setSharedActivity(res.data?.activity || [])
      setSharedActivityPage(1)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to load shared activity')
    } finally {
      setSharedActivityLoading(false)
    }
  }

  const toggleLoginActivity = async () => {
    if (loginActivityOpen) {
      setLoginActivityOpen(false)
      return
    }
    await loadLoginActivity()
    setLoginActivityOpen(true)
  }

  const toggleSessions = async () => {
    if (sessionsOpen) {
      setSessionsOpen(false)
      return
    }
    await loadSessions()
    setSessionsOpen(true)
  }

  const toggleSharedActivity = async () => {
    if (sharedActivityOpen) {
      setSharedActivityOpen(false)
      return
    }
    await loadSharedActivity()
    setSharedActivityOpen(true)
  }

  const loadConsentHistory = async () => {
    if (!user?.customerId) return
    setConsentLoading(true)
    try {
      const res = await api.get(`/customers/${user.customerId}/consent-history`, {
        params: { sessionId },
      })
      setConsentHistory(res.data?.consents || [])
      setConsentHistoryPage(1)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to load consent history')
    } finally {
      setConsentLoading(false)
    }
  }

  const toggleConsentHistory = async () => {
    if (consentHistoryOpen) {
      setConsentHistoryOpen(false)
      return
    }
    await loadConsentHistory()
    setConsentHistoryOpen(true)
  }

  const logInappNotice = async (type) => {
    if (!user?.customerId) return
    try {
      await api.post(`/customers/${user.customerId}/inapp-notice`, {
        sessionId,
        type,
      })
    } catch (err) {
      console.warn('Unable to log in-app notice', err)
    }
  }

  const handleCookiePreferenceChange = async (nextPref) => {
    if (!user?.customerId) return
    setCookieSaving(true)
    setCookieMessage('')
    setCookiePref(nextPref)
    try {
      await api.put(`/customers/${user.customerId}/cookie-preferences`, {
        preference: nextPref,
        sessionId,
      })
      toast.success(
        'Cookies preference updated. Some features that rely on cookies may not work as expected.'
      )
      setCookieMessage('Saved')
      await logInappNotice('cookie_change')
    } catch (err) {
      setCookieMessage(err.response?.data?.error || 'Unable to save cookie preference')
    } finally {
      setCookieSaving(false)
    }
  }

  const handleLoginAlertsView = async () => {
    if (!user?.customerId) return
    try {
      await api.post(`/customers/${user.customerId}/login-alerts/view`, { sessionId })
    } catch (err) {
      console.warn('Unable to log login alerts view', err)
    }
  }

  const handleDeactivateAccount = async () => {
    if (!deactivatePassword) {
      setDeactivateMessage({ type: 'error', text: 'Enter your password to continue.' })
      return
    }
    setDeactivating(true)
    setDeactivateMessage(null)
    try {
      await api.post('/auth/account/deactivate', { password: deactivatePassword, sessionId })
      toast.success("Account deactivated. You've been signed out.")
      await logInappNotice('account_deactivated')
      logout()
      nav('/', { replace: true })
    } catch (err) {
      setDeactivateMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to deactivate account.',
      })
    } finally {
      setDeactivating(false)
    }
  }

  const handleDeleteAccountClick = async () => {
    if (!user?.customerId) return
    try {
      await api.post(`/customers/${user.customerId}/delete-account/click`, { sessionId })
    } catch (err) {
      console.warn('Unable to log delete account click', err)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteMessage(null)
    if (!deletePassword) {
      setDeleteMessage({ type: 'error', text: 'Enter your password to continue.' })
      return
    }
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setDeleteMessage({ type: 'error', text: 'Type DELETE to confirm.' })
      return
    }
    setDeleting(true)
    try {
      await api.post('/auth/account/delete', { password: deletePassword, sessionId })
      toast.success('Account deleted. Your Connsura account has been permanently removed.')
      logout()
      nav('/account-deleted', { replace: true })
    } catch (err) {
      setDeleteMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to delete account.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const saveNotificationPreferences = async (nextPrefs) => {
    if (!user?.customerId) return
    const saveId = notificationSaveRef.current + 1
    notificationSaveRef.current = saveId
    setNotificationSaving(true)
    setNotificationMessage('')
    try {
      const res = await api.put(`/customers/${user.customerId}/notification-preferences`, {
        preferences: nextPrefs,
        sessionId,
      })
      if (notificationSaveRef.current !== saveId) return
      setNotificationPrefs(normalizeNotificationPrefs(res.data?.preferences || nextPrefs))
      setNotificationMessage('Saved')
    } catch (err) {
      if (notificationSaveRef.current !== saveId) return
      setNotificationMessage(err.response?.data?.error || 'Unable to save changes')
    } finally {
      if (notificationSaveRef.current === saveId) {
        setNotificationSaving(false)
      }
    }
  }

  const passwordDisplay = showPassword ? lastPassword || 'Not captured this session' : '********'
  const resolveShareRecipient = (share) => share?.agent?.name || share?.recipientName || 'Shared link'
  const accountName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ')
  const emailValue = form.email || user?.email || ''
  const fallbackLanguage =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : ''
  const languageLabel = languageDraft || client?.profileData?.language || fallbackLanguage || 'Not set'
  const languageOptions = [
    { value: 'Amharic', label: 'Amharic' },
    { value: 'Arabic', label: 'Arabic' },
    { value: 'Bengali', label: 'Bengali' },
    { value: 'Cherokee', label: 'Cherokee' },
    { value: 'Chinese', label: 'Chinese' },
    { value: 'English', label: 'English' },
    { value: 'French', label: 'French' },
    { value: 'German', label: 'German' },
    { value: 'Gujarati', label: 'Gujarati' },
    { value: 'Haitian Creole', label: 'Haitian Creole' },
    { value: 'Hawaiian', label: 'Hawaiian' },
    { value: 'Hindi', label: 'Hindi' },
    { value: 'Igbo', label: 'Igbo' },
    { value: 'Inuktitut', label: 'Inuktitut' },
    { value: 'Italian', label: 'Italian' },
    { value: 'Japanese', label: 'Japanese' },
    { value: 'Korean', label: 'Korean' },
    { value: 'Navajo', label: 'Navajo' },
    { value: 'Oromo', label: 'Oromo' },
    { value: 'Persian (Farsi)', label: 'Persian (Farsi)' },
    { value: 'Polish', label: 'Polish' },
    { value: 'Portuguese', label: 'Portuguese' },
    { value: 'Punjabi', label: 'Punjabi' },
    { value: 'Russian', label: 'Russian' },
    { value: 'Somali', label: 'Somali' },
    { value: 'Spanish', label: 'Spanish' },
    { value: 'Swahili', label: 'Swahili' },
    { value: 'Tagalog (Filipino)', label: 'Tagalog (Filipino)' },
    { value: 'Tamil', label: 'Tamil' },
    { value: 'Telugu', label: 'Telugu' },
    { value: 'Urdu', label: 'Urdu' },
    { value: 'Vietnamese', label: 'Vietnamese' },
    { value: 'Yoruba', label: 'Yoruba' },
    { value: 'Yupik', label: 'Yupik' },
  ]
  const activityPageSize = 5
  const loginActivityTotalPages = Math.max(1, Math.ceil(loginActivity.length / activityPageSize))
  const sessionsTotalPages = Math.max(1, Math.ceil(sessions.length / activityPageSize))
  const sharedActivityTotalPages = Math.max(1, Math.ceil(sharedActivity.length / activityPageSize))
  const consentHistoryTotalPages = Math.max(1, Math.ceil(consentHistory.length / activityPageSize))
  const loginActivityPageSafe = Math.min(loginActivityPage, loginActivityTotalPages)
  const sessionsPageSafe = Math.min(sessionsPage, sessionsTotalPages)
  const sharedActivityPageSafe = Math.min(sharedActivityPage, sharedActivityTotalPages)
  const consentHistoryPageSafe = Math.min(consentHistoryPage, consentHistoryTotalPages)
  const pagedLoginActivity = loginActivity.slice(
    (loginActivityPageSafe - 1) * activityPageSize,
    loginActivityPageSafe * activityPageSize,
  )
  const pagedSessions = sessions.slice(
    (sessionsPageSafe - 1) * activityPageSize,
    sessionsPageSafe * activityPageSize,
  )
  const pagedSharedActivity = sharedActivity.slice(
    (sharedActivityPageSafe - 1) * activityPageSize,
    sharedActivityPageSafe * activityPageSize,
  )
  const pagedConsentHistory = consentHistory.slice(
    (consentHistoryPageSafe - 1) * activityPageSize,
    consentHistoryPageSafe * activityPageSize,
  )
  const termsVersion = client?.profileData?.terms_version || client?.profileData?.termsVersion || ''
  const termsAcceptedAt =
    client?.profileData?.terms_accepted_at || client?.profileData?.termsAcceptedAt || ''
  const privacyVersion = client?.profileData?.privacy_version || client?.profileData?.privacyVersion || ''
  const privacyAcceptedAt =
    client?.profileData?.privacy_accepted_at || client?.profileData?.privacyAcceptedAt || ''
  const formatAcceptance = (version, date) => {
    if (!version && !date) return 'Not recorded yet'
    if (version && date) return `Version ${version} on ${formatTimestamp(date)}`
    if (version) return `Version ${version}`
    return `Accepted ${formatTimestamp(date)}`
  }
  const currentNotificationPrefs = notificationPrefs || DEFAULT_NOTIFICATION_PREFS

  return (
    <main
      className={`page-shell py-8 pb-28 lg:pb-8 transition-opacity duration-200 ${
        formsStarting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="surface fixed bottom-0 left-0 right-0 z-30 rounded-none border-t border-slate-200 border-x-0 border-b-0 bg-white/95 backdrop-blur px-3 py-2 lg:static lg:rounded-2xl lg:border lg:border-transparent lg:bg-white/80 lg:backdrop-blur-0 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 hidden lg:block">Connsura</div>
          <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => updateTab(item)}
                className={`min-w-max rounded-xl px-3 py-2.5 text-sm font-semibold text-center transition whitespace-nowrap lg:w-full lg:text-left flex items-center justify-between gap-2 ${
                  activeTab === item ? 'bg-[#e8f0ff] text-[#0b3b8c] shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{item}</span>
                {item === 'Messages' && totalUnread > 0 && (
                  <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {activeTab === 'Overview' && (
                <p className="text-slate-500">
                  Welcome back{displayName ? `, ${displayName}` : ''}. Manage your profile.
                  {needsEmailVerification && (
                    <span className="ml-3 text-amber-600">
                      {hasPendingEmail
                        ? 'Verify your new email to finish the update.'
                        : 'Email not verified. Verify your email to share your profile.'}
                      <button
                        type="button"
                        className="ml-2 font-semibold text-[#006aff] hover:underline disabled:text-slate-400 disabled:no-underline"
                        onClick={requestEmailVerification}
                        disabled={verificationSending}
                      >
                        {verificationSent ? 'Resend code' : 'Verify email'}
                      </button>
                    </span>
                  )}
                </p>
              )}
              {activeTab === 'My Insurance Passport' && (
                <p className="text-slate-600">
                  Summary of the information you have saved in your forms.
                </p>
              )}
              {activeTab === 'Forms' && (
                <p className="text-slate-600">Complete your insurance profile.</p>
              )}
              {activeTab === 'Agents' && (
                <p className="text-slate-600">Manage the agents you have saved for quick access.</p>
              )}
              {activeTab === 'Messages' && <p className="text-slate-600">Messages</p>}
              {activeShares.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  <div className="font-semibold">Sharing in progress</div>
                  <div className="flex flex-wrap gap-2">
                    {activeShares.map((share) => (
                      <div
                        key={share.token}
                        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white/80 px-3 py-1.5"
                      >
                        <span>{resolveShareRecipient(share)}</span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] hover:underline disabled:text-slate-400 disabled:no-underline"
                          onClick={() => handleStopSharing(share.token)}
                          disabled={revokingShare === share.token}
                        >
                          {revokingShare === share.token ? 'Stopping...' : 'Stop sharing'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {needsEmailVerification && verificationSent && (
                <div className="mt-2 text-sm text-slate-600">
                  Check your email for the verification code.
                </div>
              )}
            </div>
            {(activeTab === 'Overview' ||
              (activeTab === 'My Insurance Passport' && passportHasData)) && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={`pill-btn-primary px-4 ${
                    isEmailVerified ? '' : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={handleShareClick}
                  disabled={!isEmailVerified}
                >
                  Share
                </button>
              </div>
            )}
          </div>

          {loading && <Skeleton className="h-24" />}

          {!loading && activeTab === 'Overview' && (
            <div className="surface p-5">
              <p className="text-slate-600">Stay on top of your insurance profile and forms.</p>
              {totalUnread > 0 && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm font-semibold text-rose-800">
                    You have {totalUnread} unread {totalUnread === 1 ? 'message' : 'messages'}.{' '}
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={() => updateTab('Messages')}
                    >
                      View messages
                    </button>
                  </div>
                </div>
              )}
              {!threadsLoading && threads.length === 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Talk to an agent</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Browse agents and start a conversation when you are ready.{' '}
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={() => nav('/agents')}
                    >
                      Find agents
                    </button>
                  </p>
                </div>
              )}
              {(hasAgentReply || waitingOnAgentReply) && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm font-semibold text-rose-800">Continue your conversation</div>
                  <p className="mt-1 text-sm text-rose-700">
                    {hasAgentReply ? 'Agent replied - continue conversation.' : 'Waiting for agent reply.'}{' '}
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={() => updateTab('Messages')}
                    >
                      View messages
                    </button>
                  </p>
                </div>
              )}
              {savedAgentIds.size > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">You have a saved agent</div>
                  <p className="mt-1 text-sm text-slate-600">
                    View your saved agents to keep the relationship active.{' '}
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={() => updateTab('Agents')}
                    >
                      View saved agents
                    </button>
                  </p>
                </div>
              )}
              {needsEmailVerification && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900">Verify your email</div>
                  <p className="mt-1 text-sm text-amber-700">
                    Confirm your email to secure your account and share your profile.{' '}
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={requestEmailVerification}
                      disabled={verificationSending}
                    >
                      {verificationSent ? 'Resend code' : 'Verify email'}
                    </button>
                  </p>
                </div>
              )}
              {needsAuthenticator && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900">
                    Add Google Authenticator for account recovery
                  </div>
                  <p className="mt-1 text-sm text-amber-700">
                    Set it up in Settings to recover access if you forget your password or email.{' '}
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={() => updateTab('Settings')}
                    >
                      Set up authenticator
                    </button>
                  </p>
                </div>
              )}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Need help finishing your profile?</div>
                <p className="mt-1 text-sm text-slate-600">
                  Talk to an agent for guidance and next steps.{' '}
                  <button
                    type="button"
                    className={reminderLinkClass}
                    onClick={handleTalkToAgent}
                  >
                    Talk to an Agent
                  </button>
                </p>
              </div>
            </div>
          )}

          {!loading && activeTab === 'My Insurance Passport' && (
            <div className="space-y-4">
              {!passportHasData && (
                <div className="surface p-5 space-y-3">
                  <div className="text-sm text-slate-500">
                    You have not filled out any forms yet. Start with the forms tab to build your insurance passport.
                  </div>
                  <button type="button" className="pill-btn-ghost px-4" onClick={() => updateTab('Forms')}>
                    Start Forms
                  </button>
                </div>
              )}

              {passportHasData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      className={reminderLinkClass}
                      onClick={() => updateTab('Forms')}
                    >
                      Edit in Forms
                    </button>
                  </div>
                  <ShareSummary snapshot={resolvedShareSnapshot} sections={passportShareSections} />
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'Forms' && (
            <div className="space-y-4">
              <div className="surface p-4 flex flex-wrap items-center justify-end gap-3">
                <div className="flex flex-wrap gap-2">
                  {!formsStarted && (
                    <button
                      type="button"
                      className="pill-btn-primary px-4"
                      onClick={handleStartForms}
                      disabled={formsStarting}
                    >
                      {formsStarting ? 'Starting...' : 'Start Forms'}
                    </button>
                  )}
                  {formsStarted && !formsCompleted && (
                    <button
                      type="button"
                      className={`pill-btn-primary px-4 ${
                        isEmailVerified ? '' : 'opacity-60 cursor-not-allowed'
                      }`}
                      onClick={handleShareClick}
                      disabled={!isEmailVerified}
                    >
                      Share
                    </button>
                  )}
                </div>
              </div>
              <CreateProfile
                onShareSnapshotChange={setShareSnapshot}
                onFormDataChange={setFormsDraft}
                initialData={client?.profileData?.forms || null}
                startSection={formsStartSection}
                startKey={formsStartKey}
                onSectionSave={handleSectionSave}
              />
            </div>
          )}

          {!loading && activeTab === 'Agents' && (
            <div className="space-y-4">
              <div className="surface p-5">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="pill-btn-ghost px-4"
                    onClick={loadSavedAgents}
                    disabled={savedAgentsLoading}
                  >
                    {savedAgentsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
              {savedAgentsLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              )}
              {!savedAgentsLoading && savedAgents.length === 0 && (
                <div className="surface p-5 text-sm text-slate-500">
                  <div>No saved agents yet.</div>
                  <button
                    type="button"
                    className="pill-btn-primary mt-3 px-4"
                    onClick={handleTalkToAgent}
                  >
                    Talk to an Agent
                  </button>
                </div>
              )}
              {!savedAgentsLoading && savedAgents.length > 0 && (
                <div className="space-y-3">
                  {savedAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onMessage={handleMessageAgent}
                      onRemove={handleRemoveAgentCard}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'Messages' && (
            <div className="surface p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                  {!threadsLoading && focusAgentLoading && displayThreads.length === 0 && (
                    <div className="text-sm text-slate-500">Loading agent...</div>
                  )}
                  {!threadsLoading && displayThreads.length === 0 && (
                    <div className="text-sm text-slate-500">No messages yet.</div>
                  )}
                  {!threadsLoading && displayThreads.length > 0 && (
                    <div className="space-y-2">
                      {displayThreads.map((thread) => {
                        const agentLabel = thread.agent?.name || thread.agent?.email || 'Agent'
                        const previewPrefix = thread.lastMessage?.senderRole === 'CUSTOMER' ? 'You: ' : ''
                        const preview = `${previewPrefix}${thread.lastMessage?.body || ''}`.trim()
                        const isActive = activeThread?.agent?.id === thread.agent?.id
                        const showRemove = savedAgentIds.has(thread.agent?.id)
                        return (
                          <button
                            key={thread.agent.id}
                            type="button"
                            onClick={() => {
                              setActiveThread(thread)
                              setThreadMessages([])
                              if (thread.agent?.id && focusAgentId !== thread.agent.id) {
                                const params = new URLSearchParams(location.search)
                                params.set('tab', 'messages')
                                params.set('agent', String(thread.agent.id))
                                nav(`/client/dashboard?${params.toString()}`)
                              }
                            }}
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
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                {thread.unreadCount > 0 && (
                                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                    {thread.unreadCount}
                                  </span>
                                )}
                                {showRemove && (
                                  <button
                                    type="button"
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleRemoveAgent(thread.agent.id)
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
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
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {activeThread.agent?.name || activeThread.agent?.email || 'Agent'}
                          </div>
                          {activeThread.agent?.email && (
                            <div className="text-xs text-slate-500">{activeThread.agent.email}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          {activeThread.agent?.id && (
                            <button
                              type="button"
                              className="pill-btn-ghost px-3 text-xs"
                              onClick={() => handleViewProfile(activeThread.agent)}
                            >
                              View profile
                            </button>
                          )}
                          {activeThread.agent?.id && (
                            <button
                              type="button"
                              className={`pill-btn-ghost px-3 text-xs ${
                                savedAgentIds.has(activeThread.agent.id) ? 'opacity-60 cursor-default' : ''
                              }`}
                              onClick={() => handleSaveAgent(activeThread.agent)}
                              disabled={savedAgentIds.has(activeThread.agent.id)}
                            >
                              {savedAgentIds.has(activeThread.agent.id) ? 'Saved' : 'Save agent'}
                            </button>
                          )}
                          <div>{formatTimestamp(activeThread.lastMessage?.createdAt)}</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto py-4">
                        {threadLoading && <Skeleton className="h-24" />}
                        {!threadLoading && threadMessages.length === 0 && (
                          <div className="text-sm text-slate-500">
                            {activeThread.lastMessage
                              ? 'No messages in this conversation.'
                              : 'Introduce yourself to start the conversation.'}
                          </div>
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

          {!loading && activeTab === 'Settings' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="space-y-3">
                  {[
                    { id: 'account', label: 'Account' },
                    { id: 'security', label: 'Security' },
                    { id: 'privacy', label: 'Privacy' },
                    { id: 'notifications', label: 'Notifications' },
                    { id: 'terms', label: 'Terms and conditions' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                      onClick={() => setSettingsModal(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <Modal
                title="Account"
                open={settingsModal === 'account'}
                onClose={() => setSettingsModal(null)}
                panelClassName="max-w-4xl"
              >
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center overflow-hidden border border-slate-200">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-semibold">{getInitials(accountName || displayName, 'CL')}</span>
                      )}
                    </div>
                    <div className="min-w-[180px] flex-1 space-y-1">
                      <div className="text-sm font-semibold text-slate-900">Profile picture</div>
                      <div className="text-xs text-slate-500">Upload a square image under 2MB.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`pill-btn-ghost px-4 py-1.5 text-sm inline-flex items-center gap-2 ${
                          photoUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoChange}
                          disabled={photoUploading}
                        />
                        Upload photo
                      </label>
                      {photoPreview && (
                        <button
                          type="button"
                          className="pill-btn-ghost px-4"
                          onClick={handlePhotoRemove}
                          disabled={photoUploading}
                        >
                          {photoUploading ? 'Saving...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b3b8c] hover:underline"
                        onClick={() => {
                          setNameMessage(null)
                          if (nameEditing) {
                            setNameEditing(false)
                            resetNameForm()
                          } else {
                            setNameEditing(true)
                          }
                        }}
                      >
                        {nameEditing ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    {!nameEditing && <div className="font-semibold text-slate-900">{accountName || 'Not set'}</div>}
                    {nameEditing && (
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                            placeholder="First"
                            value={form.firstName}
                            onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                          />
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                            placeholder="Middle"
                            value={form.middleName}
                            onChange={(e) => setForm((prev) => ({ ...prev, middleName: e.target.value }))}
                          />
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                            placeholder="Last"
                            value={form.lastName}
                            onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="pill-btn-primary px-4"
                            onClick={handleNameSave}
                            disabled={nameSaving}
                          >
                            {nameSaving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                    {nameMessage && (
                      <div
                        className={`text-xs font-semibold ${
                          nameMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {nameMessage.text}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
                        <div className="font-semibold text-slate-900">{emailValue || 'Not set'}</div>
                        {user?.emailPending && (
                          <div className="text-xs text-amber-700">
                            Pending: {user.emailPending} (old email stays active until verified)
                          </div>
                        )}
                      </div>
                      <Badge label={isEmailVerified ? 'Verified' : 'Unverified'} tone={isEmailVerified ? 'green' : 'amber'} />
                    </div>
                    {emailEditing ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(e.target.value)}
                          placeholder="you@example.com"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="pill-btn-ghost px-3 text-xs"
                          onClick={() => {
                            setEmailEditing(false)
                            setEmailMessage(null)
                            setEmailDraft(user?.emailPending || user?.email || '')
                          }}
                        >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="pill-btn-primary px-4 text-xs"
                            onClick={handleEmailSave}
                            disabled={emailSaving}
                          >
                            {emailSaving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="pill-btn-ghost px-3 text-xs"
                          onClick={() => {
                            setEmailEditing(true)
                            setEmailMessage(null)
                            setEmailDraft(user?.emailPending || user?.email || '')
                          }}
                        >
                          Change email
                        </button>
                        {needsEmailVerification && (
                          <button
                            type="button"
                            className="pill-btn-ghost px-3 text-xs"
                            onClick={requestEmailVerification}
                            disabled={verificationSending}
                          >
                            {verificationSent ? 'Resend code' : 'Verify email'}
                          </button>
                        )}
                      </div>
                    )}
                    {emailMessage && (
                      <div
                        className={`text-xs font-semibold ${
                          emailMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {emailMessage.text}
                      </div>
                    )}
                    {needsEmailVerification && verificationSent && (
                      <div className="text-xs text-amber-600">Check your email for the verification code.</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</div>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      value={languageLabel === 'Not set' ? '' : languageLabel}
                      onChange={(event) => {
                        const next = event.target.value
                        setLanguageDraft(next)
                        handlePreferencesSave(next)
                      }}
                      disabled={preferencesSaving}
                    >
                      <option value="">Select language</option>
                      {languageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      {languageLabel &&
                        languageLabel !== 'Not set' &&
                        languageLabel !== fallbackLanguage &&
                        !languageOptions.some((option) => option.value === languageLabel) && (
                          <option value={languageLabel}>{languageLabel}</option>
                        )}
                      {fallbackLanguage &&
                        !languageOptions.some((option) => option.value === fallbackLanguage) && (
                          <option value={fallbackLanguage}>{fallbackLanguage}</option>
                        )}
                    </select>
                    {preferencesMessage && (
                      <div
                        className={`mt-2 text-xs font-semibold ${
                          preferencesMessage === 'Saved' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {preferencesMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              </Modal>

              <Modal
                title="Security"
                open={settingsModal === 'security'}
                onClose={() => setSettingsModal(null)}
                panelClassName="max-w-4xl"
              >
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Security</h3>
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
                      onClick={() => {
                        setPasswordMessage(null)
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

                  {passwordMessage && (
                    <div
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        passwordMessage.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {passwordMessage.text}
                    </div>
                  )}

                  {changingPassword && (
                    <div className="space-y-2">
                      <label className="block text-sm">
                        Current password
                        <input
                          type={showPassword ? 'text' : 'password'}
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
                            type={showPassword ? 'text' : 'password'}
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
                            setCurrentPassword('')
                            setNewPassword('')
                            setConfirmPassword('')
                            setPasswordMessage(null)
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="pill-btn-primary px-5"
                          onClick={handlePasswordSubmit}
                          disabled={passwordUpdating}
                        >
                          {passwordUpdating ? 'Saving...' : 'Save password'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <AuthenticatorPanel />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">Login activity</div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b3b8c] hover:underline"
                        onClick={toggleLoginActivity}
                        disabled={loginActivityLoading}
                      >
                        {loginActivityLoading ? 'Loading...' : loginActivityOpen ? 'Hide' : 'View'}
                      </button>
                    </div>
                    {loginActivityOpen && loginActivity.length === 0 && !loginActivityLoading && (
                      <div className="text-sm text-slate-700">No recent login activity.</div>
                    )}
                    {loginActivityOpen && loginActivity.length > 0 && (
                      <div className="space-y-2">
                        {pagedLoginActivity.map((entry) => (
                          <div key={entry.id} className="text-xs text-slate-600">
                            <div className="font-semibold text-slate-800">{entry.ip || 'Unknown IP'}</div>
                            <div className="truncate">{entry.userAgent || 'Unknown device'}</div>
                            <div className="text-slate-400">{formatTimestamp(entry.timestamp)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {loginActivityOpen && loginActivity.length > activityPageSize && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                          onClick={() => setLoginActivityPage((page) => Math.max(1, page - 1))}
                          disabled={loginActivityPageSafe <= 1}
                        >
                          Previous
                        </button>
                        <span>
                          Page {loginActivityPageSafe} of {loginActivityTotalPages}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                          onClick={() =>
                            setLoginActivityPage((page) => Math.min(loginActivityTotalPages, page + 1))
                          }
                          disabled={loginActivityPageSafe >= loginActivityTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">Active sessions</div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b3b8c] hover:underline"
                        onClick={toggleSessions}
                        disabled={sessionsLoading}
                      >
                        {sessionsLoading ? 'Loading...' : sessionsOpen ? 'Hide' : 'View'}
                      </button>
                    </div>
                    {sessionsOpen && sessions.length === 0 && !sessionsLoading && (
                      <div className="text-sm text-slate-700">No active sessions found.</div>
                    )}
                    {sessionsOpen && sessions.length > 0 && (
                      <div className="space-y-2">
                        {pagedSessions.map((session) => (
                          <div key={session.id} className="text-xs text-slate-600">
                            <div className="font-semibold text-slate-800">
                              {session.current ? 'Current session' : 'Session'}
                            </div>
                            <div className="text-slate-500">{session.ip || 'Unknown IP'}</div>
                            <div className="truncate">{session.userAgent || 'Unknown device'}</div>
                            <div className="text-slate-400">{session.lastSeenAt ? formatTimestamp(session.lastSeenAt) : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sessionsOpen && sessions.length > activityPageSize && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                          onClick={() => setSessionsPage((page) => Math.max(1, page - 1))}
                          disabled={sessionsPageSafe <= 1}
                        >
                          Previous
                        </button>
                        <span>
                          Page {sessionsPageSafe} of {sessionsTotalPages}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                          onClick={() => setSessionsPage((page) => Math.min(sessionsTotalPages, page + 1))}
                          disabled={sessionsPageSafe >= sessionsTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                    {sessionsMessage && (
                      <div
                        className={`text-xs font-semibold ${
                          sessionsMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {sessionsMessage.text}
                      </div>
                    )}
                    <button
                      type="button"
                      className="pill-btn-ghost px-3 text-xs"
                      onClick={handleLogoutOtherSessions}
                      disabled={sessionsLoading}
                    >
                      Log out all other sessions
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-slate-500">Shared profile activity</div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#0b3b8c] hover:underline"
                      onClick={toggleSharedActivity}
                      disabled={sharedActivityLoading}
                    >
                      {sharedActivityLoading ? 'Loading...' : sharedActivityOpen ? 'Hide' : 'View'}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">
                    Active shares: {activeShares.length} | Pending edits: {pendingShares.length}
                  </div>
                  {sharedActivityOpen && sharedActivity.length === 0 && !sharedActivityLoading && (
                    <div className="text-sm text-slate-700">No share activity yet.</div>
                  )}
                  {sharedActivityOpen && sharedActivity.length > 0 && (
                    <div className="space-y-2">
                      {pagedSharedActivity.map((entry) => (
                        <div key={entry.id} className="text-xs text-slate-600">
                          <div className="font-semibold text-slate-800">{entry.recipient}</div>
                          <div className="text-slate-500">Status: {entry.status}</div>
                          {entry.lastAccessedAt && (
                            <div className="text-slate-400">{formatTimestamp(entry.lastAccessedAt)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {sharedActivityOpen && sharedActivity.length > activityPageSize && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                        onClick={() => setSharedActivityPage((page) => Math.max(1, page - 1))}
                        disabled={sharedActivityPageSafe <= 1}
                      >
                        Previous
                      </button>
                      <span>
                        Page {sharedActivityPageSafe} of {sharedActivityTotalPages}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                        onClick={() =>
                          setSharedActivityPage((page) => Math.min(sharedActivityTotalPages, page + 1))
                        }
                        disabled={sharedActivityPageSafe >= sharedActivityTotalPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="pill-btn-ghost px-3 text-xs"
                    onClick={() => updateTab('My Insurance Passport')}
                  >
                    Manage sharing
                  </button>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Deactivate account</div>
                  <p className="text-xs text-slate-500">
                    Temporarily disable your account and revoke active shares.
                  </p>
                  {!deactivateOpen ? (
                    <button
                      type="button"
                      className="pill-btn-ghost px-4"
                      onClick={() => {
                        setDeactivateMessage(null)
                        setDeactivateOpen(true)
                      }}
                    >
                      Deactivate account
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {deactivateMessage && (
                        <div className="text-xs font-semibold text-rose-600">{deactivateMessage.text}</div>
                      )}
                      <label className="block text-sm">
                        Password
                        <input
                          type="password"
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                          value={deactivatePassword}
                          onChange={(e) => setDeactivatePassword(e.target.value)}
                          placeholder="Enter your password"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="pill-btn-ghost"
                          onClick={() => {
                            setDeactivateOpen(false)
                            setDeactivatePassword('')
                            setDeactivateMessage(null)
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="pill-btn-primary px-5"
                          onClick={handleDeactivateAccount}
                          disabled={deactivating}
                        >
                          {deactivating ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <div className="text-sm font-semibold text-rose-700">Delete account</div>
                  <p className="text-xs text-rose-700">
                    This permanently deletes your account, profile, and messages. This cannot be undone.
                  </p>
                  {!deleteOpen ? (
                    <button
                      type="button"
                      className="pill-btn-ghost text-rose-700 border-rose-200 hover:border-rose-300"
                      onClick={() => {
                        handleDeleteAccountClick()
                        setDeleteMessage(null)
                        setDeleteOpen(true)
                      }}
                    >
                      Delete account
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {deleteMessage && (
                        <div
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            deleteMessage.type === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {deleteMessage.text}
                        </div>
                      )}
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
                            setDeleteMessage(null)
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

              </Modal>

              <Modal
                title="Privacy"
                open={settingsModal === 'privacy'}
                onClose={() => setSettingsModal(null)}
                panelClassName="max-w-4xl"
              >
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Privacy</h3>
                  <p className="text-xs text-slate-500">Consent history and policy details.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  We only use essential cookies for sign-in, security, and session management. No ads or tracking.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">Consent history</div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#0b3b8c] hover:underline"
                        onClick={toggleConsentHistory}
                        disabled={consentLoading}
                      >
                        {consentLoading ? 'Loading...' : consentHistoryOpen ? 'Hide' : 'View'}
                      </button>
                    </div>
                    {consentHistoryOpen && consentHistory.length === 0 && !consentLoading && (
                      <div className="text-sm text-slate-700">No consent history recorded yet.</div>
                    )}
                    {consentHistoryOpen && consentHistory.length > 0 && (
                      <div className="space-y-2 text-xs text-slate-600">
                        {pagedConsentHistory.map((entry, index) => (
                          <div key={`${entry.type || 'consent'}-${index}`} className="rounded-lg border border-slate-100 px-2 py-1.5">
                            <div className="font-semibold text-slate-800">{entry.type || 'Consent'}</div>
                            {entry.version && <div className="text-slate-500">Version {entry.version}</div>}
                            {entry.acceptedAt && <div className="text-slate-400">{formatTimestamp(entry.acceptedAt)}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {consentHistoryOpen && consentHistory.length > activityPageSize && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                          onClick={() => setConsentHistoryPage((page) => Math.max(1, page - 1))}
                          disabled={consentHistoryPageSafe <= 1}
                        >
                          Back
                        </button>
                        <span>
                          Page {consentHistoryPageSafe} of {consentHistoryTotalPages}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#0b3b8c] disabled:text-slate-300"
                          onClick={() =>
                            setConsentHistoryPage((page) => Math.min(consentHistoryTotalPages, page + 1))
                          }
                          disabled={consentHistoryPageSafe >= consentHistoryTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="text-sm text-slate-500">Cookies preferences</div>
                    <div className="text-xs text-slate-500">Choose how Connsura uses cookies.</div>
                    <select
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      value={cookiePref}
                      onChange={(event) => handleCookiePreferenceChange(event.target.value)}
                      disabled={cookieSaving}
                    >
                      <option value="all">All cookies</option>
                      <option value="essential">Essential only</option>
                      <option value="none">No cookies</option>
                    </select>
                    {cookieMessage && (
                      <div
                        className={`text-xs font-semibold ${
                          cookieMessage === 'Saved' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {cookieMessage}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                    <div className="text-sm text-slate-500">Privacy policy</div>
                    <Link to="/privacy" className="text-sm font-semibold text-[#0b3b8c] hover:underline">
                      Read privacy policy
                    </Link>
                  </div>
                </div>
              </div>

              </Modal>

              <Modal
                title="Notifications"
                open={settingsModal === 'notifications'}
                onClose={() => setSettingsModal(null)}
                panelClassName="max-w-4xl"
              >
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
                      <div className="text-xs text-slate-500">Updates about messages and forms.</div>
                    </div>
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      value={currentNotificationPrefs.email}
                      onChange={(event) => {
                        const next = normalizeNotificationPrefs({
                          ...currentNotificationPrefs,
                          email: event.target.value,
                        })
                        setNotificationPrefs(next)
                        saveNotificationPreferences(next)
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
                        const next = normalizeNotificationPrefs({
                          ...currentNotificationPrefs,
                          inapp: event.target.checked,
                        })
                        setNotificationPrefs(next)
                        saveNotificationPreferences(next)
                      }}
                      disabled={notificationLoading}
                    />
                  </label>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm text-left"
                    onClick={handleLoginAlertsView}
                    disabled={notificationLoading}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Login alerts</div>
                      <div className="text-xs text-slate-500">
                        Enabled (required for security)
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked
                      readOnly
                      disabled
                    />
                  </button>

                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Notification groups</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        Messages
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={currentNotificationPrefs.groups.messages}
                          onChange={(event) => {
                            const next = normalizeNotificationPrefs({
                              ...currentNotificationPrefs,
                              groups: {
                                ...currentNotificationPrefs.groups,
                                messages: event.target.checked,
                              },
                            })
                            setNotificationPrefs(next)
                            saveNotificationPreferences(next)
                          }}
                          disabled={notificationLoading}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        Passport activity
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={currentNotificationPrefs.groups.passport}
                          onChange={(event) => {
                            const next = normalizeNotificationPrefs({
                              ...currentNotificationPrefs,
                              groups: {
                                ...currentNotificationPrefs.groups,
                                passport: event.target.checked,
                              },
                            })
                            setNotificationPrefs(next)
                            saveNotificationPreferences(next)
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
                            const next = normalizeNotificationPrefs({
                              ...currentNotificationPrefs,
                              groups: {
                                ...currentNotificationPrefs.groups,
                                system: event.target.checked,
                              },
                            })
                            setNotificationPrefs(next)
                            saveNotificationPreferences(next)
                          }}
                          disabled={notificationLoading}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              </Modal>

              <Modal
                title="Terms and conditions"
                open={settingsModal === 'terms'}
                onClose={() => setSettingsModal(null)}
                panelClassName="max-w-4xl"
              >
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Terms & Conditions</h3>
                  <p className="text-xs text-slate-500">Accepted policy versions for your account.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Terms accepted</div>
                    <div className="text-sm text-slate-700">{formatAcceptance(termsVersion, termsAcceptedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Privacy policy accepted</div>
                    <div className="text-sm text-slate-700">{formatAcceptance(privacyVersion, privacyAcceptedAt)}</div>
                  </div>
                </div>
              </div>
              </Modal>
            </div>
          )}
        </section>
      </div>
      <ShareProfileModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        snapshot={resolvedShareSnapshot}
      />
      <RateAgentModal
        open={rateOpen}
        agent={rateAgent}
        onClose={() => setRateOpen(false)}
        onSubmitted={() => loadSavedAgents()}
      />
      <ReviewShareEditsModal
        open={Boolean(reviewShare)}
        share={reviewShare}
        currentForms={client?.profileData?.forms || {}}
        onClose={() => setReviewShare(null)}
        onApprove={() => handleApproveEdits(reviewShare?.token)}
        onDecline={() => handleDeclineEdits(reviewShare?.token)}
      />
      <Modal title={verificationTitle} open={verificationOpen} onClose={() => setVerificationOpen(false)}>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Enter verification code</h3>
            <p className="text-sm text-slate-600">
              Enter the 6-digit code sent to {verificationTargetEmail || 'your email'}.
            </p>
          </div>
          <div className="space-y-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={verificationCode}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, '').slice(0, 6)
                setVerificationCode(next)
              }}
              placeholder="Enter 6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            {verificationError && (
              <div className="text-xs font-semibold text-rose-600">{verificationError}</div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="pill-btn-ghost px-4"
              onClick={verificationPurpose === 'name' ? requestNameChangeVerification : requestEmailVerification}
              disabled={verificationSending}
            >
              {verificationSending ? 'Sending...' : 'Resend code'}
            </button>
            <button
              type="button"
              className="pill-btn-primary px-5"
              onClick={handleVerifyCodeConfirm}
              disabled={verificationConfirming}
            >
              {verificationConfirming ? 'Verifying...' : verificationConfirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  )
}
