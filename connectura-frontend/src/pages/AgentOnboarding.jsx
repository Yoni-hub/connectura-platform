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

export default function AgentOnboarding() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [agentStatus, setAgentStatus] = useState('pending')
  const [agentUnderReview, setAgentUnderReview] = useState(false)
  const [agentSuspended, setAgentSuspended] = useState(false)
  const [showReviewOverlay, setShowReviewOverlay] = useState(false)
  const [form, setForm] = useState({
    name: '',
    producerNumber: '',
    state: '',
    languages: '',
    products: '',
    specialty: '',
    address: '',
    zip: '',
    phone: '',
    availability: 'online',
    bio: '',
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
        setForm({
          name: agent?.name || '',
          producerNumber: agent?.producerNumber || '',
          state: Array.isArray(agent?.states) ? agent.states[0] || '' : '',
          languages: joinList(agent?.languages || []),
          products: joinList(agent?.products || []),
          specialty: agent?.specialty || '',
          address: agent?.address || '',
          zip: agent?.zip || '',
          phone: agent?.phone || '',
          availability: agent?.availability || 'online',
          bio: agent?.bio || '',
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

  const goNext = () => setActiveIndex((i) => Math.min(i + 1, steps.length - 1))
  const goPrev = () => setActiveIndex((i) => Math.max(i - 1, 0))

  const handleSave = async () => {
    if (!user?.agentId) {
      toast.error('Agent account not found. Please sign out and sign up as an agent again.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        producerNumber: form.producerNumber,
        states: form.state ? [form.state] : [],
        languages: splitList(form.languages),
        products: splitList(form.products),
        specialty: form.specialty || splitList(form.products)[0] || 'Auto',
        address: form.address,
        zip: form.zip,
        phone: form.phone,
        availability: form.availability,
        bio: form.bio || 'Licensed agent on Connectura.',
      }
      await api.put(`/agents/${user.agentId}`, payload)
      toast.success('Onboarding saved. Welcome!')
      localStorage.setItem('connectura_agent_onboarding_pending', 'true')
      localStorage.setItem('connectura_agent_onboarding_submitted', 'true')
      setShowSuccess(true)
      setAgentStatus('pending')
      setAgentUnderReview(true)
      setShowReviewOverlay(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const commonInput = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2'
  const fullWidthTextArea = `${commonInput} min-h-[120px]`

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
                Full name or agency name
                <input
                  className={commonInput}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Producer/license number
                <input
                  className={commonInput}
                  value={form.producerNumber}
                  onChange={(e) => setForm({ ...form, producerNumber: e.target.value })}
                  placeholder="NPN or state license ID"
                />
              </label>
              <label className="block text-sm">
                Licensed state (resident)
                <input
                  className={commonInput}
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="e.g., CA"
                />
              </label>
              <label className="block text-sm">
                Short bio (no carrier promises; quotes handled on your own systems)
                <textarea
                  className={fullWidthTextArea}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Licensed independent agent focused on..."
                />
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
              <div>Name: {form.name || '—'}</div>
              <div>License: {form.producerNumber || '—'} ({form.state || 'State not set'})</div>
              <div>Languages: {form.languages || '—'}</div>
              <div>Products: {form.products || '—'}</div>
              <div>Specialty: {form.specialty || '—'}</div>
              <div>Availability: {form.availability}</div>
              <div>Phone: {form.phone || '—'}</div>
              <div>Address: {form.address || '—'} {form.zip || ''}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 mt-3">
              Reminder: Connectura connects clients to licensed agents. Quotes and policies are handled on your own systems. No platform payouts.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button type="button" className="pill-btn-primary px-8" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Submit'}
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
