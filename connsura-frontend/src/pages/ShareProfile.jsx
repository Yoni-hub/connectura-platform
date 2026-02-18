import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ShareSummary from '../components/share/ShareSummary'
import ShareEditsStatusModal from '../components/modals/ShareEditsStatusModal'

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const normalizeSectionKey = (value) => String(value || '').trim().toLowerCase()

const hasNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.some(hasNonEmptyValue)
  if (typeof value === 'object') return Object.values(value).some(hasNonEmptyValue)
  return false
}

const hasSavedEntries = (entries) => Array.isArray(entries) && entries.some((entry) => hasNonEmptyValue(entry))

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not set'
  return String(value)
}

const normalizePassportSelection = (sections = {}) => {
  const selected = Array.isArray(sections?.passportV2?.products) ? sections.passportV2.products : []
  const map = new Map()
  selected.forEach((product) => {
    const productInstanceId = String(product?.productInstanceId || '').trim()
    if (!productInstanceId) return
    const keys = Array.isArray(product?.sectionKeys)
      ? product.sectionKeys.map((key) => normalizeSectionKey(key)).filter(Boolean)
      : []
    if (!keys.length) return
    map.set(productInstanceId, new Set(keys))
  })
  return map
}

const buildPassportEditProducts = (share) => {
  const snapshotProducts = Array.isArray(share?.snapshot?.passportV2?.products) ? share.snapshot.passportV2.products : []
  const selectedByProduct = normalizePassportSelection(share?.sections || {})
  const showSelectedOnly = selectedByProduct.size > 0
  return snapshotProducts
    .map((product) => {
      const productInstanceId = String(product?.productInstance?.id || '').trim()
      if (!productInstanceId) return null
      const allowedKeys = selectedByProduct.get(productInstanceId) || null
      if (showSelectedOnly && !allowedKeys) return null
      const responseByKey = new Map(
        (Array.isArray(product?.responses) ? product.responses : []).map((response) => [
          normalizeSectionKey(response?.sectionKey),
          response,
        ])
      )
      const sections = (Array.isArray(product?.sections) ? product.sections : [])
        .map((section) => {
          const sectionKey = normalizeSectionKey(section?.key)
          if (!sectionKey) return null
          if (allowedKeys && !allowedKeys.has(sectionKey)) return null
          const response = responseByKey.get(sectionKey)
          const entries = Array.isArray(response?.values?.entries)
            ? response.values.entries.filter((entry) => isPlainObject(entry))
            : []
          return {
            key: sectionKey,
            label: section?.label || sectionKey,
            fields: Array.isArray(section?.fields) ? section.fields : [],
            entries: entries.length ? entries : [{}],
          }
        })
        .filter(Boolean)
      if (!sections.length) return null
      return {
        productInstanceId,
        productName: product?.productInstance?.productName || 'Product',
        sections,
      }
    })
    .filter(Boolean)
}

const inputTypeForField = (field = {}) => {
  const type = String(field?.type || 'general').trim().toLowerCase()
  if (type === 'number' || type === 'date' || type === 'select' || type === 'yes/no') return type
  return 'text'
}

