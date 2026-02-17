import React, { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

export default function AdminFormsTab({ onSessionExpired }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [activeProductId, setActiveProductId] = useState('')
  const [activeProductName, setActiveProductName] = useState('')
  const [schemaDraft, setSchemaDraft] = useState({ sections: [] })
  const [schemaSaving, setSchemaSaving] = useState(false)
  const [schemaQuestions, setSchemaQuestions] = useState([])
  const [schemaQuestionsLoading, setSchemaQuestionsLoading] = useState(false)
  const [schemaQuestionSearch, setSchemaQuestionSearch] = useState('')
  const [draggingQuestion, setDraggingQuestion] = useState(null)
  const [questions, setQuestions] = useState([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [questionSourceFilter, setQuestionSourceFilter] = useState('all')
  const [questionEdits, setQuestionEdits] = useState({})
  const [questionOptionDrafts, setQuestionOptionDrafts] = useState({})
  const [newProductName, setNewProductName] = useState('')
  const lastQuestionPrefillProductRef = useRef('')

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      if (typeof onSessionExpired === 'function') onSessionExpired()
      toast.error('Session expired')
      return true
    }
    if (fallbackMessage) {
      toast.error(err?.response?.data?.error || fallbackMessage)
    }
    return false
  }

  const normalizeSelectOptionsList = (value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || '').trim()).filter(Boolean)
    }
    if (!value) return []
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
        }
      } catch {
        // Fall back to comma-separated parsing.
      }
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
    return []
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await adminApi.get('/admin/forms/products')
      const items = Array.isArray(res.data?.products) ? res.data.products : []
      setProducts(items)
      if (!activeProductId && items.length) {
        setActiveProductId(String(items[0].id))
      }
    } catch (err) {
      handleSessionError(err, 'Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }

  const addProduct = async () => {
    const name = newProductName.trim()
    if (!name) {
      toast.error('Enter a product name')
      return
    }
    try {
      const res = await adminApi.post('/admin/products', { name })
      const product = res.data?.product
      if (product) {
        setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)))
        setActiveProductId(String(product.id))
      }
      setNewProductName('')
      toast.success('Product added')
    } catch (err) {
      handleSessionError(err, 'Failed to add product')
    }
  }

  const loadQuestions = async (productId, sourceFilter = 'all') => {
    setQuestionsLoading(true)
    try {
      const params = {
        ...(productId ? { productId } : {}),
        ...(sourceFilter && sourceFilter !== 'all' ? { source: sourceFilter } : {}),
      }
      const res = await adminApi.get('/admin/questions', { params })
      const items = Array.isArray(res.data?.questions) ? res.data.questions : []
      const normalizedItems = items.map((item) => ({
        ...item,
        inputType: item.inputType || 'general',
        selectOptions: normalizeSelectOptionsList(item.selectOptions),
      }))
      setQuestions(normalizedItems)
      setQuestionEdits({})
      const currentProductKey = productId ? String(productId) : ''
      if (currentProductKey !== lastQuestionPrefillProductRef.current) {
        if (currentProductKey && sourceFilter !== 'CUSTOMER') {
          const listText = normalizedItems
            .filter((question) => question.source === 'SYSTEM')
            .map((question) => question.text)
            .filter(Boolean)
            .join(', ')
          setNewQuestion(listText)
        } else {
          setNewQuestion('')
        }
        lastQuestionPrefillProductRef.current = currentProductKey
      }
    } catch (err) {
      handleSessionError(err, 'Failed to load questions')
    } finally {
      setQuestionsLoading(false)
    }
  }

  const updateSchemaDraft = (updater) => {
    setSchemaDraft((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return normalizeFormSchema(next)
    })
  }

  const addSection = () => {
    updateSchemaDraft((prev) => ({
      sections: [
        ...(Array.isArray(prev?.sections) ? prev.sections : []),
        { key: '', label: '', questionIds: [] },
      ],
    }))
  }

  const removeSection = (index) => {
    updateSchemaDraft((prev) => ({
      sections: (prev.sections || []).filter((_, idx) => idx !== index),
    }))
  }

  const moveSection = (index, direction) => {
    updateSchemaDraft((prev) => {
      const sections = [...(prev.sections || [])]
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= sections.length) return prev
      const temp = sections[index]
      sections[index] = sections[nextIndex]
      sections[nextIndex] = temp
      return { sections }
    })
  }

  const setSectionField = (index, field, value) => {
    updateSchemaDraft((prev) => ({
      sections: (prev.sections || []).map((section, idx) =>
        idx === index ? { ...section, [field]: value } : section
      ),
    }))
  }

  const toggleSectionQuestion = (sectionIndex, questionId) => {
    updateSchemaDraft((prev) => ({
      sections: (prev.sections || []).map((section, idx) => {
        if (idx !== sectionIndex) return section
        const set = new Set(Array.isArray(section.questionIds) ? section.questionIds : [])
        if (set.has(questionId)) {
          set.delete(questionId)
        } else {
          set.add(questionId)
        }
        return { ...section, questionIds: Array.from(set) }
      }),
    }))
  }

  const moveQuestionWithinSection = (sectionIndex, questionIndex, direction) => {
    updateSchemaDraft((prev) => ({
      sections: (prev.sections || []).map((section, idx) => {
        if (idx !== sectionIndex) return section
        const list = [...(section.questionIds || [])]
        const nextIndex = questionIndex + direction
        if (nextIndex < 0 || nextIndex >= list.length) return section
        const temp = list[questionIndex]
        list[questionIndex] = list[nextIndex]
        list[nextIndex] = temp
        return { ...section, questionIds: list }
      }),
    }))
  }

  const handleQuestionDrop = (targetSectionIndex, targetQuestionIndex = null) => {
    if (!draggingQuestion) return
    updateSchemaDraft((prev) => {
      const sections = (prev.sections || []).map((section) => ({
        ...section,
        questionIds: [...(section.questionIds || [])],
      }))
      const sourceSection = sections[draggingQuestion.sectionIndex]
      if (!sourceSection) return prev
      const [moved] = sourceSection.questionIds.splice(draggingQuestion.questionIndex, 1)
      if (!Number.isInteger(moved)) return prev
      const destination = sections[targetSectionIndex]
      if (!destination) return prev
      const insertAt =
        targetQuestionIndex === null || targetQuestionIndex === undefined
          ? destination.questionIds.length
          : Math.max(0, Math.min(targetQuestionIndex, destination.questionIds.length))
      destination.questionIds.splice(insertAt, 0, moved)
      return { sections }
    })
    setDraggingQuestion(null)
  }

  const saveProductSchema = async () => {
    if (!activeProductId) {
      toast.error('Select a product first')
      return
    }
    const normalized = normalizeFormSchema(schemaDraft)
    const invalid = normalized.sections.find((section) => !section.key || !section.label)
    if (invalid) {
      toast.error('Each section needs a key and label')
      return
    }
    setSchemaSaving(true)
    try {
      const res = await adminApi.put(`/admin/forms/products/${activeProductId}`, {
        name: activeProductName.trim(),
        formSchema: normalized,
      })
      const updated = res.data?.product
      if (updated) {
        setProducts((prev) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        )
        setSchemaDraft(normalizeFormSchema(updated.formSchema))
        setActiveProductName(updated.name || activeProductName)
      }
      toast.success('Product mapping saved')
    } catch (err) {
      handleSessionError(err, 'Failed to save product mapping')
    } finally {
      setSchemaSaving(false)
    }
  }

  const normalizeSectionKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const normalizeFormSchema = (value) => {
    const sections = Array.isArray(value?.sections) ? value.sections : []
    return {
      sections: sections
        .map((section, index) => {
          const key = normalizeSectionKey(section?.key || section?.label || `section-${index + 1}`)
          const label = String(section?.label || key || `Section ${index + 1}`).trim()
          const questionIds = Array.isArray(section?.questionIds)
            ? Array.from(new Set(section.questionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)))
            : []
          if (!key) return null
          return { key, label, questionIds }
        })
        .filter(Boolean),
    }
  }

  const loadSchemaQuestions = async (query = '') => {
    setSchemaQuestionsLoading(true)
    try {
      const params = query.trim() ? { query: query.trim() } : {}
      const res = await adminApi.get('/admin/forms/questions', { params })
      const items = Array.isArray(res.data?.questions) ? res.data.questions : []
      setSchemaQuestions(items)
    } catch (err) {
      handleSessionError(err, 'Failed to load mapping questions')
    } finally {
      setSchemaQuestionsLoading(false)
    }
  }

  useEffect(() => {
    const active = products.find((product) => String(product.id) === String(activeProductId))
    if (!active) {
      setActiveProductName('')
      setSchemaDraft({ sections: [] })
      return
    }
    setActiveProductName(active.name || '')
    setSchemaDraft(normalizeFormSchema(active.formSchema))
  }, [products, activeProductId])

  const addQuestion = async () => {
    const text = newQuestion.trim()
    if (!text) {
      toast.error('Enter a question')
      return
    }
    try {
      const syncMode = Boolean(activeProductId) && questionSourceFilter !== 'CUSTOMER'
      const payload = { text, ...(syncMode ? { sync: true } : {}) }
      if (activeProductId) payload.productId = Number(activeProductId)
      const res = await adminApi.post('/admin/questions', payload)
      const createdCount = Number(res.data?.created || 0)
      const deletedCount = Number(res.data?.deleted || 0)
      const skippedCount = Number(res.data?.skipped || 0)
      const skippedTexts = Array.isArray(res.data?.skippedTexts) ? res.data.skippedTexts : []

      if (syncMode) {
        const updated = Array.isArray(res.data?.questions) ? res.data.questions : []
        const normalizedUpdated = updated.map((item) => ({
          ...item,
          inputType: item.inputType || 'general',
          selectOptions: normalizeSelectOptionsList(item.selectOptions),
        }))
        if (questionSourceFilter === 'all') {
          await loadQuestions(activeProductId, questionSourceFilter)
        } else {
          setQuestions(normalizedUpdated)
          setQuestionEdits({})
        }
        setNewQuestion(normalizedUpdated.map((question) => question.text).filter(Boolean).join(', '))
        if (createdCount || deletedCount) {
          toast.success(`Saved questions (${createdCount} added, ${deletedCount} removed)`)
        } else {
          toast.success('Saved questions')
        }
        if (skippedCount) {
          toast.error(
            `Skipped ${skippedCount} duplicate question(s) already used in another product${
              skippedTexts.length ? `: ${skippedTexts.join(', ')}` : ''
            }`
          )
        }
        return
      }

      await loadQuestions(activeProductId, questionSourceFilter)
      setNewQuestion('')
      if (createdCount > 1) {
        toast.success(`Added ${createdCount} questions`)
      } else if (createdCount === 1) {
        toast.success('Question added')
      } else if (skippedCount > 0) {
        toast.error(
          `Skipped ${skippedCount} duplicate question(s)${skippedTexts.length ? `: ${skippedTexts.join(', ')}` : ''}`
        )
      } else {
        toast.error('No questions added')
      }
    } catch (err) {
      handleSessionError(err, 'Failed to add question')
    }
  }

  const updateQuestionEdit = (id, value) => {
    setQuestionEdits((prev) => ({ ...prev, [id]: value }))
  }

  const saveQuestionEdit = async (question) => {
    const nextText = (questionEdits[question.id] ?? question.text).trim()
    if (!nextText) {
      toast.error('Question text is required')
      return
    }
    try {
      const res = await adminApi.put(`/admin/questions/${question.id}`, {
        text: nextText,
        source: question.source,
      })
      const updated = res.data?.question
      if (updated) {
        setQuestions((prev) =>
          prev.map((item) =>
            item.id === updated.id && item.source === updated.source ? { ...item, text: updated.text } : item
          )
        )
        setQuestionEdits((prev) => {
          const next = { ...prev }
          delete next[question.id]
          return next
        })
      }
      toast.success('Question updated')
    } catch (err) {
      handleSessionError(err, 'Failed to update question')
    }
  }

  const getQuestionDraftKey = (question) => `${question?.source || 'SYSTEM'}-${question?.id ?? ''}`

  const deleteQuestion = async (question) => {
    try {
      await adminApi.delete(`/admin/questions/${question.id}`, {
        params: question.source ? { source: question.source } : {},
      })
      setQuestions((prev) => prev.filter((item) => item.id !== question.id || item.source !== question.source))
      setQuestionOptionDrafts((prev) => {
        const next = { ...prev }
        delete next[getQuestionDraftKey(question)]
        return next
      })
      toast.success('Question removed')
    } catch (err) {
      handleSessionError(err, 'Failed to remove question')
    }
  }

  const patchQuestion = (id, source, patch) => {
    setQuestions((prev) =>
      prev.map((item) => (item.id === id && item.source === source ? { ...item, ...patch } : item))
    )
  }

  const saveSystemQuestionConfig = async (question, patch) => {
    try {
      const res = await adminApi.put(`/admin/questions/${question.id}`, {
        source: question.source,
        ...patch,
      })
      const updated = res.data?.question
      if (updated) {
        patchQuestion(updated.id, updated.source, {
          ...updated,
          inputType: updated.inputType || 'general',
          selectOptions: normalizeSelectOptionsList(updated.selectOptions),
        })
      }
    } catch (err) {
      throw err
    }
  }

  const handleSystemInputTypeChange = async (question, nextType) => {
    const currentType = question.inputType || 'general'
    if (currentType === nextType) return
    patchQuestion(question.id, question.source, { inputType: nextType })
    try {
      await saveSystemQuestionConfig(question, { inputType: nextType })
    } catch (err) {
      patchQuestion(question.id, question.source, { inputType: currentType })
      handleSessionError(err, 'Failed to update input type')
    }
  }

  const updateQuestionOptionDraft = (key, value) => {
    setQuestionOptionDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const addQuestionSelectOptions = async (question) => {
    const draftKey = getQuestionDraftKey(question)
    const raw = questionOptionDrafts[draftKey] ?? ''
    const additions = normalizeSelectOptionsList(raw)
    if (!additions.length) {
      toast.error('Enter choices separated by commas')
      return
    }
    const current = normalizeSelectOptionsList(question.selectOptions)
    const next = [...current]
    additions.forEach((option) => {
      if (!next.includes(option)) next.push(option)
    })
    updateQuestionOptionDraft(draftKey, '')
    patchQuestion(question.id, question.source, { selectOptions: next })
    try {
      await saveSystemQuestionConfig(question, { selectOptions: next })
    } catch (err) {
      patchQuestion(question.id, question.source, { selectOptions: current })
      handleSessionError(err, 'Failed to update choices')
    }
  }

  const moveQuestionSelectOption = async (question, index, direction) => {
    const current = normalizeSelectOptionsList(question.selectOptions)
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= current.length) return
    const next = [...current]
    const temp = next[index]
    next[index] = next[nextIndex]
    next[nextIndex] = temp
    patchQuestion(question.id, question.source, { selectOptions: next })
    try {
      await saveSystemQuestionConfig(question, { selectOptions: next })
    } catch (err) {
      patchQuestion(question.id, question.source, { selectOptions: current })
      handleSessionError(err, 'Failed to reorder choices')
    }
  }

  const removeQuestionSelectOption = async (question, index) => {
    const current = normalizeSelectOptionsList(question.selectOptions)
    const next = current.filter((_, idx) => idx !== index)
    patchQuestion(question.id, question.source, { selectOptions: next })
    try {
      await saveSystemQuestionConfig(question, { selectOptions: next })
    } catch (err) {
      patchQuestion(question.id, question.source, { selectOptions: current })
      handleSessionError(err, 'Failed to remove choice')
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    loadQuestions(activeProductId, questionSourceFilter)
  }, [activeProductId, questionSourceFilter])

  useEffect(() => {
    const handle = setTimeout(() => {
      loadSchemaQuestions(schemaQuestionSearch)
    }, 200)
    return () => clearTimeout(handle)
  }, [schemaQuestionSearch])

  const input = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
  const schemaQuestionMap = useMemo(
    () => new Map(schemaQuestions.map((question) => [Number(question.id), question])),
    [schemaQuestions]
  )
  const questionInputTypes = [
    { value: 'general', label: 'General' },
    { value: 'select', label: 'Select' },
    { value: 'yes/no', label: 'Yes/No' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'text', label: 'Text' },
  ]

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Forms Content Manager</h2>
          <p className="text-sm text-slate-600">Control the Create Profile question bank.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Product
                <select
                  className={input}
                  value={activeProductId}
                  onChange={(event) => setActiveProductId(event.target.value)}
                  disabled={productsLoading}
                >
                  <option value="">All products</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Source
                <select
                  className={input}
                  value={questionSourceFilter}
                  onChange={(event) => setQuestionSourceFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="SYSTEM">System</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
              </label>
              <button type="button" className="pill-btn-ghost px-3 py-1" onClick={loadProducts} disabled={productsLoading}>
                {productsLoading ? 'Loading...' : 'Refresh products'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                New product
                <input
                  className={input}
                  value={newProductName}
                  onChange={(event) => setNewProductName(event.target.value)}
                  placeholder="e.g. Boat Insurance"
                />
              </label>
              <button type="button" className="pill-btn-primary px-4" onClick={addProduct}>
                Add product
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add question(s)</div>
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[120px]"
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              placeholder="Type questions separated by commas"
            />
            <button type="button" className="pill-btn-primary mt-3 w-full justify-center" onClick={addQuestion}>
              Add question(s)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Product Section Mapping</div>
              <div className="text-xs text-slate-500">
                Define sections and ordered question IDs for the selected product.
              </div>
            </div>
            <button
              type="button"
              className="pill-btn-primary px-4"
              onClick={saveProductSchema}
              disabled={!activeProductId || schemaSaving}
            >
              {schemaSaving ? 'Saving...' : 'Save mapping'}
            </button>
          </div>
          {!activeProductId ? (
            <div className="text-sm text-slate-500">Select a product to edit its section mapping.</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block text-sm font-semibold text-slate-700">
                  Product name
                  <input
                    className={input}
                    value={activeProductName}
                    onChange={(event) => setActiveProductName(event.target.value)}
                    placeholder="Product name"
                  />
                </label>
                <button type="button" className="pill-btn-ghost px-3 py-1" onClick={addSection}>
                  Add section
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
                <div className="space-y-3">
                  {!schemaDraft.sections.length && (
                    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                      No sections yet. Add your first section.
                    </div>
                  )}
                  {schemaDraft.sections.map((section, sectionIndex) => (
                    <div key={`schema-section-${sectionIndex}`} className="rounded-lg border border-slate-200 p-3 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Section key
                          <input
                            className={input}
                            value={section.key}
                            onChange={(event) => setSectionField(sectionIndex, 'key', normalizeSectionKey(event.target.value))}
                            placeholder="e.g. vehicle"
                          />
                        </label>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Section label
                          <input
                            className={input}
                            value={section.label}
                            onChange={(event) => setSectionField(sectionIndex, 'label', event.target.value)}
                            placeholder="e.g. Vehicle Information"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="pill-btn-ghost px-2 py-1 text-xs" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}>
                          Move up
                        </button>
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs"
                          onClick={() => moveSection(sectionIndex, 1)}
                          disabled={sectionIndex === schemaDraft.sections.length - 1}
                        >
                          Move down
                        </button>
                        <button type="button" className="pill-btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => removeSection(sectionIndex)}>
                          Remove section
                        </button>
                      </div>
                      <div
                        className="space-y-1 rounded-md border border-slate-100 bg-slate-50 p-2"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleQuestionDrop(sectionIndex)}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordered question IDs</div>
                        {!section.questionIds?.length && (
                          <div className="text-xs text-slate-400">No questions mapped.</div>
                        )}
                        {(section.questionIds || []).map((questionId, questionIndex) => {
                          const question = schemaQuestionMap.get(Number(questionId))
                          return (
                            <div
                              key={`section-${sectionIndex}-q-${questionId}-${questionIndex}`}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                              draggable
                              onDragStart={() => setDraggingQuestion({ sectionIndex, questionIndex })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleQuestionDrop(sectionIndex, questionIndex)}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-[180px] flex-1">
                                  <span className="font-semibold">#{questionId}</span>{' '}
                                  <span>{question?.label || 'Unknown question'}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="pill-btn-ghost px-2 py-0.5 text-[11px]"
                                    onClick={() => moveQuestionWithinSection(sectionIndex, questionIndex, -1)}
                                    disabled={questionIndex === 0}
                                  >
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className="pill-btn-ghost px-2 py-0.5 text-[11px]"
                                    onClick={() => moveQuestionWithinSection(sectionIndex, questionIndex, 1)}
                                    disabled={questionIndex === (section.questionIds || []).length - 1}
                                  >
                                    Down
                                  </button>
                                  <button
                                    type="button"
                                    className="pill-btn-ghost px-2 py-0.5 text-[11px] text-red-600"
                                    onClick={() => toggleSectionQuestion(sectionIndex, Number(questionId))}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question Bank</div>
                  <input
                    className={input}
                    value={schemaQuestionSearch}
                    onChange={(event) => setSchemaQuestionSearch(event.target.value)}
                    placeholder="Search questions"
                  />
                  {schemaQuestionsLoading && <div className="text-xs text-slate-500">Loading questions...</div>}
                  {!schemaQuestionsLoading && (
                    <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                      {schemaQuestions.map((question) => (
                        <div key={`schema-bank-${question.id}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs">
                          <div className="font-semibold text-slate-700">
                            #{question.id} {question.label}
                          </div>
                          <div className="mt-1 text-slate-500">Type: {question.inputType || question.type || 'general'}</div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {schemaDraft.sections.map((section, sectionIndex) => {
                              const selected = (section.questionIds || []).includes(Number(question.id))
                              return (
                                <button
                                  key={`attach-${question.id}-${sectionIndex}`}
                                  type="button"
                                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                    selected
                                      ? 'border-[#0b3b8c] bg-[#e8f0ff] text-[#0b3b8c]'
                                      : 'border-slate-300 bg-white text-slate-600'
                                  }`}
                                  onClick={() => toggleSectionQuestion(sectionIndex, Number(question.id))}
                                >
                                  {selected ? `Remove: ${section.label || section.key}` : `Add: ${section.label || section.key}`}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      {!schemaQuestions.length && (
                        <div className="text-xs text-slate-400">No questions found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Questions</div>
            <div className="text-xs text-slate-500">{questions.length} total</div>
          </div>
          {questionsLoading && <div className="mt-3 text-slate-500">Loading questions...</div>}
          {!questionsLoading && !questions.length && (
            <div className="mt-3 text-slate-500">No questions for this product yet.</div>
          )}
          {!questionsLoading && questions.length > 0 && (
            <div className="mt-3 space-y-2">
              {questions.map((question) => {
                const inputTypeValue = question.inputType || 'general'
                const selectOptions = normalizeSelectOptionsList(question.selectOptions)
                const draftKey = getQuestionDraftKey(question)
                const optionDraft = questionOptionDrafts[draftKey] ?? ''
                return (
                  <div
                    key={`${question.source || 'SYSTEM'}-${question.id}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex-1 min-w-[240px]">
                      {question.source === 'CUSTOMER' ? (
                        <>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer question</div>
                          <input
                            className={`${input} mt-1`}
                            value={questionEdits[question.id] ?? question.text}
                            onChange={(event) => updateQuestionEdit(question.id, event.target.value)}
                          />
                          <div className="mt-1 text-xs text-slate-400">
                            Customer: {question.customerName || question.customerEmail || `#${question.customerId || 'unknown'}`}
                          </div>
                          {question.formName ? (
                            <div className="mt-1 text-xs text-slate-400">Form: {question.formName}</div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">System question</div>
                          <div className="text-sm text-slate-700 mt-1">{question.text}</div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
                            <label className="block text-sm font-semibold text-slate-700">
                              Input type
                              <select
                                className={input}
                                value={inputTypeValue}
                                onChange={(event) => handleSystemInputTypeChange(question, event.target.value)}
                              >
                                {questionInputTypes.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {inputTypeValue === 'select' ? (
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Select choices</div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <input
                                    className={input}
                                    value={optionDraft}
                                    onChange={(event) => updateQuestionOptionDraft(draftKey, event.target.value)}
                                    placeholder="Choice 1, Choice 2, Choice 3"
                                  />
                                  <button
                                    type="button"
                                    className="pill-btn-ghost px-3 py-1 text-xs"
                                    onClick={() => addQuestionSelectOptions(question)}
                                  >
                                    Add choices
                                  </button>
                                </div>
                                {selectOptions.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    {selectOptions.map((option, index) => (
                                      <div
                                        key={`${question.id}-option-${index}`}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                      >
                                        <span>{option}</span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            className="pill-btn-ghost px-2 py-1 text-[11px]"
                                            onClick={() => moveQuestionSelectOption(question, index, -1)}
                                            disabled={index === 0}
                                          >
                                            Up
                                          </button>
                                          <button
                                            type="button"
                                            className="pill-btn-ghost px-2 py-1 text-[11px]"
                                            onClick={() => moveQuestionSelectOption(question, index, 1)}
                                            disabled={index === selectOptions.length - 1}
                                          >
                                            Down
                                          </button>
                                          <button
                                            type="button"
                                            className="pill-btn-ghost px-2 py-1 text-[11px] text-red-600"
                                            onClick={() => removeQuestionSelectOption(question, index)}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-slate-400">No choices added yet.</div>
                                )}
                              </div>
                            ) : inputTypeValue === 'yes/no' ? (
                              <div className="text-xs text-slate-500">Yes/No will render as a two-option select.</div>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {question.source === 'CUSTOMER' && (
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs"
                          onClick={() => saveQuestionEdit(question)}
                        >
                          Save
                        </button>
                      )}
                      <button
                        type="button"
                        className="pill-btn-ghost px-2 py-1 text-xs text-red-600"
                        onClick={() => deleteQuestion(question)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
