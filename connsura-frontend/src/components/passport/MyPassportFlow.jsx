import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../../services/api'
import PassportSharePanel from './PassportSharePanel'

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
const PASSPORT_UI_STORAGE_KEY = 'connsura_passport_ui_state_v1'
const SHARE_FLOW_STORAGE_KEY = 'connsura_passport_share_flow_v1'

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeLoadedEntries = (values) => {
  if (Array.isArray(values?.entries)) {
    return values.entries.filter((entry) => isPlainObject(entry))
  }
  if (isPlainObject(values) && Object.keys(values).length > 0) {
    return [values]
  }
  return []
}

const ensureEntry = (entries) => (entries.length ? entries : [{}])

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not set'
  return String(value)
}

const hasNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.some(hasNonEmptyValue)
  if (typeof value === 'object') return Object.values(value).some(hasNonEmptyValue)
  return false
}

const hasSavedEntries = (entries) => Array.isArray(entries) && entries.some((entry) => hasNonEmptyValue(entry))

const loadPassportUiState = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PASSPORT_UI_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

const persistPassportUiState = (state) => {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PASSPORT_UI_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

export default function MyPassportFlow({
  products = [],
  productsLoading = false,
  selectedProductId = '',
  onSelectProduct,
}) {
  const persistedUiRef = useRef(loadPassportUiState())
  const [view, setView] = useState(() => {
    const saved = String(persistedUiRef.current?.view || 'editor')
    return saved === 'summary' || saved === 'share' ? saved : 'editor'
  })
  const [loadingFlow, setLoadingFlow] = useState(false)
  const [instanceId, setInstanceId] = useState('')
  const [form, setForm] = useState(null)
  const [sectionIndex, setSectionIndex] = useState(() => {
    const saved = Number(persistedUiRef.current?.sectionIndex)
    return Number.isInteger(saved) && saved >= 0 ? saved : 0
  })
  const [mode, setMode] = useState(() => (persistedUiRef.current?.mode === 'summary' ? 'summary' : 'form'))
  const [sectionEntries, setSectionEntries] = useState({})
  const [sectionEditingIndex, setSectionEditingIndex] = useState({})
  const [slideVisible, setSlideVisible] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryItems, setSummaryItems] = useState([])
  const saveTimersRef = useRef({})

  const sections = useMemo(() => (Array.isArray(form?.sections) ? form.sections : []), [form?.sections])
  const activeSection = sections[sectionIndex] || null
  const activeSectionKey = activeSection?.key || ''
  const activeEntriesRaw = sectionEntries[activeSectionKey] || []
  const activeEntries = mode === 'form' ? ensureEntry(activeEntriesRaw) : activeEntriesRaw
  const activeEditIndex = sectionEditingIndex[activeSectionKey] ?? 0
  const activeEntry = activeEntries[activeEditIndex] || {}

  const selectedProductName = useMemo(() => {
    const match = products.find((product) => String(product.id) === String(selectedProductId))
    return match?.name || ''
  }, [products, selectedProductId])

  useEffect(() => {
    if (selectedProductId) return
    const savedProductId = String(persistedUiRef.current?.selectedProductId || '')
    if (!savedProductId) return
    const hasSaved = products.some((product) => String(product.id) === savedProductId)
    if (!hasSaved) return
    onSelectProduct(savedProductId)
  }, [selectedProductId, products, onSelectProduct])

  const clearSaveTimer = (sectionKey) => {
    if (!sectionKey) return
    const timer = saveTimersRef.current[sectionKey]
    if (timer) clearTimeout(timer)
    delete saveTimersRef.current[sectionKey]
  }

  const persistSection = async (targetInstanceId, sectionKey, entries) => {
    if (!targetInstanceId || !sectionKey) return
    try {
      await api.post(`/passport/products/${targetInstanceId}/section-save`, {
        sectionKey,
        values: { entries },
      })
    } catch (error) {
      toast.error(error.response?.data?.error || 'Auto-save failed')
    }
  }

  const schedulePersist = (targetInstanceId, sectionKey, entries) => {
    if (!targetInstanceId || !sectionKey) return
    clearSaveTimer(sectionKey)
    saveTimersRef.current[sectionKey] = setTimeout(() => {
      persistSection(targetInstanceId, sectionKey, entries)
    }, 350)
  }

  const loadSectionEntries = async (targetInstanceId, sectionKey) => {
    if (!targetInstanceId || !sectionKey) return
    try {
      const res = await api.post(`/passport/products/${targetInstanceId}/section-load`, { sectionKey })
      const loaded = normalizeLoadedEntries(res.data?.values)
      setSectionEntries((prev) => ({ ...prev, [sectionKey]: loaded }))
      setSectionEditingIndex((prev) => ({ ...prev, [sectionKey]: 0 }))
      return loaded
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load section values')
      setSectionEntries((prev) => ({ ...prev, [sectionKey]: [] }))
      setSectionEditingIndex((prev) => ({ ...prev, [sectionKey]: 0 }))
      return []
    }
  }

  const bootstrapProductFlow = async (adminProductId) => {
    const numericId = Number(adminProductId)
    if (!numericId) return
    setLoadingFlow(true)
    try {
      const listRes = await api.get('/passport/products')
      const existing = Array.isArray(listRes.data?.products) ? listRes.data.products : []
      let instance = existing.find(
        (item) => item.productSource === 'ADMIN_PRODUCT' && Number(item.adminProductId) === numericId
      )
      if (!instance) {
        const createRes = await api.post('/passport/products/admin', { adminProductId: numericId })
        instance = createRes.data?.product
      }
      const nextInstanceId = instance?.id
      if (!nextInstanceId) throw new Error('Unable to initialize product flow')

      setInstanceId(nextInstanceId)
      const formRes = await api.get(`/passport/products/${nextInstanceId}/form`)
      const nextForm = formRes.data || null
      setForm(nextForm)
      const savedByProduct = persistedUiRef.current?.byProduct || {}
      const savedProductState = savedByProduct[String(adminProductId)] || {}
      const requestedIndex = Number(savedProductState?.sectionIndex)
      const safeIndex =
        Number.isInteger(requestedIndex) &&
        requestedIndex >= 0 &&
        requestedIndex < (Array.isArray(nextForm?.sections) ? nextForm.sections.length : 0)
          ? requestedIndex
          : 0
      setSectionIndex(safeIndex)
      setSectionEntries({})
      setSectionEditingIndex({})
      const initialSectionKey = nextForm?.sections?.[safeIndex]?.key
      if (initialSectionKey) {
        const loaded = await loadSectionEntries(nextInstanceId, initialSectionKey)
        const savedMode = savedProductState?.mode === 'summary' ? 'summary' : 'form'
        setMode(savedMode === 'summary' || hasSavedEntries(loaded) ? savedMode : 'form')
      }
      setSlideVisible(false)
      requestAnimationFrame(() => setSlideVisible(true))
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Unable to load product sections')
      setInstanceId('')
      setForm(null)
      setSectionEntries({})
      setSectionEditingIndex({})
    } finally {
      setLoadingFlow(false)
    }
  }

  useEffect(() => {
    if (!selectedProductId) {
      setInstanceId('')
      setForm(null)
      setSectionEntries({})
      setSectionEditingIndex({})
      setSectionIndex(0)
      setMode('form')
      return
    }
    bootstrapProductFlow(selectedProductId)
    return () => {
      Object.keys(saveTimersRef.current).forEach((key) => clearSaveTimer(key))
    }
  }, [selectedProductId])

  useEffect(() => {
    if (view !== 'summary' && view !== 'share') return
    let active = true
    const loadSummary = async () => {
      setSummaryLoading(true)
      try {
        const listRes = await api.get('/passport/products')
        const instances = Array.isArray(listRes.data?.products) ? listRes.data.products : []
        const filledProducts = await Promise.all(
          instances.map(async (instance) => {
            const formRes = await api.get(`/passport/products/${instance.id}/form`)
            const sections = Array.isArray(formRes.data?.sections) ? formRes.data.sections : []
            const sectionSummaries = await Promise.all(
              sections.map(async (section) => {
                const loadRes = await api.post(`/passport/products/${instance.id}/section-load`, {
                  sectionKey: section.key,
                })
                const entries = normalizeLoadedEntries(loadRes.data?.values).filter((entry) => hasNonEmptyValue(entry))
                if (!entries.length) return null
                return { section, entries }
              })
            )
            const filledSections = sectionSummaries.filter(Boolean)
            if (!filledSections.length) return null
            return { instance, filledSections }
          })
        )
        if (!active) return
        setSummaryItems(filledProducts.filter(Boolean))
      } catch (error) {
        if (!active) return
        setSummaryItems([])
        toast.error(error.response?.data?.error || 'Unable to load passport summary')
      } finally {
        if (active) setSummaryLoading(false)
      }
    }
    loadSummary()
    return () => {
      active = false
    }
  }, [view])

  useEffect(() => {
    if (!activeSectionKey || !instanceId) return
    if (Object.prototype.hasOwnProperty.call(sectionEntries, activeSectionKey)) return
    let active = true
    const hydrateSection = async () => {
      const loaded = await loadSectionEntries(instanceId, activeSectionKey)
      if (!active) return
      setMode(hasSavedEntries(loaded) ? 'summary' : 'form')
    }
    hydrateSection()
    return () => {
      active = false
    }
  }, [activeSectionKey, instanceId, sectionEntries])

  useEffect(() => {
    setSlideVisible(false)
    requestAnimationFrame(() => setSlideVisible(true))
  }, [sectionIndex, mode, activeSectionKey])

  useEffect(() => {
    const existing = persistedUiRef.current || {}
    const byProduct = { ...(existing.byProduct || {}) }
    if (selectedProductId) {
      byProduct[String(selectedProductId)] = {
        sectionIndex,
        mode,
      }
    }
    const next = {
      ...existing,
      view,
      selectedProductId: selectedProductId || existing.selectedProductId || '',
      sectionIndex,
      mode,
      byProduct,
    }
    persistedUiRef.current = next
    persistPassportUiState(next)
  }, [view, selectedProductId, sectionIndex, mode])

  useEffect(() => {
    if (view === 'share') return
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(SHARE_FLOW_STORAGE_KEY)
  }, [view])

  const updateCurrentField = (fieldKey, value) => {
    if (!activeSectionKey) return
    const nextEntries = ensureEntry(activeEntriesRaw).map((entry) => ({ ...entry }))
    const index = Math.max(0, Math.min(activeEditIndex, nextEntries.length - 1))
    nextEntries[index] = {
      ...(isPlainObject(nextEntries[index]) ? nextEntries[index] : {}),
      [fieldKey]: value,
    }
    setSectionEntries((prev) => ({ ...prev, [activeSectionKey]: nextEntries }))
    schedulePersist(instanceId, activeSectionKey, nextEntries)
  }

  const addMoreCurrentSection = () => {
    if (!activeSectionKey) return
    const nextEntries = [...activeEntriesRaw, {}]
    const nextIndex = nextEntries.length - 1
    setSectionEntries((prev) => ({ ...prev, [activeSectionKey]: nextEntries }))
    setSectionEditingIndex((prev) => ({ ...prev, [activeSectionKey]: nextIndex }))
    setMode('form')
    schedulePersist(instanceId, activeSectionKey, nextEntries)
  }

  const removeEntry = (entryIndex) => {
    if (!activeSectionKey) return
    const nextEntries = activeEntriesRaw.filter((_, idx) => idx !== entryIndex)
    setSectionEntries((prev) => ({ ...prev, [activeSectionKey]: nextEntries }))
    setSectionEditingIndex((prev) => {
      const current = prev[activeSectionKey] ?? 0
      const safe = Math.max(0, Math.min(current, Math.max(0, nextEntries.length - 1)))
      return { ...prev, [activeSectionKey]: safe }
    })
    schedulePersist(instanceId, activeSectionKey, nextEntries)
  }

  const editEntry = (entryIndex) => {
    if (!activeSectionKey) return
    setSectionEditingIndex((prev) => ({ ...prev, [activeSectionKey]: entryIndex }))
    setMode('form')
  }

  const goNextSection = () => {
    if (sectionIndex >= sections.length - 1) {
      toast.success('All sections completed')
      return
    }
    const nextIndex = sectionIndex + 1
    const nextSectionKey = sections[nextIndex]?.key || ''
    const nextEntries = sectionEntries[nextSectionKey] || []
    setSectionIndex(nextIndex)
    setMode(hasSavedEntries(nextEntries) ? 'summary' : 'form')
  }

  const goBackSection = () => {
    if (sectionIndex <= 0) return
    const prevIndex = sectionIndex - 1
    const prevSectionKey = sections[prevIndex]?.key || ''
    const prevEntries = sectionEntries[prevSectionKey] || []
    setSectionIndex(prevIndex)
    setMode(hasSavedEntries(prevEntries) ? 'summary' : 'form')
  }

  const renderField = (field) => {
    const value = activeEntry[field.key] ?? ''
    const type = String(field.type || 'general').toLowerCase()
    if (type === 'select' || type === 'yes/no') {
      const options =
        Array.isArray(field.options) && field.options.length ? field.options : type === 'yes/no' ? ['Yes', 'No'] : []
      return (
        <select className={inputClass} value={value} onChange={(event) => updateCurrentField(field.key, event.target.value)}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={`${field.key}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }
    if (type === 'number') {
      return (
        <input
          className={inputClass}
          type="number"
          value={value}
          onChange={(event) => updateCurrentField(field.key, event.target.value)}
        />
      )
    }
    if (type === 'date') {
      return (
        <input
          className={inputClass}
          type="date"
          value={value}
          onChange={(event) => updateCurrentField(field.key, event.target.value)}
        />
      )
    }
    return (
      <input
        className={inputClass}
        type="text"
        value={value}
        onChange={(event) => updateCurrentField(field.key, event.target.value)}
      />
    )
  }

  const renderSummaryCard = (entry, index) => (
    <div key={`${activeSectionKey}-entry-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
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
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pill-btn-ghost px-3 py-1 text-xs" onClick={() => editEntry(index)}>
            Edit
          </button>
          <button
            type="button"
            className="pill-btn-ghost px-3 py-1 text-xs text-red-600"
            onClick={() => removeEntry(index)}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )

  const passportShareSnapshot = useMemo(
    () => ({
      passportV2: {
        version: 2,
        products: summaryItems.map((item) => ({
          productInstance: item.instance,
          sections: item.filledSections.map((sectionItem) => sectionItem.section),
          responses: item.filledSections.map((sectionItem) => ({
            sectionKey: sectionItem.section.key,
            values: { entries: sectionItem.entries },
          })),
        })),
      },
    }),
    [summaryItems]
  )

  return (
    <div className="space-y-4">
      <div className="surface p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              view === 'editor' ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setView('editor')}
          >
            My Passport
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              view === 'summary' ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setView('summary')}
          >
            My Passport Summary
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              view === 'share' ? 'bg-[#0b3b8c] text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setView('share')}
          >
            Share
          </button>
        </div>
      </div>

      {view === 'summary' && (
        <div className="space-y-4">
          {summaryLoading && <div className="surface p-5 text-sm text-slate-500">Loading summary...</div>}
          {!summaryLoading && summaryItems.length === 0 && (
            <div className="surface p-5 text-sm text-slate-500">No filled passport sections yet.</div>
          )}
          {!summaryLoading &&
            summaryItems.map((item) => (
              <div key={item.instance.id} className="surface p-5 space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">{item.instance.productName}</h3>
                {item.filledSections.map((sectionItem) => (
                  <div key={`${item.instance.id}-${sectionItem.section.key}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">{sectionItem.section.label}</div>
                    {sectionItem.entries.map((entry, entryIndex) => (
                      <div key={`${sectionItem.section.key}-${entryIndex}`} className="rounded-lg border border-slate-200 bg-white p-3">
                        {(sectionItem.section.fields || []).map((field) => (
                          <div key={`${field.key}-${entryIndex}`} className="inline-flex items-baseline gap-1 py-0.5 pr-4 text-sm">
                            <span className="font-semibold text-slate-900">{field.label}:</span>
                            <span className="text-green-700">{formatValue(entry?.[field.key])}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {view === 'share' && (
        <PassportSharePanel snapshot={passportShareSnapshot} />
      )}

      {view === 'editor' && (
        <>
          <div className="surface p-5 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Choose your insurance product</h3>
            <label className="block text-sm font-semibold text-slate-700">
              Insurance product
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={selectedProductId}
                onChange={(event) => onSelectProduct(event.target.value)}
                disabled={productsLoading || products.length === 0}
              >
                <option value="">Select a product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!selectedProductId && (
            <div className="surface p-5 text-sm text-slate-500">Select a product to start section flow.</div>
          )}

          {selectedProductId && loadingFlow && (
            <div className="surface p-5 text-sm text-slate-500">Loading sections for {selectedProductName || 'product'}...</div>
          )}

          {selectedProductId && !loadingFlow && activeSection && (
            <div
              className={`surface p-5 transition-all duration-300 ${
                slideVisible ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Section {sectionIndex + 1} of {sections.length}
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900">{activeSection.label}</h4>
                </div>
                <div className="flex gap-2">
                  {sectionIndex > 0 && (
                    <button type="button" className="pill-btn-ghost px-4" onClick={goBackSection}>
                      Back
                    </button>
                  )}
                </div>
              </div>

              {mode === 'form' && (
                <div className="space-y-3">
                  {(activeSection.fields || []).map((field) => (
                    <label key={field.key} className="block space-y-1 text-sm text-slate-700">
                      <div>{field.label}</div>
                      {renderField(field)}
                    </label>
                  ))}
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
          )}
        </>
      )}
    </div>
  )
}
