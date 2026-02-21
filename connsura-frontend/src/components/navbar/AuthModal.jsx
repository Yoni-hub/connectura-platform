import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'
import Heading from '../ui/Heading'
import Text from '../ui/Text'

const createEmptyForm = () => ({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  consentAccepted: false,
})

const POST_AUTH_REDIRECT_KEY = 'connsura_post_auth_redirect'

const consumePostAuthRedirect = () => {
  const redirect = sessionStorage.getItem(POST_AUTH_REDIRECT_KEY)
  if (redirect) {
    sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY)
  }
  return redirect || ''
}

export default function AuthModal({ open, onClose, startMode = 'login' }) {
  const { login, register, loading } = useAuth()
  const nav = useNavigate()
  const initialMode = startMode === 'create' ? 'create' : 'login'
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState(createEmptyForm)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setForm(createEmptyForm())
  }, [open, initialMode])

  const resetState = () => {
    setMode(initialMode)
    setForm(createEmptyForm())
  }

  const handleClose = () => {
    resetState()
    onClose?.()
  }

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'login') {
      const user = await login(form.email, form.password)
      if (user) {
        handleClose()
        const redirectTarget = consumePostAuthRedirect()
        nav(redirectTarget || '/client/dashboard', { replace: true })
      }
      return
    }

    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (!form.consentAccepted) {
      alert('Please accept the consent to continue.')
      return
    }

    const consents = {
      terms: true,
      privacy: true,
      emailCommunications: true,
      platformDisclaimer: true,
    }

    const payload = {
      email: form.email,
      password: form.password,
      name: form.name,
      role: 'CUSTOMER',
      consents,
    }

    const user = await register(payload)
    if (user) {
      handleClose()
      const redirectTarget = consumePostAuthRedirect()
      nav(redirectTarget || '/client/dashboard', { replace: true })
    }
  }

  return (
    <Modal title="" open={open} onClose={handleClose}>
      <form
        className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
        onSubmit={handleSubmit}
      >
        <div className="space-y-1">
          <Heading as="p" variant="h2" className="font-bold">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Heading>
          <Text as="p" variant="body" className="text-slate-600">
            {mode === 'login' ? 'Sign in to your dashboard.' : 'Access your client dashboard and insurance profile.'}
          </Text>
        </div>

        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        {mode === 'login' && (
          <label className="block text-sm">
            Password
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
        )}

        {mode === 'create' && (
          <div className="space-y-3">
            <label className="block text-sm">
              Full name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                Password
                <input
                  type="password"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Confirm password
                <input
                  type="password"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </label>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-2 text-sm text-slate-700">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.consentAccepted}
                onChange={(e) => setForm({ ...form, consentAccepted: e.target.checked })}
              />
              <span>
                By creating an account, you agree to Connsura&apos;s{' '}
                <a className="font-semibold text-slate-900 underline" href="/terms" target="_blank" rel="noreferrer">
                  Terms
                </a>
                ,{' '}
                <a className="font-semibold text-slate-900 underline" href="/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a className="font-semibold text-slate-900 underline" href="/data-sharing" target="_blank" rel="noreferrer">
                  Data Sharing Policy
                </a>
                . You agree to receive required system emails about security, legal updates, and account activity.
              </span>
            </label>
          </div>
        )}

        {mode === 'login' && (
          <div className="flex items-center justify-end text-sm text-slate-600">
            <button
              type="button"
              className="font-semibold text-[#006aff]"
              onClick={() => {
                handleClose()
                nav('/recover')
              }}
            >
              Forgot password
            </button>
          </div>
        )}

        {mode === 'create' ? (
          <div className="flex gap-3">
            <button type="button" className="pill-btn-ghost w-1/3 justify-center" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="pill-btn-primary w-2/3 justify-center text-base">
              {loading ? 'Please wait...' : 'Sign up'}
            </button>
          </div>
        ) : (
          <button type="submit" disabled={loading} className="pill-btn-primary w-full justify-center text-base">
            {loading ? 'Please wait...' : 'Sign in'}
          </button>
        )}

        <div className="flex items-center justify-center gap-2">
          <Text as="span" variant="body" className="text-slate-700">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <button
            type="button"
            className="font-semibold text-[#006aff]"
            onClick={() => {
              if (mode === 'login') {
                setMode('create')
                return
              }
              setMode('login')
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
