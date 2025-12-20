import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'

export default function AgentSearchModal({ open, onClose }) {
  const nav = useNavigate()
  const [mode, setMode] = useState('request')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const [requestForm, setRequestForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    npn: '',
  })

  const [statusForm, setStatusForm] = useState({
    npn: '',
  })

  const resetAll = () => {
    setError('')
    setSuccess('')
    setStatusMessage('')
    setRequestForm({ email: '', firstName: '', lastName: '', npn: '' })
    setStatusForm({ npn: '' })
  }

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const payload = {
        email: requestForm.email.trim(),
        firstName: requestForm.firstName.trim(),
        lastName: requestForm.lastName.trim(),
        npn: requestForm.npn.trim(),
      }
      if (!payload.email || !payload.firstName || !payload.lastName || !payload.npn) {
        setError('Please fill in email, first name, last name, and NPN.')
        return
      }
      await api.post('/agents/request', payload)
      setSuccess('We received your request. We will email you once you are approved.')
      setMode('status')
      setStatusForm({ npn: payload.npn })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit request.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusCheck = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    setLoading(true)
    try {
      const npn = statusForm.npn.trim()
      if (!npn) {
        setError('Please enter NPN to check status.')
        return
      }
      const res = await api.post('/agents/request-status', { npn })
      if (res.data?.approved) {
        setStatusMessage('Approved. Redirecting to dashboard...')
        setTimeout(() => nav('/agent/dashboard'), 800)
      } else if (res.data?.underReview || res.data?.status === 'pending') {
        setStatusMessage('Your request is under review.')
      } else if (res.data?.isSuspended || res.data?.status === 'suspended') {
        setStatusMessage('Your account is suspended. Contact support.')
      } else {
        setStatusMessage(res.data?.status ? `Status: ${res.data.status}` : 'Status not available.')
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setStatusMessage('No request found for this NPN.')
      } else {
        setError(err.response?.data?.error || 'Status lookup failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const input = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
  const primaryBtn = 'rounded bg-[#0b3b8c] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#0a357e]'
  const ghostBtn = 'rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0b3b8c] shadow-sm'
  const linkBtn = 'text-sm text-[#0b3b8c] font-semibold hover:underline'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 py-8">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-base font-semibold text-[#0b3b8c]">
            {mode === 'request' ? 'Agent onboarding request' : 'Check request status'}
          </div>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-slate-600 hover:bg-slate-100"
            onClick={() => {
              resetAll()
              onClose()
            }}
            aria-label="Close agent request"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === 'request' && (
            <form className="space-y-3" onSubmit={handleRequestSubmit}>
              <p className="text-sm text-slate-700">
                Submit your request. Once approved, you’ll be redirected to your dashboard.
              </p>
              <label className="block text-sm font-semibold text-slate-800">
                Email
                <input
                  className={input}
                  type="email"
                  value={requestForm.email}
                  onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                First name
                <input
                  className={input}
                  value={requestForm.firstName}
                  onChange={(e) => setRequestForm({ ...requestForm, firstName: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Last name
                <input
                  className={input}
                  value={requestForm.lastName}
                  onChange={(e) => setRequestForm({ ...requestForm, lastName: e.target.value })}
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                National Producer Number (NPN)
                <input
                  className={input}
                  value={requestForm.npn}
                  onChange={(e) => setRequestForm({ ...requestForm, npn: e.target.value })}
                  required
                />
              </label>

              {error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
              {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">{success}</div>}

              <div className="flex items-center gap-3">
                <button type="submit" className={primaryBtn} disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit request'}
                </button>
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    resetAll()
                    onClose()
                  }}
                  disabled={loading}
                >
                  Close
                </button>
              </div>

              <div className="pt-2 text-sm text-slate-700">
                Already submitted?{' '}
                <button
                  type="button"
                  className={linkBtn}
                  onClick={() => {
                    setMode('status')
                    setError('')
                    setSuccess('')
                    setStatusMessage('')
                    setStatusForm({ npn: requestForm.npn })
                  }}
                >
                  Check status
                </button>
              </div>
            </form>
          )}

          {mode === 'status' && (
            <form className="space-y-3" onSubmit={handleStatusCheck}>
              <p className="text-sm text-slate-700">Enter your NPN to check your approval status.</p>
              <label className="block text-sm font-semibold text-slate-800">
                NPN
                <input
                  className={input}
                  value={statusForm.npn}
                  onChange={(e) => setStatusForm({ npn: e.target.value })}
                  required
                />
              </label>

              {error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
              {statusMessage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800">{statusMessage}</div>
              )}

              <div className="flex items-center gap-3">
                <button type="submit" className={primaryBtn} disabled={loading}>
                  {loading ? 'Checking...' : 'Check'}
                </button>
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    setMode('request')
                    setError('')
                    setStatusMessage('')
                  }}
                  disabled={loading}
                >
                  Back to request
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
