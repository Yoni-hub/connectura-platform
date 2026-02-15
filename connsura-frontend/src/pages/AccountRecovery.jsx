import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

const createEmptyForm = () => ({
  identifier: '',
  code: '',
  backupCode: '',
  password: '',
  confirmPassword: '',
})

export default function AccountRecovery() {
  const [form, setForm] = useState(createEmptyForm)
  const [loading, setLoading] = useState(false)
  const { completeAuth } = useAuth()
  const nav = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    const identifier = form.identifier.trim()
    const code = form.code.trim()
    const backupCode = form.backupCode.trim()

    if (!identifier) {
      toast.error('Enter your email or recovery ID')
      return
    }
    if (!code && !backupCode) {
      toast.error('Enter an authenticator or backup code')
      return
    }
    if (!form.password || !form.confirmPassword) {
      toast.error('Enter and confirm your new password')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/recovery/reset', {
        identifier,
        code,
        backupCode,
        newPassword: form.password,
      })
      completeAuth(res.data.token, res.data.user, form.password)
      toast.success('Account recovered')
      nav('/client/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Account recovery failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell py-10">
      <div className="surface p-6 max-w-xl mx-auto space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Account recovery</h1>
          <p className="text-sm text-slate-600">
            Use your authenticator app or a backup code to reset your password.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            Email or recovery ID
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="you@example.com or REC-XXXXXX"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Authenticator code
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="6-digit code"
              />
            </label>
            <label className="block text-sm">
              Backup code (optional)
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.backupCode}
                onChange={(e) => setForm({ ...form, backupCode: e.target.value })}
                placeholder="e.g., ABCDE-12345"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              New password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Confirm password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="pill-btn-ghost"
              onClick={() => nav('/', { replace: true })}
            >
              Back to home
            </button>
            <button type="submit" className="pill-btn-primary" disabled={loading}>
              {loading ? 'Recovering...' : 'Reset password'}
            </button>
          </div>
          <p className="text-xs text-slate-600">
            If you do not have access to any recovery options, contact{' '}
            <a className="text-slate-900 underline" href="mailto:security@connsura.com">
              security@connsura.com
            </a>
            .
          </p>
        </form>
      </div>
    </main>
  )
}
