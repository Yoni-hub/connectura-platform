import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Heading from '../components/ui/Heading'
import Text from '../components/ui/Text'
import PasswordRequirements from '../components/ui/PasswordRequirements'
import { validatePasswordPolicy } from '../utils/passwordPolicy'

const createAuthenticatorForm = () => ({
  identifier: '',
  code: '',
  backupCode: '',
})

const createOtpForm = () => ({
  email: '',
  otpCode: '',
})

const createPasswordForm = () => ({
  password: '',
  confirmPassword: '',
})

export default function AccountRecovery() {
  const [method, setMethod] = useState('otp')
  const [authenticatorForm, setAuthenticatorForm] = useState(createAuthenticatorForm)
  const [otpForm, setOtpForm] = useState(createOtpForm)
  const [passwordForm, setPasswordForm] = useState(createPasswordForm)
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [loading, setLoading] = useState(false)
  const { completeAuth } = useAuth()
  const nav = useNavigate()

  const validatePasswords = () => {
    if (!passwordForm.password || !passwordForm.confirmPassword) {
      toast.error('Enter and confirm your new password')
      return false
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match')
      return false
    }
    const passwordPolicy = validatePasswordPolicy(passwordForm.password)
    if (!passwordPolicy.valid) {
      return false
    }
    return true
  }

  const handleSendOtp = async () => {
    const email = otpForm.email.trim().toLowerCase()
    if (!email) {
      toast.error('Enter the email used to sign up')
      return
    }
    setSendingOtp(true)
    try {
      await api.post('/auth/recovery/email-otp/request', { email })
      setOtpSent(true)
      toast.success('If the email exists, a one-time code has been sent')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send verification code')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validatePasswords()) return
    const email = otpForm.email.trim().toLowerCase()
    const otpCode = otpForm.otpCode.trim()
    const identifier = authenticatorForm.identifier.trim()
    const code = authenticatorForm.code.trim()
    const backupCode = authenticatorForm.backupCode.trim()

    if (method === 'otp') {
      if (!email) {
        toast.error('Enter the email used to sign up')
        return
      }
      if (!otpCode) {
        toast.error('Enter the one-time password from your email')
        return
      }
    } else {
      if (!identifier) {
        toast.error('Enter your email or recovery ID')
        return
      }
      if (!code && !backupCode) {
        toast.error('Enter an authenticator or backup code')
        return
      }
    }

    setLoading(true)
    try {
      let res
      if (method === 'otp') {
        res = await api.post('/auth/recovery/email-otp/reset', {
          email,
          otpCode,
          newPassword: passwordForm.password,
        })
      } else {
        res = await api.post('/auth/recovery/reset', {
          identifier,
          code,
          backupCode,
          newPassword: passwordForm.password,
        })
      }
      completeAuth(res.data.token, res.data.user, passwordForm.password)
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
          <Heading as="h1" variant="h2">Account recovery</Heading>
          <Text as="p" variant="body" className="text-slate-600">Choose how you want to reset your password.</Text>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={`rounded-xl border px-3 py-2 text-left text-sm ${
              method === 'otp'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() => setMethod('otp')}
          >
            Reset with one-time password
          </button>
          <button
            type="button"
            className={`rounded-xl border px-3 py-2 text-left text-sm ${
              method === 'authenticator'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() => setMethod('authenticator')}
          >
            Use your authenticator app
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {method === 'otp' ? (
            <>
              <label className="block text-sm">
                Email used to sign up
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={otpForm.email}
                  onChange={(e) => setOtpForm({ ...otpForm, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="pill-btn-ghost"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? 'Sending...' : otpSent ? 'Resend code' : 'Send code'}
                </button>
                {otpSent ? (
                  <Text as="p" variant="body" className="self-center text-emerald-700">OTP sent. Check your email.</Text>
                ) : null}
              </div>
              <label className="block text-sm">
                One-time password
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={otpForm.otpCode}
                  onChange={(e) => setOtpForm({ ...otpForm, otpCode: e.target.value })}
                  placeholder="6-digit code"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm">
                Email or recovery ID
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={authenticatorForm.identifier}
                  onChange={(e) =>
                    setAuthenticatorForm({ ...authenticatorForm, identifier: e.target.value })
                  }
                  placeholder="you@example.com or REC-XXXXXX"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Authenticator code
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={authenticatorForm.code}
                    onChange={(e) =>
                      setAuthenticatorForm({ ...authenticatorForm, code: e.target.value })
                    }
                    placeholder="6-digit code"
                  />
                </label>
                <label className="block text-sm">
                  Backup code (optional)
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={authenticatorForm.backupCode}
                    onChange={(e) =>
                      setAuthenticatorForm({ ...authenticatorForm, backupCode: e.target.value })
                    }
                    placeholder="e.g., ABCDE-12345"
                  />
                </label>
              </div>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              New password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Confirm password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
              />
            </label>
          </div>
          <PasswordRequirements password={passwordForm.password} />

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
          <Text as="p" variant="body" className="text-slate-600">
            If you do not have access to any recovery options, contact{' '}
            <a className="text-slate-900 underline" href="mailto:security@connsura.com">
              security@connsura.com
            </a>
            .
          </Text>
        </form>
      </div>
    </main>
  )
}
