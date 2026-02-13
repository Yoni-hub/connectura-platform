import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

export default function AdminLegalTab({ onSessionExpired }) {
  const [legalDocs, setLegalDocs] = useState([])
  const [legalLoading, setLegalLoading] = useState(false)
  const [legalError, setLegalError] = useState('')
  const [legalPublish, setLegalPublish] = useState({
    type: 'terms',
    version: '',
    content: '',
    useSource: true,
  })
  const [legalConsentLogs, setLegalConsentLogs] = useState([])
  const [legalConsentLoading, setLegalConsentLoading] = useState(false)
  const [legalConsentFilters, setLegalConsentFilters] = useState({ type: '', role: '' })

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      if (typeof onSessionExpired === 'function') onSessionExpired()
      toast.error('Session expired')
      return true
    }
    if (fallbackMessage) {
      setLegalError(err?.response?.data?.error || fallbackMessage)
      toast.error(err?.response?.data?.error || fallbackMessage)
    }
    return false
  }

  const loadLegalDocs = async () => {
    setLegalLoading(true)
    setLegalError('')
    try {
      const res = await adminApi.get('/legal')
      setLegalDocs(res.data?.documents || [])
    } catch (err) {
      if (handleSessionError(err, 'Failed to load legal documents')) return
    } finally {
      setLegalLoading(false)
    }
  }

  const loadLegalConsents = async () => {
    setLegalConsentLoading(true)
    try {
      const params = {}
      if (legalConsentFilters.type) params.documentType = legalConsentFilters.type
      if (legalConsentFilters.role) params.role = legalConsentFilters.role
      const res = await adminApi.get('/legal/admin/consents', { params })
      setLegalConsentLogs(res.data?.consents || [])
    } catch (err) {
      if (handleSessionError(err, 'Failed to load consent logs')) return
    } finally {
      setLegalConsentLoading(false)
    }
  }

  useEffect(() => {
    loadLegalDocs()
    loadLegalConsents()
  }, [])

  const publishLegalDoc = async () => {
    if (!legalPublish.version.trim()) {
      toast.error('Version is required')
      return
    }
    setLegalLoading(true)
    setLegalError('')
    try {
      if (legalPublish.useSource) {
        await adminApi.post('/legal/admin/publish-from-source', {
          type: legalPublish.type,
          version: legalPublish.version.trim(),
        })
      } else {
        if (!legalPublish.content.trim()) {
          toast.error('Content is required')
          setLegalLoading(false)
          return
        }
        await adminApi.post('/legal/admin/publish', {
          type: legalPublish.type,
          version: legalPublish.version.trim(),
          content: legalPublish.content,
        })
      }
      toast.success('Legal document published')
      setLegalPublish((prev) => ({ ...prev, version: '', content: '' }))
      await loadLegalDocs()
    } catch (err) {
      if (handleSessionError(err, 'Failed to publish legal document')) return
    } finally {
      setLegalLoading(false)
    }
  }

  const forceReconsent = async () => {
    setLegalLoading(true)
    setLegalError('')
    try {
      const payload = legalPublish.type ? { type: legalPublish.type } : {}
      await adminApi.post('/legal/admin/force-reconsent', payload)
      toast.success('Re-consent enforced')
      await loadLegalDocs()
    } catch (err) {
      if (handleSessionError(err, 'Failed to force re-consent')) return
    } finally {
      setLegalLoading(false)
    }
  }

  const forceReconsentAll = async () => {
    setLegalLoading(true)
    setLegalError('')
    try {
      await adminApi.post('/legal/admin/force-reconsent')
      toast.success('Re-consent enforced for all types')
      await loadLegalDocs()
    } catch (err) {
      if (handleSessionError(err, 'Failed to force re-consent')) return
    } finally {
      setLegalLoading(false)
    }
  }

  const exportLegalConsents = async () => {
    try {
      const params = {}
      if (legalConsentFilters.type) params.documentType = legalConsentFilters.type
      if (legalConsentFilters.role) params.role = legalConsentFilters.role
      const res = await adminApi.get('/legal/admin/consents/export', {
        params,
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'consents.csv')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      handleSessionError(err, 'Failed to export consent logs')
    }
  }

  const docTypes = ['terms', 'privacy', 'data-sharing']
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Publish legal version</h3>
            <p className="text-xs text-slate-500">Publish a new version and trigger re-consent.</p>
          </div>
          <label className="block text-sm">
            Document type
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={legalPublish.type}
              onChange={(e) => setLegalPublish((prev) => ({ ...prev, type: e.target.value }))}
            >
              {docTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Version
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={legalPublish.version}
              onChange={(e) => setLegalPublish((prev) => ({ ...prev, version: e.target.value }))}
              placeholder="e.g., 1.1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={legalPublish.useSource}
              onChange={(e) => setLegalPublish((prev) => ({ ...prev, useSource: e.target.checked }))}
            />
            Use legal source file (terms.md)
          </label>
          {!legalPublish.useSource && (
            <label className="block text-sm">
              Document content
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[160px]"
                value={legalPublish.content}
                onChange={(e) => setLegalPublish((prev) => ({ ...prev, content: e.target.value }))}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pill-btn-primary px-5" onClick={publishLegalDoc} disabled={legalLoading}>
              {legalLoading ? 'Publishing...' : 'Publish'}
            </button>
            <button type="button" className="pill-btn-ghost px-5" onClick={forceReconsent} disabled={legalLoading}>
              Force re-consent
            </button>
            <button type="button" className="pill-btn-ghost px-5" onClick={forceReconsentAll} disabled={legalLoading}>
              Force re-consent (all)
            </button>
          </div>
          {legalError && <div className="text-xs text-rose-600">{legalError}</div>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Latest published versions</h3>
            <p className="text-xs text-slate-500">Review the most recent legal versions.</p>
          </div>
          {legalLoading && <div className="text-sm text-slate-500">Loading...</div>}
          {!legalLoading && (
            <div className="space-y-2 text-sm">
              {legalDocs.length === 0 && <div className="text-slate-500">No legal documents found.</div>}
              {legalDocs.map((doc) => (
                <div
                  key={`${doc.type}-${doc.version}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{doc.type}</div>
                    <div className="text-xs text-slate-500">v{doc.version}</div>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(doc.publishedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Consent logs</h3>
            <p className="text-xs text-slate-500">Audit consent history for compliance.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="pill-btn-ghost px-4"
              onClick={loadLegalConsents}
              disabled={legalConsentLoading}
            >
              Refresh
            </button>
            <button type="button" className="pill-btn-primary px-4" onClick={exportLegalConsents}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            Document type
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={legalConsentFilters.type}
              onChange={(e) => setLegalConsentFilters((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="">All</option>
              {docTypes.map((type) => (
                <option key={`filter-${type}`} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Role
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={legalConsentFilters.role}
              onChange={(e) => setLegalConsentFilters((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="">All</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </label>
          <button type="button" className="pill-btn-primary px-4" onClick={loadLegalConsents} disabled={legalConsentLoading}>
            Apply filters
          </button>
        </div>
        {legalConsentLoading && <div className="text-sm text-slate-500">Loading consent logs...</div>}
        {!legalConsentLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Document</th>
                  <th className="py-2 pr-3">Version</th>
                  <th className="py-2 pr-3">Consented at</th>
                </tr>
              </thead>
              <tbody>
                {legalConsentLogs.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{row.email || `User #${row.userId}`}</td>
                    <td className="py-2 pr-3">{row.role}</td>
                    <td className="py-2 pr-3">{row.documentType}</td>
                    <td className="py-2 pr-3">{row.version}</td>
                    <td className="py-2 pr-3">{new Date(row.consentedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!legalConsentLogs.length && (
                  <tr>
                    <td className="py-3 text-slate-500" colSpan={5}>
                      No consent records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
