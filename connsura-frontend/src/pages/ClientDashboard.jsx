import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import ShareProfileModal from '../components/modals/ShareProfileModal'
import ReviewShareEditsModal from '../components/modals/ReviewShareEditsModal'
import AuthenticatorPanel from '../components/settings/AuthenticatorPanel'
import Modal from '../components/ui/Modal'
import CreateProfile from './CreateProfile'

const navItems = ['Overview', 'Forms', 'Settings']
const SETTINGS_ITEMS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
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


const resolveBrowserName = (userAgent = '') => {
  const ua = String(userAgent || '').toLowerCase()
  if (!ua) return 'Unknown browser'
  if (ua.includes('edg/')) return 'Microsoft Edge'
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera'
  if (ua.includes('chrome') && !ua.includes('edg/') && !ua.includes('opr/')) return 'Chrome'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer'
  return 'Unknown browser'
}

const resolveDeviceLocation = (entry = {}) => {
  const explicit = entry?.location
  if (explicit && String(explicit).trim()) return String(explicit).trim()
  const parts = [entry?.city, entry?.region || entry?.state, entry?.country]
    .map((value) => (value ? String(value).trim() : ''))
    .filter(Boolean)
  if (parts.length) return parts.join(', ')
  return 'Location unavailable'
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

const resolveFormsSectionKey = (value = '') => {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('summary')) return 'summary'
  if (normalized.includes('additional')) return 'additional'
  if (normalized.includes('address')) return 'address'
  if (normalized.includes('household')) return 'household'
  return ''
}

const DEFAULT_NOTIFICATION_PREFS = {
  emailProfileUpdatesEnabled: false,
  emailFeatureUpdatesEnabled: true,
  emailMarketingEnabled: false,
}

