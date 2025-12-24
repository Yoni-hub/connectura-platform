import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import Skeleton from '../components/ui/Skeleton'

const steps = [
  { id: 'availability', title: 'Connsura account credentials', blurb: 'Your Connsura account login and security answers.' },
  { id: 'identity', title: 'Identity & licensing', blurb: 'Who you are, where you are licensed, and your producer number.' },
  { id: 'offerings', title: 'Products & audiences', blurb: 'What you sell, languages you support, and service areas.' },
  { id: 'review', title: 'Confirm & finish', blurb: 'Review and save your onboarding details.' },
]

const splitList = (value = '') =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

const joinList = (value = []) => value.filter(Boolean).join(', ')

const STATE_OPTIONS = [
  'Alabama',
  'Alaska',
  'American Samoa',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Guam',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Puerto Rico',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'U.S. Virgin Islands',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
]

const INSURANCE_TYPES = [
  'Automobile',
  'Commercial',
  'Dental',
  'Flood',
  'Health \\ Disability',
  'Home',
  'Life',
  'Long-Term Care',
  'Pet',
  'Settlement\\Closing Providers',
  'Surplus Lines',
  'Title',
  'Travel',
  'Variable \\ Annuities',
]
const LICENSE_TYPES = [
  'Credit',
  'Health',
  'Life & Annuities',
  'Life & Health Consultant',
  'Limited Life & Health',
  'Limited Lines P&C - PEI',
  'Limited Lines P&C - SSI',
  'Limited Lines P&C - Travel',
  'Limited Property & Casualty',
  'Managing General Agent',
  'Motor Vehicle Rental Contract',
  'Navigator',
  'Personal Lines',
  'Pharmacy Benefits Manager',
  'Property & Casualty',
  'Property & Casualty Consultant',
  'Public Adjuster',
  'Reinsur Intermediary Broker',
  'Reinsur Intermediary Manager',
  'Settlement Agent',
  'Surplus Lines',
  'Temporary Life & Health',
  'Temporary Life & Health-Debit',
  'Temporary Property & Casualty',
  'Title',
  'Variable Contracts',
  'Viatical Settlement Broker',
]

