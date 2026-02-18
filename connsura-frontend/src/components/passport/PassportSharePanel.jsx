import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../../services/api'
import ShareSummary from '../share/ShareSummary'

const SHARE_FLOW_STORAGE_KEY = 'connsura_passport_share_flow_v1'
const SHARE_FLOW_RESET_EVENT = 'connsura:passport-share-reset'
const SECTION_LABELS = {
  household: 'Household',
  address: 'Address',
  additional: 'Additional',
}
const FIELD_LABELS = {
  relation: 'Relation to Applicant',
  'first-name': 'First Name',
  'middle-initial': 'Middle Initial',
  'last-name': 'Last Name',
  suffix: 'Suffix',
  dob: 'Date of Birth',
  gender: 'Gender',
  'marital-status': 'Marital Status',
  'education-level': 'Education Level',
  employment: 'Employment',
  occupation: 'Occupation',
  'driver-status': 'Driver Status',
  'license-type': "Driver's License Type",
  'license-status': 'License Status',
  'years-licensed': 'Years Licensed',
  'license-state': 'License State',
  'license-number': 'License Number',
  'accident-prevention': 'Accident Prevention Course',
  sr22: 'SR-22 Required',
  fr44: 'FR-44 Required',
  phone1: 'Phone #1',
  phone2: 'Phone #2',
  email1: 'Email Address #1',
  email2: 'Email Address #2',
  address1: 'Address 1',
  city: 'City',
  state: 'State',
  zip: 'Zip Code',
}

const buildShareUrl = (token) => `${window.location.origin}/share/${token}`

