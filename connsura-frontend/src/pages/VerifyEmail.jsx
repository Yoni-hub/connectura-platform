import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function VerifyEmail() {
  const { user, setUser } = useAuth()
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => params.get('code') || '')
  const [confirming, setConfirming] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    setCode(params.get('code') || '')
  }, [params])

  const handleConfirm = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      toast.error('Verification code missing.')
      return
    }
    setConfirming(true)
    setError('')
    try {
      const res = await api.post('/auth/email-otp/confirm', { code: trimmed })
      if (res.data?.user) {
        setUser(res.data.user)
      } else {
        setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev))
      }
      setStatus('verified')
      toast.success('Email verified')
    } catch (err) {
      const message = err.response?.data?.error || 'Verification failed'
      setError(message)
      setStatus('error')
      toast.error(message)
    } finally {
      setConfirming(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      const res = await api.post('/auth/email-otp/request')
      const delivery = res.data?.delivery
      toast.success(delivery === 'log' ? 'Verification email generated. Check the server logs.' : 'Verification email sent.')
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to resend verification email'
      setError(message)
      toast.error(message)
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="page-shell py-10">
      <div className="surface p-6 max-w-xl mx-auto space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Verify your email</h1>
          <p className="text-sm text-slate-600">
            Click confirm to verify your email address.
          </p>
        </div>

        {status === 'verified' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Your email is verified.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!user && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Please sign in to confirm your email.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="pill-btn-primary px-5"
            onClick={handleConfirm}
            disabled={!user || confirming || status === 'verified'}
          >
            Confirm
          </button>
          <button
            type="button"
            className="pill-btn-ghost px-5"
            onClick={handleResend}
            disabled={resending}
          >
            Resend code
          </button>
        </div>
      </div>
    </main>
  )
}