export default function ShareProfile() {
  const { token } = useParams()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [share, setShare] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savingEdits, setSavingEdits] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [viewerName, setViewerName] = useState('')
  const [endingSession, setEndingSession] = useState(false)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState('')
  const [passportEditProducts, setPassportEditProducts] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [sectionIndex, setSectionIndex] = useState(0)
  const [mode, setMode] = useState('form')
  const [editingIndex, setEditingIndex] = useState(0)
  const pendingStatusRef = useRef('')
  const lastActivityRef = useRef(Date.now())
  const isAwaitingApproval = approvalModalOpen && approvalStatus === 'pending'

  const accessCode = code.trim()
  const recipientName = viewerName.replace(/\s+/g, ' ').trim()
  const isEditable = Boolean(share?.editable)
  const isPassportEditable = Boolean(isEditable && share?.sections?.passportV2)

  const selectedProduct = useMemo(() => {
    if (!passportEditProducts.length) return null
    const exact = passportEditProducts.find((product) => product.productInstanceId === selectedProductId)
    return exact || passportEditProducts[0]
  }, [passportEditProducts, selectedProductId])

  const sections = Array.isArray(selectedProduct?.sections) ? selectedProduct.sections : []
  const activeSection = sections[sectionIndex] || null
  const activeEntriesRaw = Array.isArray(activeSection?.entries) ? activeSection.entries : []
  const activeEntries = mode === 'form' ? (activeEntriesRaw.length ? activeEntriesRaw : [{}]) : activeEntriesRaw
  const activeEntry = activeEntries[editingIndex] || {}

  const syncPendingStatus = (nextShare) => {
    if (!nextShare?.editable) return
    if (!approvalModalOpen) return
    const nextStatus = nextShare?.pendingStatus || ''
    if (!nextStatus) return
    if (pendingStatusRef.current !== nextStatus) {
      pendingStatusRef.current = nextStatus
      setApprovalStatus(nextStatus)
      return
    }
    setApprovalStatus(nextStatus)
  }

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const handleVerify = async () => {
    if (!accessCode) {
      toast.error('Enter the 4-digit code')
      return
    }
    if (!token) {
      toast.error('Invalid share link')
      return
    }
    setLoading(true)
    setError('')
    setSessionExpired(false)
    try {
      const res = await api.post(`/shares/${token}/verify`, {
        code: accessCode,
        name: recipientName,
        touch: true,
      })
      const nextShare = res.data?.share || null
      setShare(nextShare)
      markActivity()
      setSessionExpired(false)
      if (nextShare?.status === 'revoked' || nextShare?.status === 'expired') {
        setSessionExpired(true)
      }
    } catch (err) {
      if (err.response?.status === 410) {
        setSessionExpired(true)
        setError('Your session has expired.')
      } else {
        setError(err.response?.data?.error || 'Unable to verify code')
      }
      pendingStatusRef.current = ''
      setApprovalStatus('')
      setApprovalModalOpen(false)
      setShare(null)
    } finally {
      setLoading(false)
    }
  }

  const buildPassportEditsPayload = () => ({
    passportV2: {
      products: passportEditProducts.map((product) => ({
        productInstanceId: product.productInstanceId,
        responses: product.sections.map((section) => ({
          sectionKey: section.key,
          values: { entries: section.entries },
        })),
      })),
    },
  })

  const handleSubmitEdits = async () => {
    if (!token) return
    if (!accessCode) {
      toast.error('Enter the 4-digit code')
      return
    }
    if (!isPassportEditable) {
      toast.error('This share does not support Passport editing')
      return
    }
    const edits = buildPassportEditsPayload()
    if (!edits?.passportV2?.products?.length) {
      toast.error('No passport sections available to submit')
      return
    }
    setSavingEdits(true)
    try {
      const res = await api.post(`/shares/${token}/edits`, {
        code: accessCode,
        name: recipientName,
        edits,
      })
      const nextShare = res.data?.share || null
      pendingStatusRef.current = 'pending'
      setApprovalStatus('pending')
      setApprovalModalOpen(true)
      if (nextShare) {
        setShare(nextShare)
        syncPendingStatus(nextShare)
      }
    } catch (err) {
      if (err.response?.status === 410) {
        setSessionExpired(true)
      } else {
        toast.error(err.response?.data?.error || 'Unable to submit edits')
      }
    } finally {
      setSavingEdits(false)
    }
  }

  useEffect(() => {
    if (!token || !accessCode || !share || sessionExpired) return
    const interval = setInterval(async () => {
      try {
        const recentlyActive = Date.now() - lastActivityRef.current < 60000
        const res = await api.post(`/shares/${token}/verify`, {
          code: accessCode,
          name: recipientName,
          touch: recentlyActive,
        })
        const nextShare = res.data?.share || null
        if (nextShare) {
          setShare(nextShare)
          syncPendingStatus(nextShare)
        }
        if (nextShare?.status === 'revoked' || nextShare?.status === 'expired') {
          setSessionExpired(true)
        }
      } catch (err) {
        if (err.response?.status === 410) setSessionExpired(true)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [token, accessCode, share, recipientName, sessionExpired, isEditable])

  useEffect(() => {
    if (!share || sessionExpired) return
    const handleActivity = () => markActivity()
    window.addEventListener('mousemove', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('click', handleActivity, { passive: true })
    window.addEventListener('scroll', handleActivity, { passive: true })
    window.addEventListener('touchstart', handleActivity, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
    }
  }, [share, sessionExpired, markActivity])

  useEffect(() => {
    if (!isPassportEditable) {
      setPassportEditProducts([])
      setSelectedProductId('')
      setSectionIndex(0)
      setMode('form')
      setEditingIndex(0)
      return
    }
    const products = buildPassportEditProducts(share)
    setPassportEditProducts(products)
    const firstProductId = products[0]?.productInstanceId || ''
    setSelectedProductId(firstProductId)
    setSectionIndex(0)
    const firstEntries = products[0]?.sections?.[0]?.entries || []
    setMode(hasSavedEntries(firstEntries) ? 'summary' : 'form')
    setEditingIndex(0)
  }, [isPassportEditable, share?.token])

  useEffect(() => {
    if (!share || sessionExpired || !token || !accessCode) return
    const interval = setInterval(async () => {
      const inactiveMs = Date.now() - lastActivityRef.current
      if (inactiveMs < 10 * 60 * 1000) return
      try {
        await api.post(`/shares/${token}/close`, { code: accessCode, name: recipientName })
      } catch {
        // ignored
      } finally {
        setSessionExpired(true)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [share, sessionExpired, token, accessCode, recipientName])

  useEffect(() => {
    if (!sessionExpired) return
    pendingStatusRef.current = ''
    setApprovalStatus('')
    setApprovalModalOpen(false)
  }, [sessionExpired])

  useEffect(() => {
    if (!isAwaitingApproval || typeof document === 'undefined') return
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
  }, [isAwaitingApproval])

  const handleEndSession = async () => {
    if (!token || !accessCode) {
      toast.error('Enter the access code first')
      return
    }
    setEndingSession(true)
    try {
      await api.post(`/shares/${token}/close`, { code: accessCode, name: recipientName })
      setSessionExpired(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to close the session')
    } finally {
      setEndingSession(false)
    }
  }

  const updatePassportState = (updater) => {
    setPassportEditProducts((prev) => {
      const next = updater(prev)
      return Array.isArray(next) ? next : prev
    })
    markActivity()
  }

  const updateCurrentField = (fieldKey, value) => {
    if (!selectedProduct || !activeSection) return
    updatePassportState((prev) =>
      prev.map((product) => {
        if (product.productInstanceId !== selectedProduct.productInstanceId) return product
        return {
          ...product,
          sections: product.sections.map((section) => {
            if (section.key !== activeSection.key) return section
            const entries = [...(Array.isArray(section.entries) ? section.entries : [])]
            const idx = Math.max(0, Math.min(editingIndex, Math.max(entries.length - 1, 0)))
            const base = isPlainObject(entries[idx]) ? entries[idx] : {}
            entries[idx] = { ...base, [fieldKey]: value }
            return { ...section, entries }
          }),
        }
      })
    )
  }

  const editEntry = (entryIndex) => {
    setEditingIndex(entryIndex)
    setMode('form')
  }

  const removeEntry = (entryIndex) => {
    if (!selectedProduct || !activeSection) return
    updatePassportState((prev) =>
      prev.map((product) => {
        if (product.productInstanceId !== selectedProduct.productInstanceId) return product
        return {
          ...product,
          sections: product.sections.map((section) => {
            if (section.key !== activeSection.key) return section
            const nextEntries = (section.entries || []).filter((_, idx) => idx !== entryIndex)
            return { ...section, entries: nextEntries.length ? nextEntries : [{}] }
          }),
        }
      })
    )
    setEditingIndex(0)
  }

  const addMoreCurrentSection = () => {
    if (!selectedProduct || !activeSection) return
    updatePassportState((prev) =>
      prev.map((product) => {
        if (product.productInstanceId !== selectedProduct.productInstanceId) return product
        return {
          ...product,
          sections: product.sections.map((section) => {
            if (section.key !== activeSection.key) return section
            return { ...section, entries: [...(section.entries || []), {}] }
          }),
        }
      })
    )
    setEditingIndex(activeEntriesRaw.length)
    setMode('form')
  }

  const goNextSection = () => {
    if (sectionIndex >= sections.length - 1) {
      toast.success('All sections completed')
      return
    }
    const nextIndex = sectionIndex + 1
    const nextEntries = sections[nextIndex]?.entries || []
    setSectionIndex(nextIndex)
    setEditingIndex(0)
    setMode(hasSavedEntries(nextEntries) ? 'summary' : 'form')
  }

  const goBackSection = () => {
    if (sectionIndex <= 0) return
    const prevIndex = sectionIndex - 1
    const prevEntries = sections[prevIndex]?.entries || []
    setSectionIndex(prevIndex)
    setEditingIndex(0)
    setMode(hasSavedEntries(prevEntries) ? 'summary' : 'form')
  }

  const renderSummaryCard = (entry, index) => (
    <div key={`${activeSection?.key}-entry-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {activeSection?.label} #{index + 1}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {(activeSection?.fields || []).map((field) => (
          <div key={`${field.key}-${index}`} className="flex items-baseline gap-1">
            <span className="font-semibold text-slate-900">{field.label}:</span>
            <span className="text-green-700">{formatValue(entry?.[field.key])}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="pill-btn-ghost px-3 py-1 text-xs" onClick={() => editEntry(index)}>
          Edit
        </button>
        <button type="button" className="pill-btn-ghost px-3 py-1 text-xs text-red-600" onClick={() => removeEntry(index)}>
          Remove
        </button>
      </div>
    </div>
  )

  return (
    <main className="page-shell py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Shared insurance profile</h1>
          <p className="text-slate-500">Enter the 4-digit code from the customer to unlock their profile.</p>
        </div>

        <div className="surface p-5 max-w-xl space-y-3">
          <label className="block text-sm">
            Access code
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="1234"
            />
          </label>
          <label className="block text-sm">
            Recipient name (for public links)
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={viewerName}
              onChange={(event) => setViewerName(event.target.value)}
              placeholder="Enter the name shared by the customer"
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" className="pill-btn-primary px-5" onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying...' : 'Unlock profile'}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {sessionExpired && (
          <div className="surface p-5 max-w-xl space-y-3">
            <div className="text-lg font-semibold text-slate-900">Your session has expired</div>
            <div className="text-sm text-slate-600">This share is no longer active.</div>
            <button type="button" className="pill-btn-primary px-5" onClick={() => nav('/')}>
              Close
            </button>
          </div>
        )}

        {share && !sessionExpired && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">Shared by {share.customer?.name || 'a customer'}.</div>
            {isEditable ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  You can edit the shared sections. Changes will be sent to the client for approval.
                </div>
                {!isPassportEditable && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This link is not a Passport-edit share. Passport editor is required for editable access.
                  </div>
                )}
                {isPassportEditable && selectedProduct && activeSection && (
                  <div className={isAwaitingApproval ? 'pointer-events-none select-none opacity-60' : ''} aria-disabled={isAwaitingApproval}>
                    <div className="surface p-5 space-y-3">
                      <h3 className="text-lg font-semibold text-slate-900">My Passport</h3>
                      <label className="block text-sm font-semibold text-slate-700">
                        Insurance product
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={selectedProduct.productInstanceId}
                          onChange={(event) => {
                            setSelectedProductId(event.target.value)
                            setSectionIndex(0)
                            const nextProduct = passportEditProducts.find((item) => item.productInstanceId === event.target.value)
                            const nextEntries = nextProduct?.sections?.[0]?.entries || []
                            setMode(hasSavedEntries(nextEntries) ? 'summary' : 'form')
                            setEditingIndex(0)
                          }}
                        >
                          {passportEditProducts.map((product) => (
                            <option key={product.productInstanceId} value={product.productInstanceId}>
                              {product.productName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="surface p-5 mt-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Section {sectionIndex + 1} of {sections.length}
                          </div>
                          <h4 className="text-lg font-semibold text-slate-900">{activeSection.label}</h4>
                        </div>
                        {sectionIndex > 0 && (
                          <button type="button" className="pill-btn-ghost px-4" onClick={goBackSection}>
                            Back
                          </button>
                        )}
                      </div>

                      {mode === 'form' && (
                        <div className="space-y-3">
                          {(activeSection.fields || []).map((field) => {
                            const fieldType = inputTypeForField(field)
                            const fieldValue = activeEntry?.[field.key] ?? ''
                            if (fieldType === 'select' || fieldType === 'yes/no') {
                              const options =
                                Array.isArray(field?.options) && field.options.length
                                  ? field.options
                                  : fieldType === 'yes/no'
                                    ? ['Yes', 'No']
                                    : []
                              return (
                                <label key={field.key} className="block space-y-1 text-sm text-slate-700">
                                  <div>{field.label}</div>
                                  <select
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    value={fieldValue}
                                    onChange={(event) => updateCurrentField(field.key, event.target.value)}
                                  >
                                    <option value="">Select</option>
                                    {options.map((option) => (
                                      <option key={`${field.key}-${option}`} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )
                            }
                            return (
                              <label key={field.key} className="block space-y-1 text-sm text-slate-700">
                                <div>{field.label}</div>
                                <input
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                  type={fieldType === 'number' || fieldType === 'date' ? fieldType : 'text'}
                                  value={fieldValue}
                                  onChange={(event) => updateCurrentField(field.key, event.target.value)}
                                />
                              </label>
                            )
                          })}
                          <div className="pt-2">
                            <button type="button" className="pill-btn-primary px-5" onClick={() => setMode('summary')}>
                              Next
                            </button>
                          </div>
                        </div>
                      )}

                      {mode === 'summary' && (
                        <div className="space-y-3">
                          {activeEntriesRaw.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                              No entries in this section yet.
                            </div>
                          )}
                          {activeEntriesRaw.map((entry, index) => renderSummaryCard(entry, index))}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button type="button" className="pill-btn-ghost px-4" onClick={addMoreCurrentSection}>
                              Add more
                            </button>
                            <button type="button" className="pill-btn-primary px-4" onClick={goNextSection}>
                              Continue
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">Submit changes when you are done editing.</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="pill-btn-ghost px-5"
                      onClick={handleEndSession}
                      disabled={endingSession || isAwaitingApproval}
                    >
                      {endingSession ? 'Ending...' : 'End session'}
                    </button>
                    <button
                      type="button"
                      className="pill-btn-primary px-6"
                      onClick={handleSubmitEdits}
                      disabled={savingEdits || isAwaitingApproval || !isPassportEditable}
                    >
                      {savingEdits ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ShareSummary snapshot={share.snapshot} sections={share.sections} />
                <div className="flex justify-end">
                  <button type="button" className="pill-btn-ghost px-5" onClick={handleEndSession} disabled={endingSession}>
                    {endingSession ? 'Ending...' : 'End session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ShareEditsStatusModal open={approvalModalOpen} status={approvalStatus} onClose={() => setApprovalModalOpen(false)} />
    </main>
  )
}
