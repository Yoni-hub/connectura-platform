import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'
import { states } from '../../data/states'

export default function AuthModal({ open, onClose, intent = 'agent' }) {
  const { login, register, loading } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login')
  const [remember, setRemember] = useState(false)
  const [roleIntent, setRoleIntent] = useState(intent)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    state: '',
    zip: '',
    languages: '',
    products: '',
    address: '',
  })

  useEffect(() => {
    if (open) {
      setMode('login')
      setRemember(false)
      setRoleIntent(intent)
      setForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        state: '',
        zip: '',
        languages: '',
        products: '',
        address: '',
      })
    }
  }, [open, intent])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'login') {
      const user = await login(form.email, form.password)
      if (user) {
        onClose()
        if (user.role === 'AGENT') {
          nav('/agent/dashboard', { replace: true })
        } else {
          nav('/client/dashboard', { replace: true })
        }
      }
      return
    }

    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    const payload =
      roleIntent === 'AGENT'
        ? {
            email: form.email,
            password: form.password,
            name: form.name,
            role: 'AGENT',
            languages: form.languages
              ? form.languages.split(',').map((l) => l.trim()).filter(Boolean)
              : [],
            states: form.state ? [form.state] : [],
            specialty: (form.products ? form.products.split(',').map((p) => p.trim()).filter(Boolean)[0] : '') || 'Auto',
            producerNumber: '',
            address: form.address,
            zip: form.zip,
            products: form.products
              ? form.products.split(',').map((p) => p.trim()).filter(Boolean)
              : [],
          }
        : {
            email: form.email,
            password: form.password,
            name: form.name,
            role: 'CUSTOMER',
          }

    const user = await register(payload)
    if (user) {
      onClose()
      if (user.role === 'AGENT') {
        nav('/agent/dashboard', { replace: true })
      } else {
        nav('/client/dashboard', { replace: true })
      }
    }
  }

  return (
    <Modal title="" open={open} onClose={onClose}>
      <form
        className="space-y-4 rounded-2xl border border-[#dfe7f3] bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
        onSubmit={handleSubmit}
      >
        <div className="space-y-1">
          <p className="text-2xl font-bold text-slate-900">
            {mode === 'login'
              ? 'Welcome back'
              : roleIntent === 'AGENT'
              ? 'Create your agent account'
              : 'Create your account'}
          </p>
          <p className="text-sm text-slate-600">
            {mode === 'login'
              ? 'Sign in to your dashboard.'
              : roleIntent === 'AGENT'
              ? 'Set up your profile to start receiving matches.'
              : 'Access your client dashboard and insurance profile.'}
          </p>
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

        {mode === 'create' && roleIntent === 'AGENT' && (
          <div className="space-y-3">
            <label className="block text-sm">
              Full name or agency name
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm block">
                Licensed state
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                >
                  <option value="">Select</option>
                  {states.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                ZIP code
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                />
              </label>
            </div>
            <label className="block text-sm">
              Business address
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Street, city"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Primary language(s)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="e.g., English, Spanish"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Products you sell
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="e.g., Auto, Home, Renters"
                value={form.products}
                onChange={(e) => setForm({ ...form, products: e.target.value })}
              />
            </label>
          </div>
        )}

        {mode === 'create' && roleIntent !== 'AGENT' && (
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

        {mode === 'login' && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" />
              Remember me
            </label>
            <button type="button" className="font-semibold text-[#006aff]">Forgot password</button>
          </div>
        )}

        {mode === 'create' ? (
          <div className="flex gap-3">
            <button type="button" className="pill-btn-ghost w-1/3 justify-center" onClick={onClose}>
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

        <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          <button
            type="button"
            className="font-semibold text-[#006aff]"
            onClick={() => setMode(mode === 'login' ? 'create' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