const copyText = async (value, label) => {
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const field = document.createElement('textarea')
      field.value = value
      field.setAttribute('readonly', '')
      field.style.position = 'absolute'
      field.style.left = '-9999px'
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      document.body.removeChild(field)
    }
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Unable to copy ${label.toLowerCase()}`)
  }
}

const normalizeProducts = (snapshot) => {
  const products = Array.isArray(snapshot?.passportV2?.products) ? snapshot.passportV2.products : []
  return products
    .map((product) => {
      const productInstanceId = String(product?.productInstance?.id || '').trim()
      if (!productInstanceId) return null
      const responses = Array.isArray(product?.responses) ? product.responses : []
      const responseByKey = new Map(
        responses.map((response) => [String(response?.sectionKey || '').trim().toLowerCase(), response])
      )
      const sections = Array.isArray(product?.sections) ? product.sections : []
      const filledSections = sections
        .map((section) => {
          const sectionKey = String(section?.key || '').trim().toLowerCase()
          if (!sectionKey) return null
          const response = responseByKey.get(sectionKey)
          const entries = Array.isArray(response?.values?.entries) ? response.values.entries : []
          if (!entries.length) return null
          return {
            key: sectionKey,
            label: section?.label || sectionKey,
          }
        })
        .filter(Boolean)
      if (!filledSections.length) return null
      return {
        productInstanceId,
        productName: product?.productInstance?.productName || 'Product',
        sections: filledSections,
      }
    })
    .filter(Boolean)
}

const createSelection = (products) => {
  const selection = {}
  products.forEach((product) => {
    selection[product.productInstanceId] = {
      allSections: true,
      sectionKeys: product.sections.map((section) => section.key),
    }
  })
  return selection
}

const selectionToPayload = (products, selection) => ({
  passportV2: {
    products: products
      .map((product) => {
        const chosen = selection[product.productInstanceId]
        if (!chosen) return null
        const selectedKeys = Array.isArray(chosen.sectionKeys) ? chosen.sectionKeys : []
        if (!selectedKeys.length) return null
        const allKeys = product.sections.map((section) => section.key)
        const uniqueKeys = Array.from(new Set(selectedKeys))
        return {
          productInstanceId: product.productInstanceId,
          allSections: uniqueKeys.length === allKeys.length,
          sectionKeys: uniqueKeys,
        }
      })
      .filter(Boolean),
  },
})

const loadPersistedShareFlow = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SHARE_FLOW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

const persistShareFlow = (state) => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SHARE_FLOW_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

const clearPersistedShareFlow = () => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SHARE_FLOW_STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}

const reconcileSelection = (products, currentSelection = {}, fallbackSelection = {}) => {
  const next = {}
  products.forEach((product) => {
    const keys = product.sections.map((section) => section.key)
    const fromCurrent = Array.isArray(currentSelection?.[product.productInstanceId]?.sectionKeys)
      ? currentSelection[product.productInstanceId].sectionKeys
      : null
    const fromFallback = Array.isArray(fallbackSelection?.[product.productInstanceId]?.sectionKeys)
      ? fallbackSelection[product.productInstanceId].sectionKeys
      : null
    const source = fromCurrent || fromFallback || keys
    const filtered = source.filter((key) => keys.includes(key))
    next[product.productInstanceId] = {
      allSections: filtered.length === keys.length,
      sectionKeys: filtered,
    }
  })
  return next
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const normalizeValue = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)).filter(Boolean).join(', ')
  }
  return ''
}

const prettifyPath = (path = '') => {
  if (!path) return 'Field'
  const cleaned = path.replace(/\[(\d+)\]/g, ' $1')
  const parts = cleaned
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => FIELD_LABELS[part] || part.replace(/[-_]/g, ' '))
    .map((part) => part.replace(/\b\w/g, (char) => char.toUpperCase()))
  return parts[parts.length - 1] || 'Field'
}

const resolveQuestionLabel = (path = '', fieldLabels = new Map()) => {
  const parts = String(path)
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
  const leaf = parts[parts.length - 1] || ''
  const normalizedLeaf = leaf.replace(/\[(\d+)\]/g, '').trim()
  if (normalizedLeaf && fieldLabels instanceof Map && fieldLabels.has(normalizedLeaf)) {
    return fieldLabels.get(normalizedLeaf)
  }
  return prettifyPath(path)
}

const flattenChangedFields = (beforeValue, afterValue, path = '') => {
  if (Array.isArray(afterValue) || Array.isArray(beforeValue)) {
    const beforeItems = Array.isArray(beforeValue) ? beforeValue : []
    const afterItems = Array.isArray(afterValue) ? afterValue : []
    const count = Math.max(beforeItems.length, afterItems.length)
    return Array.from({ length: count }).flatMap((_, index) =>
      flattenChangedFields(
        beforeItems[index],
        afterItems[index],
        path ? `${path}[${index + 1}]` : `[${index + 1}]`
      )
    )
  }
  if (isObject(afterValue) || isObject(beforeValue)) {
    const beforeObj = isObject(beforeValue) ? beforeValue : {}
    const afterObj = isObject(afterValue) ? afterValue : {}
    const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]))
    return keys.flatMap((key) =>
      flattenChangedFields(
        beforeObj[key],
        afterObj[key],
        path ? `${path}.${key}` : key
      )
    )
  }
  const beforeText = normalizeValue(beforeValue)
  const afterText = normalizeValue(afterValue)
  if (!path || beforeText === afterText) return []
  return [{ path, answer: afterText || '-' }]
}

const extractAdditionalChanges = (beforeAdditional, afterAdditional) => {
  const beforeForms = Array.isArray(beforeAdditional?.additionalForms) ? beforeAdditional.additionalForms : []
  const afterForms = Array.isArray(afterAdditional?.additionalForms) ? afterAdditional.additionalForms : []
  const rows = []
  afterForms.forEach((form, formIndex) => {
    const productName = String(form?.productName || form?.name || '').trim()
    const beforeQuestions = Array.isArray(beforeForms[formIndex]?.questions) ? beforeForms[formIndex].questions : []
    const afterQuestions = Array.isArray(form?.questions) ? form.questions : []
    afterQuestions.forEach((question, questionIndex) => {
      const questionText = String(question?.question || '').trim()
      const answerText = normalizeValue(question?.input)
      const beforeQuestion = beforeQuestions[questionIndex] || {}
      const beforeQuestionText = String(beforeQuestion?.question || '').trim()
      const beforeAnswerText = normalizeValue(beforeQuestion?.input)
      if (questionText === beforeQuestionText && answerText === beforeAnswerText) return
      rows.push({
        section: SECTION_LABELS.additional,
        productName: productName || `Additional Form ${formIndex + 1}`,
        question: questionText || `Question ${questionIndex + 1}`,
        answer: answerText || '-',
      })
    })
  })
  return rows
}

const toPassportProductMap = (passport = {}) => {
  const products = Array.isArray(passport?.products) ? passport.products : []
  const map = new Map()
  products.forEach((product) => {
    const productInstanceId = String(product?.productInstance?.id || product?.productInstanceId || '').trim()
    if (!productInstanceId) return
    const sectionLabels = new Map(
      (Array.isArray(product?.sections) ? product.sections : [])
        .map((section) => [
          String(section?.key || '').trim().toLowerCase(),
          String(section?.label || section?.key || '').trim(),
        ])
        .filter(([key]) => Boolean(key))
    )
    const sectionFieldLabels = new Map(
      (Array.isArray(product?.sections) ? product.sections : [])
        .map((section) => {
          const sectionKey = String(section?.key || '').trim().toLowerCase()
          const labels = new Map(
            (Array.isArray(section?.fields) ? section.fields : [])
              .map((field) => [String(field?.key || '').trim(), String(field?.label || field?.key || '').trim()])
              .filter(([key]) => Boolean(key))
          )
          return [sectionKey, labels]
        })
        .filter(([key]) => Boolean(key))
    )
    const responses = new Map(
      (Array.isArray(product?.responses) ? product.responses : [])
        .map((response) => [
          String(response?.sectionKey || '').trim().toLowerCase(),
          isObject(response?.values) ? response.values : {},
        ])
        .filter(([key]) => Boolean(key))
    )
    map.set(productInstanceId, {
      productName: String(product?.productInstance?.productName || product?.productName || 'Product').trim(),
      sectionLabels,
      sectionFieldLabels,
      responses,
    })
  })
  return map
}

export default function PassportSharePanel({
  snapshot,
  reviewShare = null,
  reviewCurrentForms = {},
  onApproveReview,
  onDeclineReview,
  onDismissReview,
}) {
  const persistedOnLoadRef = useRef(loadPersistedShareFlow())
  const products = useMemo(() => normalizeProducts(snapshot), [snapshot])
  const [selection, setSelection] = useState(() => createSelection(products))
  const [step, setStep] = useState(() => {
    const persisted = persistedOnLoadRef.current?.step
    return persisted === 'method' ? 'method' : 'sections'
  })
  const [activeMethod, setActiveMethod] = useState(() => {
    const persisted = persistedOnLoadRef.current?.activeMethod
    return persisted === 'link' || persisted === 'pdf' ? persisted : null
  })
  const [accessMode, setAccessMode] = useState(() => {
    const persisted = persistedOnLoadRef.current?.accessMode
    return persisted === 'edit' ? 'edit' : 'read'
  })
  const [recipientName, setRecipientName] = useState(() => String(persistedOnLoadRef.current?.recipientName || ''))
  const [shareLoading, setShareLoading] = useState(false)
  const [linkShare, setLinkShare] = useState(() => persistedOnLoadRef.current?.linkShare || null)
  const [showShareConsent, setShowShareConsent] = useState(false)
  const [dataSharingConsented, setDataSharingConsented] = useState(
    () => persistedOnLoadRef.current?.dataSharingConsented === true
  )
  const [shareConsentChecks, setShareConsentChecks] = useState({
    shareProfile: false,
    exportData: false,
    notResponsible: false,
  })
  const pendingActionRef = useRef(null)

  const resetToFirstStage = () => {
    setStep('sections')
    setActiveMethod(null)
    setAccessMode('read')
    setRecipientName('')
    setLinkShare(null)
    setShowShareConsent(false)
    pendingActionRef.current = null
    setSelection(createSelection(products))
    clearPersistedShareFlow()
  }

  useEffect(() => {
    const fallbackSelection = persistedOnLoadRef.current?.selection || {}
    setSelection((current) => reconcileSelection(products, current, fallbackSelection))
  }, [products])

  useEffect(() => {
    if (!showShareConsent) return
    setShareConsentChecks({ shareProfile: false, exportData: false, notResponsible: false })
  }, [showShareConsent])

  useEffect(() => {
    const payload = {
      step,
      activeMethod,
      accessMode,
      recipientName,
      linkShare,
      selection,
      dataSharingConsented,
    }
    persistShareFlow(payload)
  }, [step, activeMethod, accessMode, recipientName, linkShare, selection, dataSharingConsented])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleReset = () => resetToFirstStage()
    window.addEventListener(SHARE_FLOW_RESET_EVENT, handleReset)
    return () => window.removeEventListener(SHARE_FLOW_RESET_EVENT, handleReset)
  }, [products])

  const sectionsPayload = useMemo(() => selectionToPayload(products, selection), [products, selection])
  const reviewChanges = useMemo(() => {
    if (!reviewShare) return []
    const pendingForms = reviewShare?.pendingEdits?.forms || {}
    const baselineForms = reviewCurrentForms || reviewShare?.snapshot?.forms || {}
    const rows = []
    const sectionKeys = Object.keys(pendingForms || {}).filter(Boolean)
    sectionKeys.forEach((sectionKey) => {
      if (sectionKey === 'additional') {
        rows.push(...extractAdditionalChanges(baselineForms.additional, pendingForms.additional))
        return
      }
      const sectionRows = flattenChangedFields(baselineForms?.[sectionKey], pendingForms?.[sectionKey])
      sectionRows.forEach((row) => {
        rows.push({
          section: SECTION_LABELS[sectionKey] || sectionKey,
          question: prettifyPath(row.path),
          answer: row.answer,
        })
      })
    })
    const pendingPassportProducts = Array.isArray(reviewShare?.pendingEdits?.passportV2?.products)
      ? reviewShare.pendingEdits.passportV2.products
      : []
    const baselinePassportByProduct = toPassportProductMap(reviewShare?.snapshot?.passportV2 || {})
    pendingPassportProducts.forEach((product) => {
      const productInstanceId = String(product?.productInstanceId || '').trim()
      if (!productInstanceId) return
      const baselineProduct = baselinePassportByProduct.get(productInstanceId)
      const productName = baselineProduct?.productName || 'Product'
      const pendingResponses = Array.isArray(product?.responses) ? product.responses : []
      pendingResponses.forEach((response) => {
        const sectionKey = String(response?.sectionKey || '').trim().toLowerCase()
        if (!sectionKey) return
        const baselineValues = baselineProduct?.responses?.get(sectionKey)
        const incomingValues = isObject(response?.values) ? response.values : {}
        const fieldLabels = baselineProduct?.sectionFieldLabels?.get(sectionKey) || new Map()
        const sectionRows = flattenChangedFields(baselineValues, incomingValues)
        sectionRows.forEach((row) => {
          rows.push({
            section:
              baselineProduct?.sectionLabels?.get(sectionKey) ||
              sectionKey.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
            productName,
            question: resolveQuestionLabel(row.path, fieldLabels),
            answer: row.answer,
          })
        })
      })
    })
    return rows
  }, [reviewShare, reviewCurrentForms])

  const hasSelection = useMemo(
    () => sectionsPayload.passportV2.products.some((product) => product.sectionKeys.length > 0),
    [sectionsPayload]
  )

  const allSelected = useMemo(() => {
    if (!products.length) return false
    return products.every((product) => {
      const chosen = selection[product.productInstanceId]
      if (!chosen) return false
      return chosen.sectionKeys.length === product.sections.length
    })
  }, [products, selection])

  const toggleShareAll = () => {
    if (allSelected) {
      const next = {}
      products.forEach((product) => {
        next[product.productInstanceId] = { allSections: false, sectionKeys: [] }
      })
      setSelection(next)
      return
    }
    setSelection(createSelection(products))
  }

  const toggleProductAll = (product) => {
    setSelection((prev) => {
      const existing = prev[product.productInstanceId] || { allSections: false, sectionKeys: [] }
      const nextAll = !existing.allSections || existing.sectionKeys.length !== product.sections.length
      return {
        ...prev,
        [product.productInstanceId]: {
          allSections: nextAll,
          sectionKeys: nextAll ? product.sections.map((section) => section.key) : [],
        },
      }
    })
  }

  const toggleSection = (product, sectionKey) => {
    setSelection((prev) => {
      const existing = prev[product.productInstanceId] || { allSections: false, sectionKeys: [] }
      const nextKeys = new Set(existing.sectionKeys)
      if (nextKeys.has(sectionKey)) {
        nextKeys.delete(sectionKey)
      } else {
        nextKeys.add(sectionKey)
      }
      const finalKeys = Array.from(nextKeys)
      return {
        ...prev,
        [product.productInstanceId]: {
          allSections: finalKeys.length === product.sections.length,
          sectionKeys: finalKeys,
        },
      }
    })
  }

  const createShare = async () => {
    if (!snapshot) {
      toast.error('Passport snapshot not ready')
      return null
    }
    setShareLoading(true)
    try {
      const payload = {
        sections: sectionsPayload,
        snapshot,
        editable: accessMode === 'edit',
      }
      const trimmedRecipientName = recipientName.replace(/\s+/g, ' ').trim()
      if (!trimmedRecipientName) {
        toast.error('Enter the recipient name')
        return null
      }
      payload.recipientName = trimmedRecipientName
      const res = await api.post('/shares', payload)
      return res.data
    } catch (err) {
      if (err.response?.data?.code === 'CONSENT_REQUIRED') {
        setDataSharingConsented(false)
        setShowShareConsent(true)
        return null
      }
      toast.error(err.response?.data?.error || 'Unable to create share link')
      return null
    } finally {
      setShareLoading(false)
    }
  }

  const startShareAction = (action) => {
    if (dataSharingConsented) {
      void action()
      return
    }
    pendingActionRef.current = action
    setShowShareConsent(true)
  }

  const allShareConsentsChecked =
    shareConsentChecks.shareProfile && shareConsentChecks.exportData && shareConsentChecks.notResponsible

  const handleShareConsentConfirm = async () => {
    if (!allShareConsentsChecked) {
      toast.error('Please accept all required sharing consents.')
      return
    }
    try {
      await api.post('/legal/consent', {
        documentType: 'data-sharing',
        consentItems: {
          shareProfile: true,
          exportData: true,
          notResponsible: true,
        },
      })
      setDataSharingConsented(true)
      setShowShareConsent(false)
      const action = pendingActionRef.current
      pendingActionRef.current = null
      if (action) void action()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to save consent')
    }
  }

  const handleGenerateLink = async () => {
    if (!hasSelection) {
      toast.error('Select at least one section to share')
      return
    }
    startShareAction(async () => {
      if (linkShare || shareLoading) return
      const share = await createShare()
      if (share) setLinkShare(share)
    })
  }

  const renderShareDetails = (shareData) => {
    if (!shareData?.share?.token) return null
    const shareUrl = buildShareUrl(shareData.share.token)
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Share link</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:flex-1">
              {shareUrl}
            </div>
            <button type="button" className="pill-btn-ghost w-full px-3 sm:w-auto" onClick={() => copyText(shareUrl, 'Link')}>
              Copy link
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Access code</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-lg font-semibold tracking-[0.2em] text-slate-700 sm:flex-1 sm:text-left">
              {shareData.code}
            </div>
            <button type="button" className="pill-btn-ghost w-full px-3 sm:w-auto" onClick={() => copyText(shareData.code, 'Code')}>
              Copy code
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="surface p-5 space-y-4">
      {reviewShare ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-slate-900">Review profile edits</div>
            {onDismissReview && (
              <button type="button" className="pill-btn-ghost px-4" onClick={onDismissReview}>
                Close
              </button>
            )}
          </div>
          <div className="text-sm text-slate-600">
            {`Edits submitted by ${reviewShare?.recipientName || 'a shared link'}.`}
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {reviewChanges.length ? (
              reviewChanges.map((change, index) => (
                <div key={`${change.section}-${change.question}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{change.section}</div>
                  {change.productName && <div className="mt-1 text-sm text-slate-600">{change.productName}</div>}
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {change.question}: {change.answer}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No changes detected.
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="pill-btn-ghost px-4" onClick={onDeclineReview}>
              Decline & stop sharing
            </button>
            <button type="button" className="pill-btn-primary px-5" onClick={onApproveReview}>
              Accept changes
            </button>
          </div>
        </div>
      ) : step === 'sections' ? (
        <>
          <div className="text-sm text-slate-600">
            Choose filled products and sections to share. Recipients can receive read-only access, PDF, or editable access.
          </div>
          {!products.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No filled passport sections available yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleShareAll} />
                  Share all filled sections
                </label>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="passport-share-access"
                      className="h-4 w-4"
                      checked={accessMode === 'read'}
                      onChange={() => setAccessMode('read')}
                    />
                    Read only
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="passport-share-access"
                      className="h-4 w-4"
                      checked={accessMode === 'edit'}
                      onChange={() => setAccessMode('edit')}
                    />
                    Allow edits
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                {products.map((product) => {
                  const selected = selection[product.productInstanceId] || { allSections: false, sectionKeys: [] }
                  return (
                    <div key={product.productInstanceId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <label className="flex items-center gap-3 text-sm font-semibold">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selected.sectionKeys.length === product.sections.length}
                          onChange={() => toggleProductAll(product)}
                        />
                        {product.productName}
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2 pl-7">
                        {product.sections.map((section) => (
                          <label key={`${product.productInstanceId}-${section.key}`} className="flex items-center gap-3 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selected.sectionKeys.includes(section.key)}
                              onChange={() => toggleSection(product, section.key)}
                            />
                            {section.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="pill-btn-primary px-5"
              onClick={() => {
                if (!hasSelection) {
                  toast.error('Select at least one section to share')
                  return
                }
                setStep('method')
              }}
              disabled={!products.length}
            >
              Continue
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <div>Choose how to share your selected passport sections.</div>
            <button
              type="button"
              className="text-sm font-semibold text-[#006aff] hover:underline"
              onClick={() => {
                setStep('sections')
                setActiveMethod(null)
                setLinkShare(null)
              }}
            >
              Change selections
            </button>
          </div>

          <div className={`grid gap-3 ${accessMode === 'edit' ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                activeMethod === 'link'
                  ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setActiveMethod('link')}
            >
              Share with link
            </button>
            {accessMode !== 'edit' && (
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  activeMethod === 'pdf'
                    ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                onClick={() => setActiveMethod('pdf')}
              >
                Share as PDF
              </button>
            )}
          </div>

          {activeMethod === 'link' && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-600">
                Create a secure link with a 4-digit access code for the selected passport data.
              </div>
              <label className="block text-sm">
                Recipient name
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={recipientName}
                  onChange={(event) => {
                    setRecipientName(event.target.value)
                    if (linkShare) setLinkShare(null)
                  }}
                  placeholder="e.g., John Doe"
                />
              </label>
              <button type="button" className="pill-btn-primary px-5" onClick={handleGenerateLink} disabled={shareLoading}>
                {shareLoading ? 'Creating...' : 'Create link'}
              </button>
              {linkShare && renderShareDetails(linkShare)}
              {linkShare && (
                <div className="flex justify-end">
                  <button type="button" className="pill-btn-ghost px-4" onClick={resetToFirstStage}>
                    Close
                  </button>
                </div>
              )}
            </div>
          )}

          {activeMethod === 'pdf' && accessMode !== 'edit' && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-600">Preview your PDF before printing.</div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <ShareSummary snapshot={snapshot} sections={sectionsPayload} />
              </div>
              <div className="flex justify-end">
                <button type="button" className="pill-btn-primary px-5" onClick={() => window.print()}>
                  Print to PDF
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showShareConsent && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 text-sm text-slate-700">
          <p>Before sharing your profile, please confirm the following:</p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={shareConsentChecks.shareProfile}
              onChange={(e) => setShareConsentChecks((prev) => ({ ...prev, shareProfile: e.target.checked }))}
            />
            I consent to sharing my insurance profile with this recipient
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={shareConsentChecks.exportData}
              onChange={(e) => setShareConsentChecks((prev) => ({ ...prev, exportData: e.target.checked }))}
            />
            I understand the recipient may export and store my data
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={shareConsentChecks.notResponsible}
              onChange={(e) => setShareConsentChecks((prev) => ({ ...prev, notResponsible: e.target.checked }))}
            />
            I understand Connsura is not responsible after export
          </label>
          <div className="text-xs text-slate-500">
            Review the full{' '}
            <a className="underline" href="/data-sharing" target="_blank" rel="noreferrer">
              Data Sharing policy
            </a>
            .
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="pill-btn-primary px-5"
              onClick={handleShareConsentConfirm}
              disabled={!allShareConsentsChecked}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
