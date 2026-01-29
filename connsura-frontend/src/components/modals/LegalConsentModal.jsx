import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import Modal from '../ui/Modal'

const docMeta = {
  terms: { label: 'Terms & Conditions', link: '/terms' },
  privacy: { label: 'Privacy Policy', link: '/privacy' },
  'agent-terms': { label: 'Agent Responsibilities', link: '/agent-responsibilities' },
  'data-sharing': { label: 'Data Sharing', link: '/data-sharing' },
}

export default function LegalConsentModal() {
  const { user, consentStatus, setConsentStatus } = useAuth()
  const missing = consentStatus?.missing || []
  const [checks, setChecks] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!missing.length) return
    const next = {}
    missing.forEach((entry) => {
      next[entry.type] = false
    })
    setChecks(next)
  }, [missing])

  const allChecked = useMemo(() => {
    if (!missing.length) return true
    return missing.every((entry) => checks[entry.type])
  }, [missing, checks])

  const handleSubmit = async () => {
    if (!allChecked) {
      toast.error('Please accept each updated legal document.')
      return
    }
    setSaving(true)
    try {
      const consents = missing.map((entry) => ({
        documentType: entry.type,
        version: entry.version,
      }))
      await api.post('/legal/consent/bulk', { consents })
      const statusRes = await api.get('/legal/status/me')
      setConsentStatus({ required: statusRes.data?.required || [], missing: statusRes.data?.missing || [] })
      toast.success('Thanks for reviewing the updates.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save consent')
    } finally {
      setSaving(false)
    }
  }

  if (!user || !missing.length) return null

  return (
    <Modal open title="Updated legal terms" showClose={false} panelClassName="max-w-xl">
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          We updated our legal terms. Please review and accept the latest versions to continue using Connsura.
        </div>
        <div className="space-y-3">
          {missing.map((entry) => {
            const meta = docMeta[entry.type] || { label: entry.type, link: '/terms' }
            return (
              <label key={entry.type} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={!!checks[entry.type]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [entry.type]: e.target.checked }))}
                />
                <span className="text-slate-700">
                  I agree to the updated{' '}
                  <a className="font-semibold text-slate-900 underline" href={meta.link} target="_blank" rel="noreferrer">
                    {meta.label}
                  </a>
                  {entry.version ? ` (v${entry.version})` : ''}.
                </span>
              </label>
            )
          })}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="pill-btn-primary px-5"
            disabled={!allChecked || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Saving...' : 'Accept & continue'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
