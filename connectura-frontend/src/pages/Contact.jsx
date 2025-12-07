import { useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function Contact() {
  const [form, setForm] = useState({ email: '', message: '' })
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/contact', form)
      toast.success('Message sent')
      setForm({ email: '', message: '' })
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Contact us</h1>
        <p className="text-slate-600">We would love to hear from you.</p>
      </div>

      <div className="surface p-6 space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            Email
            <input
              required
              type="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Message
            <textarea
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 h-32"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          <button type="submit" disabled={sending} className="pill-btn-primary">
            {sending ? 'Sending...' : 'Send message'}
          </button>
        </form>
      </div>
    </main>
  )
}