const normalizeNotificationPrefs = (value = {}) => {
  const prefs = value && typeof value === 'object' ? value : {}
  const readBool = (candidate, fallback) =>
    typeof candidate === 'boolean' ? candidate : fallback
  return {
    emailProfileUpdatesEnabled: readBool(
      prefs.emailProfileUpdatesEnabled ?? prefs.email_profile_updates_enabled,
      DEFAULT_NOTIFICATION_PREFS.emailProfileUpdatesEnabled,
    ),
    emailFeatureUpdatesEnabled: readBool(
      prefs.emailFeatureUpdatesEnabled ?? prefs.email_feature_updates_enabled,
      DEFAULT_NOTIFICATION_PREFS.emailFeatureUpdatesEnabled,
    ),
    emailMarketingEnabled: readBool(
      prefs.emailMarketingEnabled ?? prefs.email_marketing_enabled,
      DEFAULT_NOTIFICATION_PREFS.emailMarketingEnabled,
    ),
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
  const { user, lastPassword, setLastPassword, logout, setUser, completeAuth, consentStatus, setConsentStatus } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const params = useParams()
  const formsEditSection = resolveFormsSectionKey(params.section || '')
  const isFormsEditRoute =
    location.pathname.startsWith('/passport/forms/edit') && Boolean(formsEditSection)
  const [activeTab, setActiveTab] = useState(() => resolveTabFromSearch(window.location.search))
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareSnapshot, setShareSnapshot] = useState(null)
  const [formsDraft, setFormsDraft] = useState(null)
  const [formsStarting, setFormsStarting] = useState(false)
  const [formsStartSection, setFormsStartSection] = useState(null)
  const [formsStartKey, setFormsStartKey] = useState(0)
  const [pendingShares, setPendingShares] = useState([])
  const [activeShares, setActiveShares] = useState([])
  const [revokingShare, setRevokingShare] = useState('')
  const [reviewShare, setReviewShare] = useState(null)
  const formsSaveRef = useRef(null)
  const autoReviewRef = useRef('')
  const tabLogRef = useRef('')
  const [settingsView, setSettingsView] = useState(null)
  const [notificationTab, setNotificationTab] = useState('email')
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
  const [legalDocs, setLegalDocs] = useState([])
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
  const formsEditContext = useMemo(() => {
    if (!isFormsEditRoute) return null
    const params = new URLSearchParams(location.search)
    const parseIndex = (key) => {
      const raw = params.get(key)
      if (!raw) return null
      if (raw === 'primary') return 'primary'
      if (raw === 'new') return 'new'
      const num = Number(raw)
      return Number.isFinite(num) ? num : null
    }
    return {
      householdIndex: parseIndex('household'),
      addressIndex: parseIndex('address'),
      additionalFormIndex: (() => {
        const raw = params.get('additionalForm')
        if (!raw) return null
        const num = Number(raw)
        return Number.isFinite(num) ? num : null
      })(),
    }
  }, [isFormsEditRoute, location.search])

  useEffect(() => {
    if (isFormsEditRoute) {
      setActiveTab('Forms')
      return
    }
    const nextTab = resolveTabFromSearch(location.search)
    setActiveTab(nextTab)
  }, [location.search, isFormsEditRoute])

  useEffect(() => {
    if (activeTab !== 'Settings') {
      setSettingsView(null)
    }
  }, [activeTab])

  useEffect(() => {
    if (settingsView !== 'privacy') return
    let active = true
    api
      .get('/legal')
      .then((res) => {
        if (!active) return
        setLegalDocs(res.data?.documents || [])
      })
      .catch(() => {
        if (!active) return
        setLegalDocs([])
      })
    return () => {
      active = false
    }
  }, [settingsView])

  useEffect(() => {
    if (activeTab !== 'Settings') return
    if (settingsView !== 'privacy') return
    if (!user?.customerId) return
    loadConsentHistory()
  }, [activeTab, settingsView, user?.customerId])

  useEffect(() => {
    if (isFormsEditRoute) return
    const nextTab = resolveTabFromSearch(location.search)
    if (nextTab !== 'Forms') return
    const params = new URLSearchParams(location.search)
    const sectionParam = resolveFormsSectionKey(params.get('section') || '')
    if (!sectionParam) return
    setFormsStartSection(sectionParam)
    setFormsStartKey((prev) => prev + 1)
  }, [location.search, isFormsEditRoute])

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
    if (emailEditing) return
    setEmailDraft(user?.emailPending || user?.email || '')
  }, [user?.emailPending, user?.email, emailEditing])

  useEffect(() => {
    if (!user || user.emailVerified || verificationOpen) return
    const pending = sessionStorage.getItem('connsura_pending_email_verification') === 'true'
    if (!pending) return
    sessionStorage.removeItem('connsura_pending_email_verification')
    setVerificationPurpose('email')
    setVerificationSent(true)
    setVerificationCode('')
    setVerificationError('')
    setVerificationOpen(true)
  }, [user, verificationOpen])


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
      .get('/api/notifications/preferences')
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
    return () => {
      if (formsSaveRef.current) clearTimeout(formsSaveRef.current)
    }
  }, [])

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
    if (tabLogRef.current === activeTab) return
    tabLogRef.current = activeTab
    const profileStatus = formsCompleted ? 'completed' : formsStarted ? 'draft' : 'none'
    api.post(`/customers/${user.customerId}/tab-view`, {
      tabName: activeTab,
      sessionId,
      profileStatus,
      currentSection: activeTab === 'Forms' ? formsCurrentSection || null : null,
    }).catch(() => {})
  }, [
    activeTab,
    user?.customerId,
    formsCompleted,
    formsStarted,
    sessionId,
    formsCurrentSection,
  ])
  const displayName = client?.name || user?.name || user?.email || 'client'
  const passportForms = formsDraft || client?.profileData?.forms || {}
  const householdForms = passportForms.household || {}
  const namedInsured = householdForms.namedInsured || {}
  const additionalHouseholds = safeArray(householdForms.additionalHouseholds)
  const addressForms = passportForms.address || {}
  const residential = addressForms.residential || {}
  const additionalAddresses = safeArray(addressForms.additionalAddresses)
  const additionalForms = safeArray(passportForms.additional?.additionalForms)
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

  const formsBasePath =
    location.pathname.startsWith('/dashboard') && !location.pathname.startsWith('/client/dashboard')
      ? '/dashboard'
      : '/client/dashboard'

  const buildFormsListUrl = (sectionKey, preserveSearch = false) => {
    const params = preserveSearch ? new URLSearchParams(location.search) : new URLSearchParams()
    params.set('tab', 'forms')
    if (sectionKey) {
      params.set('section', sectionKey)
    } else {
      params.delete('section')
    }
    return `${formsBasePath}?${params.toString()}`
  }

  const handleMobileEditNavigate = (section, options = {}) => {
    const sectionKey = resolveFormsSectionKey(section || '')
    if (!sectionKey) return
    nav(buildFormsListUrl(sectionKey, true), { replace: true })
    const editParams = new URLSearchParams()
    if (sectionKey === 'household' && options.householdIndex !== undefined) {
      editParams.set('household', String(options.householdIndex))
    }
    if (sectionKey === 'address' && options.addressIndex !== undefined) {
      editParams.set('address', String(options.addressIndex))
    }
    if (sectionKey === 'additional' && typeof options.additionalFormIndex === 'number') {
      editParams.set('additionalForm', String(options.additionalFormIndex))
    }
    const editSuffix = editParams.toString()
    nav(`/passport/forms/edit/${sectionKey}${editSuffix ? `?${editSuffix}` : ''}`)
  }

  const handleEditBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      nav(-1)
      return
    }
    nav(buildFormsListUrl(formsEditSection, false), { replace: true })
  }

  useEffect(() => {
    if (!location.pathname.startsWith('/passport/forms/edit')) return
    if (formsEditSection) return
    nav(buildFormsListUrl('', false), { replace: true })
  }, [location.pathname, formsEditSection])

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

  const sanitizeForJson = (value) => {
    try {
      return JSON.parse(JSON.stringify(value))
    } catch (error) {
      const seen = new WeakSet()
      try {
        return JSON.parse(
          JSON.stringify(value, (key, val) => {
            if (typeof val === 'function' || typeof val === 'symbol') return undefined
            if (typeof val === 'object' && val !== null) {
              if (seen.has(val)) return undefined
              seen.add(val)
            }
            return val
          })
        )
      } catch (err) {
        console.warn('Failed to sanitize forms payload', err)
        return null
      }
    }
  }

  const handleSectionSave = async ({ section, nextSection, forms, profileStatus, logClick }) => {
    if (!user?.customerId) {
      toast.error('Customer profile not found')
      return { success: false }
    }
    try {
      const sanitizedForms = forms ? sanitizeForJson(forms) : forms
      if (forms && sanitizedForms === null) {
        toast.error('Unable to save forms section')
        return { success: false }
      }
      const res = await api.post(`/customers/${user.customerId}/forms/section-save`, {
        section,
        nextSection,
        profileStatus,
        logClick,
        profileData: {
          profile_status: profileStatus || 'draft',
          current_section: nextSection,
          forms_started: true,
          forms: sanitizedForms ?? forms,
        },
      })
      if (res.data?.profile) {
        setClient(res.data.profile)
      }
      if (forms) {
        setFormsDraft(sanitizedForms ?? forms)
      }
      return { success: true }
    } catch (err) {
      const errorData = err.response?.data
      const errorText = errorData?.error || 'Unable to save forms section'
      const detailText = errorData?.detail ? ` (${errorData.detail})` : ''
      console.warn('Unable to save forms section', err, errorData)
      toast.error(`${errorText}${detailText}`)
      return { success: false }
    }
  }

  const handleApproveEdits = async (token) => {
    if (!token) return
    try {
      await api.post(`/shares/${token}/approve`)
      toast.success('Changes approved')
      setReviewShare(null)
      setFormsDraft(null)
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
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error(err.response?.data?.error || 'Unable to load consent history')
      }
      setConsentHistory([])
    } finally {
      setConsentLoading(false)
    }
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
      const payload = {
        email_profile_updates_enabled: Boolean(nextPrefs.emailProfileUpdatesEnabled),
        email_feature_updates_enabled: Boolean(nextPrefs.emailFeatureUpdatesEnabled),
        email_marketing_enabled: Boolean(nextPrefs.emailMarketingEnabled),
      }
      const res = await api.patch('/api/notifications/preferences', payload)
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
  const resolveShareRecipient = (share) => share?.recipientName || 'Shared link'
  const accountName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ')
  const emailValue = form.email || user?.email || ''
  const latestDocByType = useMemo(
    () =>
      (legalDocs || []).reduce((acc, doc) => {
        if (doc?.type) {
          acc[doc.type] = doc
        }
        return acc
      }, {}),
    [legalDocs],
  )
  const latestConsentByType = useMemo(
    () =>
      (consentHistory || []).reduce((acc, consent) => {
        if (!consent?.documentType) return acc
        if (!acc[consent.documentType]) {
          acc[consent.documentType] = consent
        }
        return acc
      }, {}),
    [consentHistory],
  )
  const buildConsentStatus = (type) => {
    const consent = latestConsentByType[type] || null
    const latestDoc = latestDocByType[type] || null
    const acceptedVersion = consent?.version || ''
    const latestVersion = latestDoc?.version || ''
    const isLatest = Boolean(acceptedVersion && latestVersion && acceptedVersion === latestVersion)
    const hasNewer = Boolean(acceptedVersion && latestVersion && acceptedVersion !== latestVersion)
    return { consent, acceptedVersion, latestVersion, isLatest, hasNewer }
  }
  const privacyConsentStatus = buildConsentStatus('privacy')
  const termsConsentStatus = buildConsentStatus('terms')
  const dataSharingConsentStatus = buildConsentStatus('data-sharing')
  const formatConsentLabel = (consent, fallback) => {
    if (!consent) return fallback
    if (consent.version) return `Version ${consent.version}`
    return consent.documentType || fallback
  }
  const openConsentModal = (type) => {
    const latestDoc = latestDocByType[type]
    if (!latestDoc?.version || !setConsentStatus) return
    const existingMissing = consentStatus?.missing || []
    const required = consentStatus?.required || []
    const nextMissing = [
      ...existingMissing.filter((entry) => entry.type !== type),
      { type, version: latestDoc.version },
    ]
    setConsentStatus({ required, missing: nextMissing })
  }
  const activityPageSize = 5
  const loginActivityTotalPages = Math.max(1, Math.ceil(loginActivity.length / activityPageSize))
  const sessionsTotalPages = Math.max(1, Math.ceil(sessions.length / activityPageSize))
  const sharedActivityTotalPages = Math.max(1, Math.ceil(sharedActivity.length / activityPageSize))
  const loginActivityPageSafe = Math.min(loginActivityPage, loginActivityTotalPages)
  const sessionsPageSafe = Math.min(sessionsPage, sessionsTotalPages)
  const sharedActivityPageSafe = Math.min(sharedActivityPage, sharedActivityTotalPages)
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
  const currentNotificationPrefs = notificationPrefs || DEFAULT_NOTIFICATION_PREFS

  const formsEditContent = (
    <div className="min-h-screen bg-slate-50 px-3 py-4">
      {loading ? (
        <Skeleton className="h-24" />
      ) : (
        <CreateProfile
          onShareSnapshotChange={setShareSnapshot}
          onFormDataChange={setFormsDraft}
          initialData={client?.profileData?.forms || null}
          onSectionSave={handleSectionSave}
          editSection={formsEditSection}
          editContext={formsEditContext}
          onEditBack={handleEditBack}
          onMobileEditNavigate={handleMobileEditNavigate}
        />
      )}
    </div>
  )

  if (isFormsEditRoute) {
    return formsEditContent
  }

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
              {activeTab === 'Forms' && (
                <p className="text-slate-600">Complete your insurance profile.</p>
              )}
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
            {activeTab === 'Overview' && (
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
                onMobileEditNavigate={handleMobileEditNavigate}
              />
            </div>
          )}


          {!loading && activeTab === 'Settings' && (
            <div className="space-y-6">
              <div className="relative overflow-hidden">
                <div
                  className={`flex w-[200%] transition-transform duration-300 ease-out ${
                    settingsView ? '-translate-x-1/2' : 'translate-x-0'
                  }`}
                >
                  <div className="w-1/2 pr-4">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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
                  </div>

                  <div className="w-1/2 pl-4">
                    {settingsView && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="pill-btn-ghost px-4"
                            onClick={() => setSettingsView(null)}
                          >
                            Back
                          </button>
                          <div className="text-sm font-semibold text-slate-700">
                            {resolveSettingsLabel(settingsView)}
                          </div>
                        </div>

                        {settingsView === 'account' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
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

                <div className="space-y-3">
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
                        {pagedLoginActivity.map((entry) => {
                          const browserName = resolveBrowserName(entry.userAgent)
                          const locationLabel = resolveDeviceLocation(entry)
                          return (
                            <div key={entry.id} className="text-xs text-slate-600">
                              <div className="font-semibold text-slate-800 break-words">{browserName}</div>
                              <div className="text-xs text-slate-600 break-words">
                                {entry.ip || 'Unknown IP'} · {locationLabel}
                              </div>
                              <div className="text-slate-400">{formatTimestamp(entry.timestamp)}</div>
                            </div>
                          )
                        })}
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
                        {pagedSessions.map((session) => {
                          const browserName = resolveBrowserName(session.userAgent)
                          const locationLabel = resolveDeviceLocation(session)
                          return (
                            <div key={session.id} className="text-xs text-slate-600">
                              <div className="font-semibold text-slate-800">
                                {session.current ? 'Current session' : 'Session'}
                              </div>
                              <div className="text-xs text-slate-600 break-words">{browserName}</div>
                              <div className="text-xs text-slate-600 break-words">
                                {session.ip || 'Unknown IP'} · {locationLabel}
                              </div>
                              <div className="text-slate-400">{session.lastSeenAt ? formatTimestamp(session.lastSeenAt) : ''}</div>
                            </div>
                          )
                        })}
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
                    onClick={() => updateTab('Overview')}
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
                    This permanently deletes your account and profile. This cannot be undone.
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

                        )}

                        {settingsView === 'privacy' && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
                  <div className="text-sm text-slate-500">Cookies</div>
                  <div className="text-xs text-slate-600">
                    We only use essential cookies for sign-in, security, and session management. No ads or tracking.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-3">
                  <div className="text-sm text-slate-500">Consent history</div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">Privacy policy</div>
                      {consentLoading && <div className="text-sm text-slate-700">Loading...</div>}
                      {!consentLoading && !privacyConsentStatus.consent && (
                        <div className="text-sm text-slate-700">No consent history recorded yet.</div>
                      )}
                      {!consentLoading && privacyConsentStatus.consent && (
                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {formatConsentLabel(privacyConsentStatus.consent, 'Privacy policy')}
                          </div>
                          {privacyConsentStatus.consent.consentedAt && (
                            <div className="text-slate-500">
                              {formatTimestamp(privacyConsentStatus.consent.consentedAt)}
                            </div>
                          )}
                          {privacyConsentStatus.isLatest && (
                            <div className="text-emerald-600 font-semibold">Latest version accepted.</div>
                          )}
                          {privacyConsentStatus.hasNewer && (
                            <button
                              type="button"
                              className="text-amber-600 font-semibold hover:underline"
                              onClick={() => openConsentModal('privacy')}
                            >
                              Newer version available.
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">Terms &amp; conditions</div>
                      {consentLoading && <div className="text-sm text-slate-700">Loading...</div>}
                      {!consentLoading && !termsConsentStatus.consent && (
                        <div className="text-sm text-slate-700">No consent history recorded yet.</div>
                      )}
                      {!consentLoading && termsConsentStatus.consent && (
                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {formatConsentLabel(termsConsentStatus.consent, 'Terms')}
                          </div>
                          {termsConsentStatus.consent.consentedAt && (
                            <div className="text-slate-500">
                              {formatTimestamp(termsConsentStatus.consent.consentedAt)}
                            </div>
                          )}
                          {termsConsentStatus.isLatest && (
                            <div className="text-emerald-600 font-semibold">Latest version accepted.</div>
                          )}
                          {termsConsentStatus.hasNewer && (
                            <button
                              type="button"
                              className="text-amber-600 font-semibold hover:underline"
                              onClick={() => openConsentModal('terms')}
                            >
                              Newer version available.
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">Data sharing policy</div>
                      {consentLoading && <div className="text-sm text-slate-700">Loading...</div>}
                      {!consentLoading && !dataSharingConsentStatus.consent && (
                        <div className="text-sm text-slate-700">No consent history recorded yet.</div>
                      )}
                      {!consentLoading && dataSharingConsentStatus.consent && (
                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="font-semibold text-slate-800">
                            {formatConsentLabel(dataSharingConsentStatus.consent, 'Data sharing')}
                          </div>
                          {dataSharingConsentStatus.consent.consentedAt && (
                            <div className="text-slate-500">
                              {formatTimestamp(dataSharingConsentStatus.consent.consentedAt)}
                            </div>
                          )}
                          {dataSharingConsentStatus.isLatest && (
                            <div className="text-emerald-600 font-semibold">Latest version accepted.</div>
                          )}
                          {dataSharingConsentStatus.hasNewer && (
                            <button
                              type="button"
                              className="text-amber-600 font-semibold hover:underline"
                              onClick={() => openConsentModal('data-sharing')}
                            >
                              Newer version available.
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                  <div className="text-sm text-slate-500">Read policies</div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link to="/privacy" className="font-semibold text-[#0b3b8c] hover:underline">
                      Read privacy policy
                    </Link>
                    <Link to="/terms" className="font-semibold text-[#0b3b8c] hover:underline">
                      Read terms and conditions
                    </Link>
                    <Link to="/data-sharing" className="font-semibold text-[#0b3b8c] hover:underline">
                      Read data sharing policy
                    </Link>
                  </div>
                </div>
              </div>

                        )}

                        {settingsView === 'notifications' && (
                          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                            <div className="space-y-1">
                              <h3 className="text-lg font-semibold">Notifications</h3>
                              <p className="text-xs text-slate-500">
                                Some notifications are required for security and core functionality and can't be turned off.
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                  notificationTab === 'email'
                                    ? 'bg-[#0b3b8c] text-white border-[#0b3b8c]'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                                onClick={() => setNotificationTab('email')}
                              >
                                Email notifications
                              </button>
                              <button
                                type="button"
                                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                  notificationTab === 'inapp'
                                    ? 'bg-[#0b3b8c] text-white border-[#0b3b8c]'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                                onClick={() => setNotificationTab('inapp')}
                              >
                                In-app notifications
                              </button>
                            </div>

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

                            {notificationTab === 'email' && (
                              <div className="space-y-6">
                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-slate-900">
                                    Security & Account Protection
                                  </div>
                                  <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Login alerts
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          Receive an email when a new sign-in is detected.
                                        </div>
                                      </div>
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        Always allowed
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Password or email changes
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          Receive an email when your password or email is changed.
                                        </div>
                                      </div>
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        Always allowed
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Legal & policy updates
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          Updates to Privacy Policy, Terms, or Data Sharing Policy.
                                        </div>
                                      </div>
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        Always allowed
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-slate-900">Account & Profile Activity</div>
                                  <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Profile sharing activity
                                        </div>
                                        <div className="text-xs text-slate-500">Receive notifications when your profile is:</div>
                                        <ul className="mt-1 list-disc pl-4 text-xs text-slate-500 space-y-1">
                                          <li>shared</li>
                                          <li>access revoked</li>
                                          <li>updated by a recipient</li>
                                        </ul>
                                      </div>
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        Always allowed
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <label htmlFor="notif-profile-updates" className="text-sm font-semibold text-slate-900">
                                          Insurance profile updates
                                        </label>
                                        <div className="text-xs text-slate-500">
                                          Get notified when your profile information is updated.
                                        </div>
                                      </div>
                                      <input
                                        id="notif-profile-updates"
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={currentNotificationPrefs.emailProfileUpdatesEnabled}
                                        onChange={(event) => {
                                          const next = normalizeNotificationPrefs({
                                            ...currentNotificationPrefs,
                                            emailProfileUpdatesEnabled: event.target.checked,
                                          })
                                          setNotificationPrefs(next)
                                          saveNotificationPreferences(next)
                                        }}
                                        disabled={notificationLoading}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-slate-900">Product Updates</div>
                                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <label htmlFor="notif-feature-updates" className="text-sm font-semibold text-slate-900">
                                          Feature updates & improvements
                                        </label>
                                        <div className="text-xs text-slate-500">
                                          Learn about new features and important improvements.
                                        </div>
                                      </div>
                                      <input
                                        id="notif-feature-updates"
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={currentNotificationPrefs.emailFeatureUpdatesEnabled}
                                        onChange={(event) => {
                                          const next = normalizeNotificationPrefs({
                                            ...currentNotificationPrefs,
                                            emailFeatureUpdatesEnabled: event.target.checked,
                                          })
                                          setNotificationPrefs(next)
                                          saveNotificationPreferences(next)
                                        }}
                                        disabled={notificationLoading}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-slate-900">Marketing & Announcements</div>
                                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <label htmlFor="notif-marketing" className="text-sm font-semibold text-slate-900">
                                          Tips, announcements & offers
                                        </label>
                                        <div className="text-xs text-slate-500">
                                          Occasional helpful updates and platform news.
                                        </div>
                                      </div>
                                      <input
                                        id="notif-marketing"
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={currentNotificationPrefs.emailMarketingEnabled}
                                        onChange={(event) => {
                                          const next = normalizeNotificationPrefs({
                                            ...currentNotificationPrefs,
                                            emailMarketingEnabled: event.target.checked,
                                          })
                                          setNotificationPrefs(next)
                                          saveNotificationPreferences(next)
                                        }}
                                        disabled={notificationLoading}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {notificationTab === 'inapp' && (
                              <div className="space-y-6">
                                <div className="space-y-3">
                                  <div className="text-sm font-semibold text-slate-900">System Notifications</div>
                                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Dashboard reminders & activity badges
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          Alerts and reminders related to your account and insurance profile activity.
                                        </div>
                                      </div>
                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        Always allowed
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      <ShareProfileModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        snapshot={resolvedShareSnapshot}
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
