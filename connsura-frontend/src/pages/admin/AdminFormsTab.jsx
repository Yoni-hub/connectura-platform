import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'

const INPUT_TYPES = ['general', 'select', 'yes/no', 'number', 'date', 'text']

const normalizeSectionKey = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeSections = (schema) => {
  const sections = Array.isArray(schema?.sections) ? schema.sections : []
  return sections
    .map((section, index) => {
      const key = normalizeSectionKey(section?.key || section?.label || `section-${index + 1}`)
      const label = String(section?.label || key || `Section ${index + 1}`).trim()
      const questionIds = Array.isArray(section?.questionIds)
        ? Array.from(
            new Set(
              section.questionIds
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
            )
          )
        : []
      if (!key) return null
      return { key, label, questionIds }
    })
    .filter(Boolean)
}

const ensureUniqueSectionKey = (baseKey, sections) => {
  const keys = new Set((sections || []).map((section) => section.key))
  if (!keys.has(baseKey)) return baseKey
  let cursor = 2
  while (keys.has(`${baseKey}-${cursor}`)) cursor += 1
  return `${baseKey}-${cursor}`
}

const normalizeQuestionDraftText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()

export default function AdminFormsTab({ onSessionExpired }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)
  const [removingProduct, setRemovingProduct] = useState(false)

  const [questions, setQuestions] = useState([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionDraft, setQuestionDraft] = useState('')
  const [savingQuestions, setSavingQuestions] = useState(false)
  const [savingSchema, setSavingSchema] = useState(false)

  const [sectionsDraft, setSectionsDraft] = useState([])
  const [selectedSectionKey, setSelectedSectionKey] = useState('')
  const [newSectionLabel, setNewSectionLabel] = useState('')

  const [mappingSearch, setMappingSearch] = useState('')
  const [selectedMappingQuestionId, setSelectedMappingQuestionId] = useState('')
  const [questionOptionDrafts, setQuestionOptionDrafts] = useState({})

  const handleSessionError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
      if (typeof onSessionExpired === 'function') onSessionExpired()
      toast.error('Session expired')
      return true
    }
    toast.error(err?.response?.data?.error || fallbackMessage)
    return false
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await adminApi.get('/admin/forms/products')
      const list = Array.isArray(res.data?.products) ? res.data.products : []
      setProducts(list)
      const hasSelected = list.some((item) => String(item.id) === String(selectedProductId))
      if (!hasSelected) {
        setSelectedProductId(list.length ? String(list[0].id) : '')
      }
    } catch (err) {
      handleSessionError(err, 'Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }

  const loadQuestions = async () => {
    setQuestionsLoading(true)
    try {
      const res = await adminApi.get('/admin/forms/questions')
      const list = Array.isArray(res.data?.questions) ? res.data.questions : []
      setQuestions(list)
    } catch (err) {
      handleSessionError(err, 'Failed to load question bank')
    } finally {
      setQuestionsLoading(false)
    }
  }

  const deduplicateUnusedQuestionsForProduct = async (productId) => {
    const numericProductId = Number(productId)
    if (!Number.isInteger(numericProductId) || numericProductId <= 0) return
    try {
      const res = await adminApi.post('/admin/forms/questions/deduplicate', { productId: numericProductId })
      const deleted = Number(res.data?.deleted || 0)
      if (deleted > 0) {
        await loadQuestions()
        toast.success(`Removed ${deleted} duplicated question${deleted === 1 ? '' : 's'} not used in mapping`)
      }
    } catch (err) {
      handleSessionError(err, 'Failed to remove duplicated questions')
    }
  }

  useEffect(() => {
    loadProducts()
    loadQuestions()
  }, [])

  useEffect(() => {
    if (!selectedProductId) return
    deduplicateUnusedQuestionsForProduct(selectedProductId)
  }, [selectedProductId])

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(selectedProductId)) || null,
    [products, selectedProductId]
  )

  useEffect(() => {
    if (!selectedProduct) {
      setSectionsDraft([])
      setSelectedSectionKey('')
      setSelectedMappingQuestionId('')
      return
    }
    const nextSections = normalizeSections(selectedProduct.formSchema)
    setSectionsDraft(nextSections)
    setSelectedSectionKey(nextSections[0]?.key || '')
    setSelectedMappingQuestionId('')
  }, [selectedProduct])

  const selectedSection = useMemo(
    () => sectionsDraft.find((section) => section.key === selectedSectionKey) || null,
    [sectionsDraft, selectedSectionKey]
  )

  const addQuestions = async () => {
    const text = questionDraft.trim()
    if (!text) {
      toast.error('Enter at least one question')
      return
    }
    const incoming = text
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const incomingNormalized = incoming.map((entry) => normalizeQuestionDraftText(entry)).filter(Boolean)
    const incomingSet = new Set()
    const duplicateInDraft = new Set()
    incomingNormalized.forEach((normalized) => {
      if (incomingSet.has(normalized)) {
        duplicateInDraft.add(normalized)
        return
      }
      incomingSet.add(normalized)
    })
    const existingSet = new Set(
      questions
        .map((question) => normalizeQuestionDraftText(question.text || question.label || ''))
        .filter(Boolean)
    )
    const duplicateExisting = incomingNormalized.filter((normalized) => existingSet.has(normalized))
    if (duplicateInDraft.size > 0 || duplicateExisting.length > 0) {
      toast.error('No duplicated questions')
      return
    }
    setSavingQuestions(true)
    try {
      const payload = { text }
      if (selectedProductId) payload.productId = Number(selectedProductId)
      await adminApi.post('/admin/questions', payload)
      setQuestionDraft('')
      await loadQuestions()
      toast.success('Questions added')
    } catch (err) {
      handleSessionError(err, 'Failed to add questions')
    } finally {
      setSavingQuestions(false)
    }
  }

  const updateQuestionInputType = async (questionId, inputType) => {
    setQuestions((prev) =>
      prev.map((question) =>
        Number(question.id) === Number(questionId) ? { ...question, inputType } : question
      )
    )
    try {
      await adminApi.put(`/admin/questions/${questionId}`, { source: 'SYSTEM', inputType })
    } catch (err) {
      await loadQuestions()
      handleSessionError(err, 'Failed to update input type')
    }
  }

  const normalizeSelectOptions = (value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || '').trim()).filter(Boolean)
    }
    if (!value) return []
    return String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  const saveQuestionSelectOptions = async (question) => {
    const key = String(question.id)
    const draft = questionOptionDrafts[key] ?? ''
    const options = normalizeSelectOptions(draft)
    if (!options.length) {
      toast.error('Add at least one choice')
      return
    }
    try {
      await adminApi.put(`/admin/questions/${question.id}`, {
        source: 'SYSTEM',
        inputType: 'select',
        selectOptions: options,
      })
      setQuestions((prev) =>
        prev.map((row) => (Number(row.id) === Number(question.id) ? { ...row, selectOptions: options } : row))
      )
      setQuestionOptionDrafts((prev) => ({ ...prev, [key]: options.join(', ') }))
      toast.success('Choices saved')
    } catch (err) {
      handleSessionError(err, 'Failed to save select choices')
    }
  }

  const toggleMappedQuestion = (questionId) => {
    if (!selectedSection) {
      toast.error('Select a section first')
      return
    }
    const normalized = Number(questionId)
    setSectionsDraft((prev) =>
      prev.map((section) => {
        if (section.key !== selectedSection.key) return section
        const current = Array.isArray(section.questionIds) ? section.questionIds : []
        if (current.includes(normalized)) {
          return { ...section, questionIds: current.filter((id) => id !== normalized) }
        }
        return { ...section, questionIds: [...current, normalized] }
      })
    )
  }

  const moveMappedQuestion = (questionId, direction) => {
    if (!selectedSection) return
    const normalized = Number(questionId)
    setSectionsDraft((prev) =>
      prev.map((section) => {
        if (section.key !== selectedSection.key) return section
        const list = Array.isArray(section.questionIds) ? [...section.questionIds] : []
        const index = list.indexOf(normalized)
        if (index === -1) return section
        const nextIndex = index + direction
        if (nextIndex < 0 || nextIndex >= list.length) return section
        const temp = list[index]
        list[index] = list[nextIndex]
        list[nextIndex] = temp
        return { ...section, questionIds: list }
      })
    )
  }

  const saveProductSchema = async () => {
    if (!selectedProduct) {
      toast.error('Select a product first')
      return
    }
    setSavingSchema(true)
    try {
      await adminApi.put(`/admin/forms/products/${selectedProduct.id}`, {
        name: selectedProduct.name,
        formSchema: { sections: sectionsDraft },
      })
      await loadProducts()
      toast.success('Product sections and mapping saved')
    } catch (err) {
      handleSessionError(err, 'Failed to save product schema')
    } finally {
      setSavingSchema(false)
    }
  }

  const addProduct = async () => {
    const name = newProductName.trim()
    if (!name) {
      toast.error('Enter a product name')
      return
    }
    setAddingProduct(true)
    try {
      const res = await adminApi.post('/admin/products', { name })
      const created = res.data?.product
      await loadProducts()
      if (created?.id) {
        setSelectedProductId(String(created.id))
      }
      setNewProductName('')
      toast.success('Product added')
    } catch (err) {
      handleSessionError(err, 'Failed to add product')
    } finally {
      setAddingProduct(false)
    }
  }

  const removeSelectedProduct = async () => {
    if (!selectedProductId) {
      toast.error('Select a product first')
      return
    }
    const selected = products.find((item) => String(item.id) === String(selectedProductId))
    const confirmed = window.confirm(`Remove product "${selected?.name || selectedProductId}"?`)
    if (!confirmed) return
    setRemovingProduct(true)
    try {
      await adminApi.delete(`/admin/products/${selectedProductId}`)
      await loadProducts()
      setSectionsDraft([])
      setSelectedSectionKey('')
      setSelectedMappingQuestionId('')
      toast.success('Product removed')
    } catch (err) {
      handleSessionError(err, 'Failed to remove product')
    } finally {
      setRemovingProduct(false)
    }
  }

  const addSection = () => {
    if (!selectedProduct) {
      toast.error('Select a product first')
      return
    }
    const label = newSectionLabel.trim()
    if (!label) {
      toast.error('Enter a section name')
      return
    }
    const baseKey = normalizeSectionKey(label)
    if (!baseKey) {
      toast.error('Invalid section name')
      return
    }
    const key = ensureUniqueSectionKey(baseKey, sectionsDraft)
    const nextSection = { key, label, questionIds: [] }
    setSectionsDraft((prev) => [...prev, nextSection])
    setSelectedSectionKey(key)
    setNewSectionLabel('')
  }

  const removeSection = (sectionKey) => {
    const section = sectionsDraft.find((row) => row.key === sectionKey)
    const confirmed = window.confirm(`Remove section "${section?.label || sectionKey}"?`)
    if (!confirmed) return
    setSectionsDraft((prev) => {
      const next = prev.filter((row) => row.key !== sectionKey)
      if (selectedSectionKey === sectionKey) {
        setSelectedSectionKey(next[0]?.key || '')
      }
      return next
    })
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
  const normalizedMappingSearch = mappingSearch.trim().toLowerCase()
  const filteredMappingQuestions = questions.filter((question) => {
    if (!normalizedMappingSearch) return true
    const text = String(question.text || question.label || '').toLowerCase()
    const id = String(question.id || '')
    return text.includes(normalizedMappingSearch) || id.includes(normalizedMappingSearch)
  })
  const selectedMappingQuestion = questions.find(
    (question) => String(question.id) === String(selectedMappingQuestionId)
  )
  const selectedSectionQuestions = useMemo(() => {
    if (!selectedSection) return []
    const byId = new Map(questions.map((question) => [Number(question.id), question]))
    return (selectedSection.questionIds || [])
      .map((id) => byId.get(Number(id)))
      .filter(Boolean)
  }, [selectedSection, questions])

  useEffect(() => {
    if (!selectedSectionQuestions.length) {
      setSelectedMappingQuestionId('')
      return
    }
    const exists = selectedSectionQuestions.some(
      (question) => String(question.id) === String(selectedMappingQuestionId)
    )
    if (!exists) {
      setSelectedMappingQuestionId(String(selectedSectionQuestions[0].id))
    }
  }, [selectedSectionQuestions, selectedMappingQuestionId])

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-xl font-semibold">Forms Content Manager</h2>
        <p className="text-slate-600">Manage products, sections, question bank, input types, and mapping.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product Selector</div>
          <label className="mt-2 block text-sm font-semibold text-slate-700">
            Select product
            <select
              className={inputClass}
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              disabled={productsLoading}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <label className="block text-sm font-semibold text-slate-700">
              Add new product
              <input
                className={inputClass}
                value={newProductName}
                onChange={(event) => setNewProductName(event.target.value)}
                placeholder="Enter product name"
              />
            </label>
            <button
              type="button"
              className="pill-btn-primary mt-3 px-4"
              onClick={addProduct}
              disabled={addingProduct}
            >
              {addingProduct ? 'Adding...' : 'Add Product'}
            </button>
            <button
              type="button"
              className="pill-btn-ghost mt-2 px-4 text-red-600"
              onClick={removeSelectedProduct}
              disabled={!selectedProductId || removingProduct}
            >
              {removingProduct ? 'Removing...' : 'Remove Selected Product'}
            </button>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section Editor</div>
            <label className="mt-2 block text-sm font-semibold text-slate-700">
              Add section to selected product
              <input
                className={inputClass}
                value={newSectionLabel}
                onChange={(event) => setNewSectionLabel(event.target.value)}
                placeholder="e.g. Driver Info"
              />
            </label>
            <button type="button" className="pill-btn-primary mt-3 px-4" onClick={addSection}>
              Add Section
            </button>
            <div className="mt-3 space-y-2">
              {sectionsDraft.map((section) => (
                <div
                  key={section.key}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    section.key === selectedSectionKey
                      ? 'border-[#0b3b8c] bg-[#e8f0ff]'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    className="text-left font-semibold text-slate-800"
                    onClick={() => setSelectedSectionKey(section.key)}
                  >
                    {section.label}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600"
                    onClick={() => removeSection(section.key)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!sectionsDraft.length && (
                <div className="text-xs text-slate-500">No sections yet for this product.</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question Bank</div>
          <p className="mt-1 text-xs text-slate-500">Add comma-separated questions.</p>
          <textarea
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[96px]"
            value={questionDraft}
            onChange={(event) => setQuestionDraft(event.target.value)}
            placeholder="Example: Is the vehicle financed?, Annual mileage?, Years at current address?"
          />
          <div className="mt-3">
            <button
              type="button"
              className="pill-btn-primary px-4"
              onClick={addQuestions}
              disabled={savingQuestions}
            >
              {savingQuestions ? 'Adding...' : 'Add Questions'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product Mapping</div>
              <p className="mt-1 text-xs text-slate-500">
                Map questions to the selected section under this product.
              </p>
            </div>
            <button
              type="button"
              className="pill-btn-primary px-4"
              onClick={saveProductSchema}
              disabled={!selectedProduct || savingSchema}
            >
              {savingSchema ? 'Saving...' : 'Save Product Schema'}
            </button>
          </div>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Target section
            <select
              className={inputClass}
              value={selectedSectionKey}
              onChange={(event) => setSelectedSectionKey(event.target.value)}
              disabled={!sectionsDraft.length}
            >
              <option value="">Select section</option>
              {sectionsDraft.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search questions
            <input
              className={inputClass}
              value={mappingSearch}
              onChange={(event) => setMappingSearch(event.target.value)}
              placeholder="Search by question text or ID"
            />
          </label>

          {!selectedProduct && <div className="mt-3 text-slate-500">Select a product to manage mapping.</div>}
          {selectedProduct && !selectedSection && (
            <div className="mt-3 text-slate-500">Add/select a section first, then map questions.</div>
          )}
          {selectedProduct && selectedSection && (
            <div className="mt-3 space-y-2 max-h-[360px] overflow-auto pr-1">
              {filteredMappingQuestions.map((question) => {
                const checked = (selectedSection.questionIds || []).includes(Number(question.id))
                return (
                  <label
                    key={`map-${question.id}`}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    onClick={() => setSelectedMappingQuestionId(String(question.id))}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={checked}
                      onChange={() => {
                        setSelectedMappingQuestionId(String(question.id))
                        toggleMappedQuestion(question.id)
                      }}
                    />
                    <div>
                      <div className="font-semibold text-slate-800">
                        #{question.id} {question.text || question.label}
                      </div>
                      <div className="text-xs text-slate-500">Type: {question.inputType || 'general'}</div>
                    </div>
                  </label>
                )
              })}
              {filteredMappingQuestions.length === 0 && (
                <div className="text-slate-500">No questions match your search.</div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Input Types</div>
          {questionsLoading && <div className="mt-3 text-slate-500">Loading question...</div>}
          {!questionsLoading && !selectedSection && (
            <div className="mt-3 text-slate-500">Select a section first.</div>
          )}
          {!questionsLoading && selectedSection && selectedSectionQuestions.length === 0 && (
            <div className="mt-3 text-slate-500">No selected questions yet in this section.</div>
          )}
          {!questionsLoading && selectedSection && selectedSectionQuestions.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Questions</div>
              <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                {selectedSectionQuestions.map((question, index) => {
                  const selected = String(question.id) === String(selectedMappingQuestionId)
                  return (
                    <div
                      key={`selected-${question.id}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                        selected ? 'border-[#0b3b8c] bg-[#e8f0ff]' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        className="text-left font-semibold text-slate-800"
                        onClick={() => setSelectedMappingQuestionId(String(question.id))}
                      >
                        #{question.id} {question.text || question.label}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs"
                          onClick={() => moveMappedQuestion(question.id, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="pill-btn-ghost px-2 py-1 text-xs"
                          onClick={() => moveMappedQuestion(question.id, 1)}
                          disabled={index === selectedSectionQuestions.length - 1}
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {!questionsLoading && !selectedMappingQuestion && selectedSectionQuestions.length > 0 && (
            <div className="mt-3 text-slate-500">Select one of the selected questions to edit its input type.</div>
          )}
          {!questionsLoading && selectedMappingQuestion && (
            <div className="mt-3">
              <div className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="font-semibold text-slate-800">
                  #{selectedMappingQuestion.id} {selectedMappingQuestion.text || selectedMappingQuestion.label}
                </div>
                <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Input type
                  <select
                    className={inputClass}
                    value={selectedMappingQuestion.inputType || 'general'}
                    onChange={(event) => updateQuestionInputType(selectedMappingQuestion.id, event.target.value)}
                  >
                    {INPUT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                {(selectedMappingQuestion.inputType || 'general') === 'select' && (
                  <div className="mt-2 space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Select choices (comma separated)
                      <input
                        className={inputClass}
                        value={
                          questionOptionDrafts[String(selectedMappingQuestion.id)] ??
                          (Array.isArray(selectedMappingQuestion.selectOptions)
                            ? selectedMappingQuestion.selectOptions.join(', ')
                            : '')
                        }
                        onChange={(event) =>
                          setQuestionOptionDrafts((prev) => ({
                            ...prev,
                            [String(selectedMappingQuestion.id)]: event.target.value,
                          }))
                        }
                        placeholder="Choice 1, Choice 2, Choice 3"
                      />
                    </label>
                    <button
                      type="button"
                      className="pill-btn-ghost px-3 py-1 text-xs"
                      onClick={() => saveQuestionSelectOptions(selectedMappingQuestion)}
                    >
                      Save choices
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

