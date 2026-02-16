import { useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

export default function AdminOtpTab({ onSessionExpired }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleLookup = async (event) => {
    event?.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      toast.error('Enter an email')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await adminApi.get('/admin/email-otp', { params: { email: trimmed } })
      setResult(res.data)
    } catch (err) {
      if (err?.response?.status === 401) {
        onSessionExpired?.()
        return
      }
      const message = err?.response?.data?.error || 'Code not found'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (!result?.code) return
    try {
      navigator.clipboard.writeText(result.code)
      toast.success('Code copied')
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Email OTP Lookup</h2>
        <p className="text-sm text-slate-600">Fetch the active verification code for a client email.</p>
      </div>
      <form className="space-y-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0" onSubmit={handleLookup}>
        <label className="block text-sm font-medium text-slate-700 sm:w-72">
          Client email
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            required
          />
        </label>
        <button
          type="submit"
          className="pill-btn-primary px-4 py-2 text-sm"
          disabled={loading}
        >
          {loading ? 'Looking up...' : 'Lookup code'}
        </button>
      </form>

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Active code</div>
            <button
              type="button"
              className="pill-btn-ghost px-3 py-1 text-xs"
              onClick={copyCode}
              disabled={!result.code}
            >
              Copy
            </button>
          </div>
          <div className="text-sm text-slate-700">
            <div><span className="font-semibold">Code:</span> {result.code || '—'}</div>
            <div><span className="font-semibold">Created:</span> {result.createdAt || '—'}</div>
            <div><span className="font-semibold">Expires:</span> {result.expiresAt || '—'}</div>
            <div><span className="font-semibold">Attempts:</span> {Number.isFinite(result.attempts) ? result.attempts : '—'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