export default function AgentOnboarding() {
  const { user, register } = useAuth()
  const nav = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [agentStatus, setAgentStatus] = useState('pending')
  const [, setAgentUnderReview] = useState(false)
  const [agentSuspended, setAgentSuspended] = useState(false)
  const [showReviewOverlay, setShowReviewOverlay] = useState(false)
  const [, setLookupResult] = useState(null)
  const [showEmailVerify, setShowEmailVerify] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [identityType, setIdentityType] = useState('agent')
  const [form, setForm] = useState({
    name: '',
    firstName: '',
    lastName: '',
    lastNameMode: 'startsWith',
    agencyName: '',
    agencyNameMode: 'startsWith',
    city: '',
    producerNumber: '',
    verifyLicense: '',
    verifyNpn: '',
    state: '',
    languages: '',
    products: '',
    appointedCarriers: '',
    specialty: '',
    address: '',
    zip: '',
    phone: '',
    availability: 'online',
    bio: '',
    insuranceTypes: [],
    licenseTypes: [],
    accountEmail: '',
    accountPassword: '',
    accountPasswordConfirm: '',
    securityQ1: '',
    securityQ2: '',
    securityQ3: '',
  })

  useEffect(() => {
    const loadAgent = async () => {
      if (!user?.agentId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await api.get(`/agents/${user.agentId}`)
        const agent = res.data.agent
        const nameParts = (agent?.name || '').trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ')
        const address = agent?.address || ''
        const city = address.split(',')[0] || ''

        setForm({
          name: agent?.name || '',
          firstName,
          lastName,
          lastNameMode: 'startsWith',
          agencyName: '',
          agencyNameMode: 'startsWith',
          city,
          producerNumber: agent?.producerNumber || '',
          verifyLicense: agent?.producerNumber || '',
          verifyNpn: '',
          state: Array.isArray(agent?.states) ? agent.states[0] || '' : '',
          languages: joinList(agent?.languages || []),
          products: joinList(agent?.products || []),
          appointedCarriers: joinList(agent?.appointedCarriers || []),
          specialty: agent?.specialty || '',
          address,
          zip: agent?.zip || '',
          phone: agent?.phone || '',
          availability: agent?.availability || 'online',
          bio: agent?.bio || '',
          insuranceTypes: Array.isArray(agent?.insuranceTypes) ? agent.insuranceTypes : [],
          licenseTypes: Array.isArray(agent?.licenseTypes) ? agent.licenseTypes : [],
          accountEmail: agent?.email || '',
          accountPassword: '',
          accountPasswordConfirm: '',
          securityQ1: '',
          securityQ2: '',
          securityQ3: '',
        })
        const status = agent?.status || 'pending'
        const underReviewFlag = Boolean(agent?.underReview)
        const suspendedFlag = Boolean(agent?.isSuspended)
        const submittedFlag = localStorage.getItem('connsura_agent_onboarding_submitted') === 'true'
        setAgentStatus(status)
        setAgentUnderReview(underReviewFlag)
        setAgentSuspended(suspendedFlag)
        setShowReviewOverlay(submittedFlag && status !== 'approved')
      } catch {
        toast.error('Could not load your profile')
      } finally {
        setLoading(false)
      }
    }
    loadAgent()
  }, [user?.agentId])

  const toggleValue = (field, value) => {
    setForm((prev) => {
      const current = new Set(prev[field] || [])
      if (current.has(value)) {
        current.delete(value)
      } else {
        current.add(value)
      }
      return { ...prev, [field]: Array.from(current) }
    })
  }

  const handleBlurDropdown = (setter) => (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setter(false)
    }
  }

  const openEmailVerifyModal = () => {
    const email = form.accountEmail?.trim().toLowerCase()
    if (!email) {
      toast.error('Account email is required to verify.')
      setActiveIndex(0)
      setTimeout(() => {
        const el = document.getElementById('account-email')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      }, 100)
      return
    }
    setVerifyEmail(email)
    setOtpSent(false)
    setOtpCode('')
    setShowEmailVerify(true)
  }

  const closeEmailVerifyModal = () => {
    setShowEmailVerify(false)
    setVerifyEmail('')
    setOtpSent(false)
    setOtpCode('')
    setOtpSending(false)
    setOtpVerifying(false)
  }

  const saveOnboarding = async (agentId) => {
    if (!agentId) {
      toast.error('Please sign in to submit onboarding.')
      return false
    }
    setSaving(true)
    try {
      const displayName =
        (form.name || `${form.firstName} ${form.lastName}`.trim()) || 'Agent'
      const addressValue = form.address || form.city || ''
      const payload = {
        name: displayName.trim(),
        agencyName: form.agencyName,
        agencyNameMode: form.agencyNameMode,
        producerNumber: form.producerNumber,
        states: form.state ? [form.state] : [],
        languages: splitList(form.languages),
        products: splitList(form.products),
        appointedCarriers: splitList(form.appointedCarriers),
        specialty: form.specialty || splitList(form.products)[0] || 'Auto',
        address: addressValue,
        zip: form.zip,
        phone: form.phone,
        availability: form.availability,
        bio: form.bio || 'Licensed agent on Connsura.',
        insuranceTypes: form.insuranceTypes,
        licenseTypes: form.licenseTypes,
        lastNameMode: form.lastNameMode,
        firstName: form.firstName,
        lastName: form.lastName,
        city: form.city,
      }
      await api.put(`/agents/${agentId}`, payload)
      toast.success('Onboarding saved. Running license check...')
      localStorage.setItem('connsura_agent_onboarding_pending', 'true')
      localStorage.setItem('connsura_agent_onboarding_submitted', 'true')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const runLicenseLookup = async (agentId) => {
    const targetAgentId = agentId || user?.agentId
    if (!targetAgentId) return
    const npnValue = form.verifyNpn || form.producerNumber
    if (!npnValue) {
      toast.error('NPN is required for the SCC license lookup.')
      return
    }
    setLookupLoading(true)
    try {
      const licenseValue = form.verifyLicense || form.producerNumber
      const res = await api.post(`/agents/${targetAgentId}/license-lookup`, {
        firstName: form.firstName || '',
        lastName: form.lastName || '',
        zip: form.zip,
        state: form.state,
        npn: npnValue,
        licenseNumber: licenseValue,
      })
      setLookupResult(res.data)
      if (!res.data?.results?.length) {
        setAgentStatus('pending')
        setAgentUnderReview(true)
        setShowReviewOverlay(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'License lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  const sendEmailOtp = async () => {
    if (!verifyEmail) {
      toast.error('Account email is required to verify.')
      return false
    }
    setOtpSending(true)
    try {
      const res = await api.post('/auth/email-otp', { email: verifyEmail })
      const delivery = res.data?.delivery
      setOtpSent(true)
      toast.success(delivery === 'log' ? 'Verification code generated. Check the server logs.' : 'Verification code sent.')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send verification code')
      return false
    } finally {
      setOtpSending(false)
    }
  }

  const submitAfterVerification = async () => {
    const displayName =
      (form.name || `${form.firstName} ${form.lastName}`.trim()) || 'Agent'
    const addressValue = form.address || form.city || ''
    const payload = {
      email: verifyEmail,
      password: form.accountPassword,
      name: displayName.trim(),
      role: 'AGENT',
      languages: splitList(form.languages),
      states: form.state ? [form.state] : [],
      specialty: form.specialty || splitList(form.products)[0] || 'Auto',
      producerNumber: form.producerNumber,
      address: addressValue,
      zip: form.zip,
      products: splitList(form.products),
    }
    const newUser = await register(payload)
    if (!newUser) return false
    const saved = await saveOnboarding(newUser.agentId)
    if (!saved) return false
    await runLicenseLookup(newUser.agentId)
    setAgentStatus('pending')
    setAgentUnderReview(true)
    setShowReviewOverlay(true)
    toast.success('Email verified. Your agent profile is under review.')
    return true
  }

  const verifyEmailOtp = async () => {
    const code = otpCode.trim()
    if (!code) {
      toast.error('Enter the verification code.')
      return false
    }
    setOtpVerifying(true)
    try {
      await api.post('/auth/email-otp/verify', { email: verifyEmail, code })
      const submitted = await submitAfterVerification()
      if (submitted) {
        closeEmailVerifyModal()
      }
      return submitted
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
      return false
    } finally {
      setOtpVerifying(false)
    }
  }

  const handleEmailVerifyAction = async () => {
    if (!otpSent) {
      await sendEmailOtp()
      return
    }
    await verifyEmailOtp()
  }

  const handleSubmit = async () => {
    const requiredFields = [
      { key: 'accountEmail', label: 'Account email', step: 0, el: 'account-email' },
      { key: 'accountPassword', label: 'Password', step: 0, el: 'account-password' },
      { key: 'accountPasswordConfirm', label: 'Repeat password', step: 0, el: 'account-password-confirm' },
      { key: 'securityQ1', label: 'Security phrase 1', step: 0, el: 'security-phrase-1' },
      { key: 'securityQ2', label: 'Security phrase 2', step: 0, el: 'security-phrase-2' },
      { key: 'securityQ3', label: 'Security phrase 3', step: 0, el: 'security-phrase-3' },
      { key: 'producerNumber', label: 'Virginia License Number', step: 1, el: 'producer-number' },
      { key: 'verifyNpn', label: 'National Producer Number (NPN)', step: 1, el: 'npn' },
      { key: 'state', label: 'State', step: 1, el: 'state' },
      { key: 'zip', label: 'Zip Code', step: 1, el: 'zip' },
    ]

    if (identityType === 'agency') {
      requiredFields.push({ key: 'agencyName', label: 'Agency Name', step: 1, el: 'agency-name' })
    } else {
      requiredFields.push(
        { key: 'firstName', label: 'First Name', step: 1, el: 'first-name' },
        { key: 'lastName', label: 'Last Name', step: 1, el: 'last-name' }
      )
    }

    requiredFields.push(
      { key: 'city', label: 'City', step: 1, el: 'city' },
      { key: 'languages', label: 'Languages you support', step: 2, el: 'languages' },
      { key: 'products', label: 'Products / lines you sell', step: 2, el: 'products' },
      { key: 'appointedCarriers', label: 'Insurance companies you are appointed with?', step: 2, el: 'appointed-carriers' },
      { key: 'specialty', label: 'Primary specialty', step: 2, el: 'specialty' },
      { key: 'bio', label: 'About you (bio)', step: 2, el: 'bio' }
    )

    const missing = requiredFields.filter(({ key }) => !form[key]?.toString().trim())
    if (form.accountPassword !== form.accountPasswordConfirm) {
      toast.error('Passwords must match.')
      setActiveIndex(0)
      setTimeout(() => {
        const el = document.getElementById('account-password')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      }, 100)
      return
    }
    if (missing.length) {
      const first = missing[0]
      setActiveIndex(first.step)
      setTimeout(() => {
        const el = document.getElementById(first.el)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      }, 120)
      toast.error(`Please fill the required fields: ${missing.map((m) => m.label).join(', ')}.`)
      return
    }

    if (!user) {
      openEmailVerifyModal()
      return
    }
    const saved = await saveOnboarding(user.agentId)
    if (!saved) return
    await runLicenseLookup(user.agentId)
    toast.success(
      'Account created successfully. Your agent onboarding is under review. When your account is approved, we will send you a link to your email to log into your dashboard. Need help? Call us at 1123-456-7890 or email help@connsura.com.'
    )
  }

  const focusField = (id) => {
    if (typeof document === 'undefined') return
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
    }
  }

  const getStepRequirements = (stepIndex) => {
    if (stepIndex === 0) {
      return [
        { key: 'accountEmail', label: 'Account email', el: 'account-email' },
        { key: 'accountPassword', label: 'Password', el: 'account-password' },
        { key: 'accountPasswordConfirm', label: 'Repeat password', el: 'account-password-confirm' },
        { key: 'securityQ1', label: 'Security phrase 1', el: 'security-phrase-1' },
        { key: 'securityQ2', label: 'Security phrase 2', el: 'security-phrase-2' },
        { key: 'securityQ3', label: 'Security phrase 3', el: 'security-phrase-3' },
      ]
    }
    if (stepIndex === 1) {
      const fields = [
        { key: 'producerNumber', label: 'Virginia License Number', el: 'producer-number' },
        { key: 'verifyNpn', label: 'National Producer Number (NPN)', el: 'npn' },
        { key: 'state', label: 'State', el: 'state' },
        { key: 'zip', label: 'Zip Code', el: 'zip' },
        { key: 'city', label: 'City', el: 'city' },
      ]
      if (identityType === 'agency') {
        fields.push({ key: 'agencyName', label: 'Agency Name', el: 'agency-name' })
      } else {
        fields.push(
          { key: 'firstName', label: 'First Name', el: 'first-name' },
          { key: 'lastName', label: 'Last Name', el: 'last-name' }
        )
      }
      return fields
    }
    if (stepIndex === 2) {
      return [
        { key: 'languages', label: 'Languages you support', el: 'languages' },
        { key: 'products', label: 'Products / lines you sell', el: 'products' },
        { key: 'appointedCarriers', label: 'Insurance companies you are appointed with?', el: 'appointed-carriers' },
        { key: 'specialty', label: 'Primary specialty', el: 'specialty' },
        { key: 'bio', label: 'About you (bio)', el: 'bio' },
      ]
    }
    return []
  }

  const validateStep = (stepIndex) => {
    if (stepIndex === 0 && form.accountPassword !== form.accountPasswordConfirm) {
      toast.error('Passwords must match.')
      focusField('account-password')
      return false
    }
    const requiredFields = getStepRequirements(stepIndex)
    const missing = requiredFields.filter(({ key }) => !form[key]?.toString().trim())
    if (missing.length) {
      const first = missing[0]
      toast.error(`Please fill the required fields: ${missing.map((m) => m.label).join(', ')}.`)
      focusField(first.el)
      return false
    }
    return true
  }

  const handleStepAdvance = (nextIndex) => {
    if (nextIndex <= activeIndex) {
      setActiveIndex(nextIndex)
      return
    }
    if (!validateStep(activeIndex)) return
    setActiveIndex(nextIndex)
  }

  const commonInput =
    'mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'
  const displayName = (form.name || `${form.firstName} ${form.lastName}`.trim()) || '--'
  const licenseNumberDisplay = form.producerNumber || form.verifyLicense || '--'
  const npnDisplay = form.verifyNpn || form.producerNumber || '--'
  const agencyNameDisplay = form.agencyName || '--'

  if (loading) {
    return (
      <main className="page-shell py-10">
        <Skeleton className="h-32" />
      </main>
    )
  }

  return (
    <main className="page-shell py-10">
      <div className="surface p-5 md:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Agent onboarding</p>
            <h1 className="text-2xl font-semibold text-slate-900">Set up your Connsura agent profile</h1>
            <p className="text-slate-600">
              Finish these steps to start receiving matched client intents. You can update details later in your dashboard.
            </p>
          </div>
          <button
            type="button"
            className="pill-btn-ghost px-4"
            onClick={() => {
              nav('/')
            }}
          >
            Home
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {steps.map((step, idx) => {
            const isActive = idx === activeIndex
            const isUnlocked = idx <= activeIndex
            return (
              <button
                type="button"
                key={step.id}
                disabled={!isUnlocked}
                className={`rounded-xl border p-3 text-sm ${
                  isActive ? 'border-[#0b3b8c] bg-[#e8f0ff]' : 'border-slate-200 bg-white'
                } ${isUnlocked ? '' : 'cursor-not-allowed opacity-60'}`}
                onClick={() => setActiveIndex(idx)}
              >
                <div className="font-semibold text-slate-900">{step.title}</div>
                <div className="text-slate-600 text-xs mt-1 leading-snug">{step.blurb}</div>
              </button>
            )
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div
            className={`rounded-xl border p-3 shadow-sm flex flex-col w-full max-w-md mx-auto ${
              activeIndex === 0 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40 md:col-span-4' : 'hidden'
            }`}
          >
            <h3 className="text-sm font-semibold mb-2">Connsura account credentials</h3>
            <div className="space-y-2">
              <label className="block text-sm">
                Email <span className="text-red-500">*</span>
                <input
                  type="email"
                  className={commonInput}
                  value={form.accountEmail}
                  onChange={(e) => setForm({ ...form, accountEmail: e.target.value })}
                  placeholder="Email"
                  required
                  id="account-email"
                />
              </label>
              <label className="block text-sm">
                Password <span className="text-red-500">*</span>
                <input
                  type="password"
                  className={commonInput}
                  value={form.accountPassword}
                  onChange={(e) => setForm({ ...form, accountPassword: e.target.value })}
                  placeholder="Password"
                  required
                  id="account-password"
                />
              </label>
              <label className="block text-sm">
                Repeat password <span className="text-red-500">*</span>
                <input
                  type="password"
                  className={commonInput}
                  value={form.accountPasswordConfirm}
                  onChange={(e) => setForm({ ...form, accountPasswordConfirm: e.target.value })}
                  placeholder="Repeat password"
                  required
                  id="account-password-confirm"
                />
              </label>
              <label className="block text-sm">
                Security phrase 1 <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.securityQ1}
                  onChange={(e) => setForm({ ...form, securityQ1: e.target.value })}
                  placeholder="Phrase 1"
                  required
                  id="security-phrase-1"
                />
              </label>
              <label className="block text-sm">
                Security phrase 2 <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.securityQ2}
                  onChange={(e) => setForm({ ...form, securityQ2: e.target.value })}
                  placeholder="Phrase 2"
                  required
                  id="security-phrase-2"
                />
              </label>
              <label className="block text-sm">
                Security phrase 3 <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.securityQ3}
                  onChange={(e) => setForm({ ...form, securityQ3: e.target.value })}
                  placeholder="Phrase 3"
                  required
                  id="security-phrase-3"
                />
              </label>
              <div className="text-xs text-slate-600 text-right">
                In case you lose your account, you have to remember your security phrases.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 mt-auto">
              <button
                type="button"
                className="pill-btn-primary px-6"
                onClick={() => handleStepAdvance(1)}
              >
                Next
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 shadow-sm flex flex-col w-full max-w-md mx-auto ${
              activeIndex === 1 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40 md:col-span-4' : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Identity & licensing</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${identityType === 'agency' ? 'pill-btn-primary' : 'pill-btn-ghost'} px-3 py-1 text-xs`}
                  onClick={() => setIdentityType('agency')}
                >
                  agency
                </button>
                <button
                  type="button"
                  className={`${identityType === 'agent' ? 'pill-btn-primary' : 'pill-btn-ghost'} px-3 py-1 text-xs`}
                  onClick={() => setIdentityType('agent')}
                >
                  agent
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm">
                Virginia License Number <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.producerNumber}
                  onChange={(e) =>
                    setForm({ ...form, producerNumber: e.target.value, verifyLicense: e.target.value })
                  }
                  placeholder="Virginia License Number"
                  required
                  id="producer-number"
                />
              </label>
              <label className="block text-sm">
                National Producer Number (NPN) <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.verifyNpn}
                  onChange={(e) => setForm({ ...form, verifyNpn: e.target.value })}
                  placeholder="NPN"
                  required
                  id="npn"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`block text-sm col-span-1 sm:col-span-2 ${identityType === 'agent' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      Agency Name {identityType === 'agency' && <span className="text-red-500">*</span>}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="agencyNameMode"
                          value="startsWith"
                          disabled={identityType === 'agent'}
                          checked={form.agencyNameMode === 'startsWith'}
                          onChange={(e) => setForm({ ...form, agencyNameMode: e.target.value })}
                        />
                        Starts With
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="agencyNameMode"
                          value="contains"
                          disabled={identityType === 'agent'}
                          checked={form.agencyNameMode === 'contains'}
                          onChange={(e) => setForm({ ...form, agencyNameMode: e.target.value })}
                        />
                        Contains
                      </label>
                    </div>
                  </div>
                  <input
                    className={commonInput}
                    value={form.agencyName}
                    onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                    placeholder="Agency Name"
                    required={identityType === 'agency'}
                    disabled={identityType === 'agent'}
                    id="agency-name"
                  />
                </label>

                <label className={`block text-sm ${identityType === 'agency' ? 'opacity-60' : ''}`}>
                  Last Name {identityType === 'agent' && <span className="text-red-500">*</span>}
                  <input
                    className={commonInput}
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Last Name"
                    required={identityType === 'agent'}
                    disabled={identityType === 'agency'}
                    id="last-name"
                  />
                </label>
                <div className={`flex items-end gap-3 text-xs text-slate-600 ${identityType === 'agency' ? 'opacity-60' : ''}`}>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="lastNameMode"
                      value="startsWith"
                      disabled={identityType === 'agency'}
                      checked={form.lastNameMode === 'startsWith'}
                      onChange={(e) => setForm({ ...form, lastNameMode: e.target.value })}
                    />
                    Starts With
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="lastNameMode"
                      value="contains"
                      disabled={identityType === 'agency'}
                      checked={form.lastNameMode === 'contains'}
                      onChange={(e) => setForm({ ...form, lastNameMode: e.target.value })}
                    />
                    Contains
                  </label>
                </div>
              </div>
                <label className={`block text-sm ${identityType === 'agency' ? 'opacity-60' : ''}`}>
                  First Name {identityType === 'agent' && <span className="text-red-500">*</span>}
                  <input
                    className={commonInput}
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="First Name"
                    required={identityType === 'agent'}
                    disabled={identityType === 'agency'}
                    id="first-name"
                  />
                </label>
              <label className="block text-sm">
                City <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="City"
                  required
                  id="city"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  State <span className="text-red-500">*</span>
                  <select
                    className={commonInput}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    required
                    id="state"
                  >
                    <option value="">--Select State--</option>
                    {STATE_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Zip Code <span className="text-red-500">*</span>
                  <input
                    className={commonInput}
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    placeholder="Zip Code"
                    required
                    id="zip"
                  />
                </label>
              </div>
              <label className="block text-sm">
                Type of Insurance
                <div
                  tabIndex={0}
                  onBlur={handleBlurDropdown(setInsuranceOpen)}
                  className="relative"
                >
                  <button
                    type="button"
                    className={`${commonInput} text-left flex items-center justify-between`}
                    onClick={() => setInsuranceOpen((v) => !v)}
                  >
                    <span className={form.insuranceTypes.length ? 'text-slate-800' : 'text-slate-400'}>
                      {form.insuranceTypes.length ? form.insuranceTypes.join(', ') : '--Select Insurance Type--'}
                    </span>
                    <span className="text-slate-400">▾</span>
                  </button>
                  {insuranceOpen && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {INSURANCE_TYPES.map((type) => (
                        <label
                          key={type}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={form.insuranceTypes.includes(type)}
                            onChange={() => toggleValue('insuranceTypes', type)}
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <div className="text-xs font-semibold text-slate-500">OR</div>
              <label className="block text-sm">
                License Type
                <div
                  tabIndex={0}
                  onBlur={handleBlurDropdown(setLicenseOpen)}
                  className="relative"
                >
                  <button
                    type="button"
                    className={`${commonInput} text-left flex items-center justify-between`}
                    onClick={() => setLicenseOpen((v) => !v)}
                  >
                    <span className={form.licenseTypes.length ? 'text-slate-800' : 'text-slate-400'}>
                      {form.licenseTypes.length ? form.licenseTypes.join(', ') : '--Select License Type--'}
                    </span>
                    <span className="text-slate-400">▾</span>
                  </button>
                  {licenseOpen && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {LICENSE_TYPES.map((type) => (
                        <label
                          key={type}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={form.licenseTypes.includes(type)}
                            onChange={() => toggleValue('licenseTypes', type)}
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 pt-4 mt-auto">
              <button
                type="button"
                className="pill-btn-ghost px-6"
                onClick={() => handleStepAdvance(0)}
              >
                Back
              </button>
              <button
                type="button"
                className="pill-btn-primary px-6"
                onClick={() => handleStepAdvance(2)}
              >
                Next
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 shadow-sm flex flex-col w-full max-w-md mx-auto ${
              activeIndex === 2 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40 md:col-span-4' : 'hidden'
            }`}
          >
            <h3 className="text-sm font-semibold mb-2">Products & audiences</h3>
            <div className="space-y-2">
              <label className="block text-sm">
                Languages you support <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.languages}
                  onChange={(e) => setForm({ ...form, languages: e.target.value })}
                  placeholder="e.g., English, Spanish"
                  required
                  id="languages"
                />
              </label>
              <label className="block text-sm">
                Products / lines you sell <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.products}
                  onChange={(e) => setForm({ ...form, products: e.target.value })}
                  placeholder="e.g., Auto, Home, Renters, Commercial"
                  required
                  id="products"
                />
              </label>
              <label className="block text-sm">
                Insurance companies you are appointed with?
                <input
                  className={commonInput}
                  value={form.appointedCarriers}
                  onChange={(e) => setForm({ ...form, appointedCarriers: e.target.value })}
                  placeholder="e.g., Travelers, Progressive, Nationwide"
                  required
                  id="appointed-carriers"
                />
              </label>
              <label className="block text-sm">
                Primary specialty <span className="text-red-500">*</span>
                <input
                  className={commonInput}
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="e.g., Small business, High-net-worth personal lines"
                  required
                  id="specialty"
                />
              </label>
              <label className="block text-sm">
                About you (bio) <span className="text-red-500">*</span>
                <textarea
                  className={`${commonInput} min-h-[96px]`}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Share your background, carriers, and how you help clients."
                  required
                  id="bio"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 pt-4 mt-auto">
              <button
                type="button"
                className="pill-btn-ghost px-6"
                onClick={() => handleStepAdvance(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="pill-btn-primary px-6"
                onClick={() => handleStepAdvance(3)}
              >
                Next
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 shadow-sm flex flex-col w-full max-w-md mx-auto ${
              activeIndex === 3 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40 md:col-span-4' : 'hidden'
            }`}
          >
            <h3 className="text-sm font-semibold mb-2">Confirm & finish</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div>Name: {displayName}</div>
              <div>Virginia License Number: {licenseNumberDisplay}</div>
              <div>NPN: {npnDisplay}</div>
              <div>Last Name ({form.lastNameMode === 'contains' ? 'contains' : 'starts with'}): {form.lastName || '--'}</div>
              <div>First Name: {form.firstName || '--'}</div>
              <div>Agency Name ({form.agencyNameMode === 'contains' ? 'contains' : 'starts with'}): {agencyNameDisplay}</div>
              <div>City/State/Zip: {form.city || '--'}, {form.state || '--'} {form.zip || ''}</div>
              <div>Type of Insurance: {form.insuranceTypes.length ? form.insuranceTypes.join(', ') : '--'}</div>
              <div>License Type: {form.licenseTypes.length ? form.licenseTypes.join(', ') : '--'}</div>
              <div>Languages: {form.languages || '--'}</div>
              <div>Products: {form.products || '--'}</div>
              <div>Appointed carriers: {form.appointedCarriers || '--'}</div>
              <div>Specialty: {form.specialty || '--'}</div>
              <div>Account email: {form.accountEmail || '--'}</div>
              <div>
                Security phrases saved: {['securityQ1', 'securityQ2', 'securityQ3'].filter((key) => form[key]).length}/3
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 mt-3">
              Reminder: Connsura connects clients to licensed agents. Quotes and policies are handled on your own systems. No platform payouts.
            </div>
            <div className="flex items-center justify-between gap-3 pt-4 mt-auto">
              <button
                type="button"
                className="pill-btn-ghost px-6"
                onClick={() => handleStepAdvance(2)}
              >
                Back
              </button>
              <button
                type="button"
                className="pill-btn-primary px-8"
                disabled={saving || lookupLoading}
                onClick={handleSubmit}
              >
                {saving || lookupLoading ? 'Working...' : 'Submit & verify'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEmailVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Verify your email address</h2>
            <p className="text-slate-700">
              We will send a one-time verification code to{' '}
              <span className="font-semibold">{verifyEmail || form.accountEmail || '--'}</span>.
            </p>
            {otpSent ? (
              <label className="block text-sm">
                Verification code
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                />
              </label>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Click Verify to send your one-time code.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="pill-btn-ghost px-5" onClick={closeEmailVerifyModal}>
                Cancel
              </button>
              <button
                type="button"
                className="pill-btn-primary px-5"
                disabled={otpSending || otpVerifying}
                onClick={handleEmailVerifyAction}
              >
                {otpSending ? 'Sending...' : otpVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Submission received</h2>
            <p className="text-slate-700">
              Your profile has been submitted and is under review. Once approved, we&apos;ll redirect you to your dashboard.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Need help? Call customer service at <span className="font-semibold">123-456-7890</span> or email{' '}
              <a className="text-[#0b3b8c] font-semibold" href="mailto:agent.onboarding@connsura.com">
                agent.onboarding@connsura.com
              </a>
              .
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={() => setShowSuccess(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showReviewOverlay && agentStatus !== 'approved' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Profile under review</h2>
            <p className="text-slate-700">
              Your agent profile is currently under review. Once approved, you will be redirected to your dashboard. If you are
              suspended, please contact support.
            </p>
            {agentSuspended && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Your account is suspended. Please contact support to resolve this.
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Need help? Call customer service at <span className="font-semibold">123-456-7890</span> or email{' '}
              <a className="text-[#0b3b8c] font-semibold" href="mailto:agent.onboarding@connsura.com">
                agent.onboarding@connsura.com
              </a>
              .
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="pill-btn-ghost px-5"
                onClick={() => nav('/')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
