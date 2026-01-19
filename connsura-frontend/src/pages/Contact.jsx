import { useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useSiteContent } from '../hooks/useSiteContent'
import { renderSiteContent } from '../utils/siteContent'

export default function Contact() {
  const [form, setForm] = useState({ email: '', topic: 'support', message: '' })
  const [sending, setSending] = useState(false)
  const { content } = useSiteContent('contact_intro', {
    title: 'Contact Intro',
    content:
      '<p>Questions about the platform, data usage, or access? Reach out and our team will respond.</p>',
  })

  const introHtml = renderSiteContent(content?.content || '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/contact', form)
      toast.success('Message sent')
      setForm({ email: '', topic: 'support', message: '' })
    } catch {
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
        <div
          className="text-sm text-slate-600 [&_p]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: introHtml }}
        />
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            Topic
            <select
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            >
              <option value="support">Support</option>
              <option value="agents">Agents</option>
              <option value="billing">Billing</option>
              <option value="legal">Legal</option>
              <option value="privacy">Privacy</option>
              <option value="security">Security</option>
              <option value="info">Info</option>
            </select>
          </label>
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
