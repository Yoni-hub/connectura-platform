import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
const emptyObject = {}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const createQuestionDraft = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  questionText: '',
  inputType: 'general',
  optionsText: '',
})

const parseOptionsText = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

export default function PassportProductEditor() {
  const { productInstanceId } = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schemaSaving, setSchemaSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [activeSectionKey, setActiveSectionKey] = useState('')
  const [formValues, setFormValues] = useState({})
  const [customQuestionDrafts, setCustomQuestionDrafts] = useState([createQuestionDraft()])

  const sections = useMemo(() => (Array.isArray(form?.sections) ? form.sections : []), [form?.sections])
  const activeSection = sections.find((section) => section.key === activeSectionKey) || sections[0] || null
  const isCustom = form?.productInstance?.productSource === 'CUSTOM_PRODUCT'
  const sectionValues = formValues[activeSectionKey] || emptyObject

  const loadForm = async (preferredSectionKey = '') => {
    if (!productInstanceId) return
    setLoading(true)
    try {
      const res = await api.get(`/passport/products/${productInstanceId}/form`)
      const nextForm = res.data || null
      setForm(nextForm)
      const firstSectionKey = nextForm?.sections?.[0]?.key || ''
      const resolvedSection = preferredSectionKey || activeSectionKey || firstSectionKey
      setActiveSectionKey(resolvedSection)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load passport form')
    } finally {
      setLoading(false)
    }
  }

  const loadSection = async (sectionKey) => {
    if (!productInstanceId || !sectionKey) return
    try {
      const res = await api.post(`/passport/products/${productInstanceId}/section-load`, { sectionKey })
      const values = isPlainObject(res.data?.values) ? res.data.values : {}
      setFormValues((prev) => ({ ...prev, [sectionKey]: values }))
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load section values')
    }
  }

  useEffect(() => {
    loadForm()
  }, [productInstanceId])

  useEffect(() => {
    if (!activeSectionKey) return
    loadSection(activeSectionKey)
  }, [activeSectionKey, productInstanceId])

  const updateField = (fieldKey, value) => {
    setFormValues((prev) => ({
      ...prev,
      [activeSectionKey]: {
        ...(prev[activeSectionKey] || {}),
        [fieldKey]: value,
      },
    }))
  }

  const saveActiveSection = async () => {
    if (!activeSectionKey) return
    setSaving(true)
    try {
      await api.post(`/passport/products/${productInstanceId}/section-save`, {
        sectionKey: activeSectionKey,
        values: sectionValues,
      })
      toast.success('Saved')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to save section')
    } finally {
      setSaving(false)
    }
  }

  const saveCustomQuestions = async () => {
    if (!isCustom) return
    const normalized = customQuestionDrafts
      .map((draft, index) => ({
        questionText: String(draft.questionText || '').trim(),
        inputType: draft.inputType || 'general',
        options: draft.inputType === 'select' ? parseOptionsText(draft.optionsText) : [],
        orderIndex: index,
      }))
      .filter((question) => question.questionText)
    setSchemaSaving(true)
    try {
      await api.put(`/passport/products/${productInstanceId}/custom-questions`, { questions: normalized })
      await loadForm('custom')
      await loadSection('custom')
      toast.success('Custom questions updated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to save custom questions')
    } finally {
      setSchemaSaving(false)
    }
  }

  const addCustomQuestion = () => {
    setCustomQuestionDrafts((prev) => [...prev, createQuestionDraft()])
  }

  const removeCustomQuestion = (id) => {
    setCustomQuestionDrafts((prev) => {
      const next = prev.filter((row) => row.id !== id)
      return next.length ? next : [createQuestionDraft()]
    })
  }

  const updateCustomDraft = (id, patch) => {
    setCustomQuestionDrafts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
  }

  const renderField = (field) => {
    const value = sectionValues[field.key] ?? ''
    const type = String(field.type || 'general').toLowerCase()
    if (type === 'select' || type === 'yes/no') {
      const options = Array.isArray(field.options) && field.options.length ? field.options : type === 'yes/no' ? ['Yes', 'No'] : []
      return (
        <select className={inputClass} value={value} onChange={(event) => updateField(field.key, event.target.value)}>
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
      return <input className={inputClass} type="number" value={value} onChange={(event) => updateField(field.key, event.target.value)} />
    }
    if (type === 'date') {
      return <input className={inputClass} type="date" value={value} onChange={(event) => updateField(field.key, event.target.value)} />
    }
    return <input className={inputClass} type="text" value={value} onChange={(event) => updateField(field.key, event.target.value)} />
  }

  return (
    <main className="page-shell py-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {form?.productInstance?.productName || 'My Passport Product'}
            </h1>
            <p className="text-sm text-slate-600">Fill and save each section. Values are hydrated on refresh.</p>
          </div>
          <Link className="pill-btn-ghost px-3 py-1.5 text-sm" to="/passport">
            Back to My Passport
          </Link>
        </div>

        {loading && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading...</div>}

        {!loading && isCustom && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Build your custom form</div>
            <div className="space-y-2">
              {customQuestionDrafts.map((draft, index) => (
                <div key={draft.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                    <input
                      className={inputClass}
                      value={draft.questionText}
                      onChange={(event) => updateCustomDraft(draft.id, { questionText: event.target.value })}
                      placeholder={`Question ${index + 1}`}
                    />
                    <select
                      className={inputClass}
                      value={draft.inputType}
                      onChange={(event) => updateCustomDraft(draft.id, { inputType: event.target.value })}
                    >
                      <option value="general">General</option>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="yes/no">Yes/No</option>
                      <option value="select">Select</option>
                    </select>
                  </div>
                  {draft.inputType === 'select' && (
                    <input
                      className={inputClass}
                      value={draft.optionsText}
                      onChange={(event) => updateCustomDraft(draft.id, { optionsText: event.target.value })}
                      placeholder="Select options, comma separated"
                    />
                  )}
                  <div className="flex justify-end">
                    <button type="button" className="pill-btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => removeCustomQuestion(draft.id)}>
                      Remove question
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="pill-btn-ghost px-3 py-1 text-xs" onClick={addCustomQuestion}>
                Add question
              </button>
              <button type="button" className="pill-btn-primary px-4 py-1 text-xs" onClick={saveCustomQuestions} disabled={schemaSaving}>
                {schemaSaving ? 'Saving...' : 'Save custom questions'}
              </button>
            </div>
          </div>
        )}

        {!loading && form && (
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <aside className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</div>
              {sections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                    activeSectionKey === section.key ? 'bg-[#e8f0ff] text-[#0b3b8c]' : 'bg-slate-50 text-slate-700'
                  }`}
                  onClick={() => setActiveSectionKey(section.key)}
                >
                  {section.label}
                </button>
              ))}
            </aside>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">{activeSection?.label || 'Section'}</div>
              {!activeSection?.fields?.length && (
                <div className="text-sm text-slate-500">
                  No fields in this section. Add mapping in Admin Forms Content Manager.
                </div>
              )}
              {(activeSection?.fields || []).map((field) => (
                <label key={field.key} className="block text-sm text-slate-700 space-y-1">
                  <div>{field.label}</div>
                  {renderField(field)}
                </label>
              ))}
              <div className="flex justify-end">
                <button type="button" className="pill-btn-primary px-5" onClick={saveActiveSection} disabled={saving}>
                  {saving ? 'Saving...' : 'Save section'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
