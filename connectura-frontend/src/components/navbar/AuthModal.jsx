import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'
import { languages } from '../../data/languages'
import { states } from '../../data/states'

const products = [
  'Auto',
  'Home',
  'Renters',
  'Condo',
  'Umbrella',
  'Motorcycle',
  'Commercial Auto',
  'Business Owners',
  'Workers Comp',
  'Life',
  'Health',
  'Pet',
  'Travel',
]

export default function AuthModal({ open, onClose }) {
  const { login, register, loading } = useAuth()
  const nav = useNavigate()
  const [roleTab, setRoleTab] = useState('CUSTOMER')
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    licensedState: '',
    producerNumber: '',
    languages: [],
    address: '',
    zip: '',
    products: [],
  })

  useEffect(() => {
    setMode('login')
    setForm({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      licensedState: '',
      producerNumber: '',
      languages: [],
      address: '',
      zip: '',
      products: [],
    })
  }, [roleTab, open])

  const updateMulti = (key, selectedOptions) => {
    const values = Array.from(selectedOptions).map((o) => o.value)
    setForm((prev) => ({ ...prev, [key]: values }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (mode === 'login') {
      const ok = await login(form.email, form.password)
      if (ok) {
        onClose()
        if (roleTab === 'CUSTOMER') nav('/dashboard')
      }
      return
    }

    if (roleTab === 'CUSTOMER' && form.password !== form.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (roleTab === 'AGENT') {
      const payload = {
        email: form.email,
        password: form.password,
        name: form.name,
        role: 'AGENT',
        languages: form.languages,
        states: form.licensedState ? [form.licensedState] : [],
        specialty: form.products[0] || 'Auto',
        producerNumber: form.producerNumber,
        address: form.address,
        zip: form.zip,
        products: form.products,
      }
      const ok = await register(payload)
      if (ok) {
        onClose()
      }
      return
    }

    const payload = {
      email: form.email,
      password: form.password,
      name: form.name,
      role: 'CUSTOMER',
    }
    const ok = await register(payload)
    if (ok) {
      onClose()
      nav('/dashboard')
    }
  }

  return (
    <Modal title="Sign in or create account" open={open} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setRoleTab('AGENT')}
            className={`px-3 py-1 rounded ${roleTab === 'AGENT' ? 'bg-primary text-white' : 'bg-slate-100'}`}
          >
            Agent
          </button>
          <button
            type="button"
            onClick={() => setRoleTab('CUSTOMER')}
            className={`px-3 py-1 rounded ${roleTab === 'CUSTOMER' ? 'bg-primary text-white' : 'bg-slate-100'}`}
          >
            Customer
          </button>
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

        {mode === 'create' && roleTab === 'CUSTOMER' && (
          <>
            <label className="block text-sm">
              Full name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          </>
        )}

        {mode === 'create' && roleTab === 'AGENT' && (
          <div className="space-y-3">
            <label className="block text-sm">
              Agency/Agent name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Producer number
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.producerNumber}
                onChange={(e) => setForm({ ...form, producerNumber: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm block">
                Licensed state
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={form.licensedState}
                  onChange={(e) => setForm({ ...form, licensedState: e.target.value })}
                >
                  <option value="">Select</option>
                  {states.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm block">
                Preferred languages (multi)
                <select
                  multiple
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 h-28"
                  value={form.languages}
                  onChange={(e) => updateMulti('languages', e.target.selectedOptions)}
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              Agency/Agent address
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Street, city"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              ZIP code
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Insurance products you sell (multi)
              <select
                multiple
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 h-32"
                value={form.products}
                onChange={(e) => updateMulti('products', e.target.selectedOptions)}
              >
                {products.map((prod) => (
                  <option key={prod} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          {mode === 'login' ? (
            <>
              <div className="text-slate-600">Create account?</div>
              <button type="button" className="text-primary font-semibold" onClick={() => setMode('create')}>
                Start
              </button>
            </>
          ) : (
            <>
              <div className="text-slate-600">Already have an account?</div>
              <button type="button" className="text-primary font-semibold" onClick={() => setMode('login')}>
                Back to login
              </button>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2 text-white font-semibold disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
        </button>
      </form>
    </Modal>
  )
}
