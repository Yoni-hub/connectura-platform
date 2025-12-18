import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import Skeleton from '../components/ui/Skeleton'

const steps = [
  { id: 'identity', title: 'Identity & licensing', blurb: 'Who you are, where you are licensed, and your producer number.' },
  { id: 'offerings', title: 'Products & audiences', blurb: 'What you sell, languages you support, and service areas.' },
  { id: 'availability', title: 'Availability & contact', blurb: 'How clients reach you and when you respond.' },
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
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [agentStatus, setAgentStatus] = useState('pending')
  const [agentUnderReview, setAgentUnderReview] = useState(false)
  const [agentSuspended, setAgentSuspended] = useState(false)
  const [showReviewOverlay, setShowReviewOverlay] = useState(false)
  const [lookupResult, setLookupResult] = useState(null)
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
    specialty: '',
    address: '',
    zip: '',
    phone: '',
    availability: 'online',
    bio: '',
    insuranceTypes: [],
    licenseTypes: [],
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
          specialty: agent?.specialty || '',
          address,
          zip: agent?.zip || '',
          phone: agent?.phone || '',
          availability: agent?.availability || 'online',
          bio: agent?.bio || '',
          insuranceTypes: Array.isArray(agent?.insuranceTypes) ? agent.insuranceTypes : [],
          licenseTypes: Array.isArray(agent?.licenseTypes) ? agent.licenseTypes : [],
        })
        const status = agent?.status || 'pending'
        const underReviewFlag = Boolean(agent?.underReview)
        const suspendedFlag = Boolean(agent?.isSuspended)
        const submittedFlag = localStorage.getItem('connectura_agent_onboarding_submitted') === 'true'
        setAgentStatus(status)
        setAgentUnderReview(underReviewFlag)
        setAgentSuspended(suspendedFlag)
        setShowReviewOverlay(submittedFlag && status !== 'approved')
      } catch (err) {
        toast.error('Could not load your profile')
      } finally {
        setLoading(false)
      }
    }
    loadAgent()
  }, [user?.agentId])

  const openAgentSignup = () => {
    window.dispatchEvent(new Event('open-agent-auth-signup'))
  }

  const goNext = () => setActiveIndex((i) => Math.min(i + 1, steps.length - 1))
  const goPrev = () => setActiveIndex((i) => Math.max(i - 1, 0))

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

  const handleSave = async () => {
    if (!user) {
      toast.error('Create your agent account to submit onboarding.')
      openAgentSignup()
      return false
    }
    if (!user?.agentId) {
      toast.error('Agent account not found. Please sign out and sign up as an agent again.')
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
        specialty: form.specialty || splitList(form.products)[0] || 'Auto',
        address: addressValue,
        zip: form.zip,
        phone: form.phone,
        availability: form.availability,
        bio: form.bio || 'Licensed agent on Connectura.',
        insuranceTypes: form.insuranceTypes,
        licenseTypes: form.licenseTypes,
        lastNameMode: form.lastNameMode,
        firstName: form.firstName,
        lastName: form.lastName,
        city: form.city,
      }
      await api.put(`/agents/${user.agentId}`, payload)
      toast.success('Onboarding saved. Running license check...')
      localStorage.setItem('connectura_agent_onboarding_pending', 'true')
      localStorage.setItem('connectura_agent_onboarding_submitted', 'true')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const runLicenseLookup = async () => {
    if (!user?.agentId) return
    const npnValue = form.verifyNpn || form.producerNumber
    if (!npnValue) {
      toast.error('NPN is required for the SCC license lookup.')
      return
    }
    setLookupLoading(true)
    try {
      const licenseValue = form.verifyLicense || form.producerNumber
      const res = await api.post(`/agents/${user.agentId}/license-lookup`, {
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

  const handleDecision = async (decision) => {
    if (!user?.agentId) return
    setLookupLoading(true)
    try {
      const res = await api.post(`/agents/${user.agentId}/license-decision`, { decision })
      const updated = res.data.agent
      setAgentStatus(updated.status)
      setAgentUnderReview(updated.underReview)
      setLookupResult(null)
      if (decision === 'approve') {
        localStorage.removeItem('connectura_agent_onboarding_pending')
        localStorage.removeItem('connectura_agent_onboarding_submitted')
        toast.success('License verified. You are approved.')
        nav('/agent/dashboard')
      } else {
        setShowReviewOverlay(true)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update status')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = async () => {
    const saved = await handleSave()
    if (!saved) return
    await runLicenseLookup()
  }

  const commonInput = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2'
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
      {!user && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 flex flex-col gap-3">
          <div className="text-sm font-semibold text-slate-800">Start your agent onboarding</div>
          <p className="text-sm">
            You can review the onboarding steps now. To save and verify your profile, create your agent account first.
          </p>
          <div>
            <button type="button" className="pill-btn-primary" onClick={openAgentSignup}>
              Create account to continue
            </button>
          </div>
        </div>
      )}
      <div className="surface p-5 md:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Agent onboarding</p>
            <h1 className="text-2xl font-semibold text-slate-900">Set up your Connectura agent profile</h1>
            <p className="text-slate-600">
              Finish these steps to start receiving matched client intents. You can update details later in your dashboard.
            </p>
          </div>
          <button
            type="button"
            className="pill-btn-ghost px-4"
            onClick={() => {
              logout()
              nav('/')
            }}
          >
            Sign out
          </button>
      </div>

        <div className="grid gap-3 md:grid-cols-4">
          {steps.map((step, idx) => (
            <button
              type="button"
              key={step.id}
              className={`rounded-xl border p-3 text-sm ${
                idx === activeIndex ? 'border-[#0b3b8c] bg-[#e8f0ff]' : 'border-slate-200 bg-white'
              }`}
              onClick={() => setActiveIndex(idx)}
            >
              <div className="font-semibold text-slate-900">{step.title}</div>
              <div className="text-slate-600 text-xs mt-1 leading-snug">{step.blurb}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div
            className={`rounded-xl border p-4 shadow-sm ${activeIndex === 0 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40' : 'border-slate-200 bg-white'}`}
          >
            <h3 className="text-sm font-semibold mb-3">Identity & licensing</h3>
            <div className="space-y-3">
              <label className="block text-sm">
                Virginia License Number
                <input
                  className={commonInput}
                  value={form.producerNumber}
                  onChange={(e) =>
                    setForm({ ...form, producerNumber: e.target.value, verifyLicense: e.target.value })
                  }
                  placeholder="Virginia License Number"
                />
              </label>
              <label className="block text-sm">
                National Producer Number (NPN)
                <input
                  className={commonInput}
                  value={form.verifyNpn}
                  onChange={(e) => setForm({ ...form, verifyNpn: e.target.value })}
                  placeholder="NPN"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm col-span-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span>Agency Name</span>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="agencyNameMode"
                          value="startsWith"
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
                  />
                </label>

                <label className="block text-sm">
                  Last Name
                  <input
                    className={commonInput}
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Last Name"
                  />
                </label>
                <div className="flex items-end gap-3 text-xs text-slate-600">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="lastNameMode"
                      value="startsWith"
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
                      checked={form.lastNameMode === 'contains'}
                      onChange={(e) => setForm({ ...form, lastNameMode: e.target.value })}
                    />
                    Contains
                  </label>
                </div>
              </div>
              <label className="block text-sm">
                First Name
                <input
                  className={commonInput}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="First Name"
                />
              </label>
              <label className="block text-sm">
                City
                <input
                  className={commonInput}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="City"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  State
                  <select
                    className={commonInput}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
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
                  Zip Code
                  <input
                    className={commonInput}
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    placeholder="Zip Code"
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
          </div>

          <div
            className={`rounded-xl border p-4 shadow-sm ${activeIndex === 1 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40' : 'border-slate-200 bg-white'}`}
          >
            <h3 className="text-sm font-semibold mb-3">Products & audiences</h3>
            <div className="space-y-3">
              <label className="block text-sm">
                Languages you support
                <input
                  className={commonInput}
                  value={form.languages}
                  onChange={(e) => setForm({ ...form, languages: e.target.value })}
                  placeholder="e.g., English, Spanish"
                />
              </label>
              <label className="block text-sm">
                Products / lines you sell
                <input
                  className={commonInput}
                  value={form.products}
                  onChange={(e) => setForm({ ...form, products: e.target.value })}
                  placeholder="e.g., Auto, Home, Renters, Commercial"
                />
              </label>
              <label className="block text-sm">
                Primary specialty
                <input
                  className={commonInput}
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="e.g., Small business, High-net-worth personal lines"
                />
              </label>
              <label className="block text-sm">
                About you (bio)
                <textarea
                  className={`${commonInput} min-h-[120px]`}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Share your background, carriers, and how you help clients."
                />
              </label>
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 shadow-sm ${activeIndex === 2 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40' : 'border-slate-200 bg-white'}`}
          >
            <h3 className="text-sm font-semibold mb-3">Availability & contact</h3>
            <div className="space-y-3">
              <label className="block text-sm">
                Phone
                <input
                  className={commonInput}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Best number for client callbacks"
                />
              </label>
              <label className="block text-sm">
                Availability
                <select
                  className={commonInput}
                  value={form.availability}
                  onChange={(e) => setForm({ ...form, availability: e.target.value })}
                >
                  <option value="online">Online</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
              <label className="block text-sm">
                Office address
                <input
                  className={commonInput}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, city"
                />
              </label>
              <label className="block text-sm">
                ZIP code
                <input
                  className={commonInput}
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  placeholder="e.g., 94105"
                />
              </label>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
                Connectura does NOT sell insurance, does NOT pay agents or clients, and all quotes/policies stay on your own systems.
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 shadow-sm ${activeIndex === 3 ? 'border-[#0b3b8c] bg-[#e8f0ff]/40' : 'border-slate-200 bg-white'}`}
          >
            <h3 className="text-sm font-semibold mb-3">Confirm & finish</h3>
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
              <div>Specialty: {form.specialty || '--'}</div>
              <div>Availability: {form.availability}</div>
              <div>Phone: {form.phone || '--'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 mt-3">
              Reminder: Connectura connects clients to licensed agents. Quotes and policies are handled on your own systems. No platform payouts.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button type="button" className="pill-btn-primary px-8" disabled={saving || lookupLoading} onClick={handleSubmit}>
            {saving || lookupLoading ? 'Working...' : 'Submit & verify'}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Submission received</h2>
            <p className="text-slate-700">
              Your profile has been submitted and is under review. Once approved, we&apos;ll redirect you to your dashboard.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Need help? Call customer service at <span className="font-semibold">123-456-7890</span> or email{' '}
              <a className="text-[#0b3b8c] font-semibold" href="mailto:agent.onboarding@connectura.com">
                agent.onboarding@connectura.com
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
              <a className="text-[#0b3b8c] font-semibold" href="mailto:agent.onboarding@connectura.com">
                agent.onboarding@connectura.com
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
              <button
                type="button"
                className="pill-btn-primary px-5"
                onClick={() => {
                  setShowReviewOverlay(false)
                  setActiveIndex(0)
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
