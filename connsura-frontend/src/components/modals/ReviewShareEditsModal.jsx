import { useMemo } from 'react'
import Modal from '../ui/Modal'

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

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const normalizeValue = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeValue(item))
      .filter(Boolean)
      .join(', ')
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

const flattenChangedFields = (beforeValue, afterValue, path = '') => {
  if (Array.isArray(afterValue)) {
    return afterValue.flatMap((item, index) =>
      flattenChangedFields(
        Array.isArray(beforeValue) ? beforeValue[index] : undefined,
        item,
        path ? `${path}[${index + 1}]` : `[${index + 1}]`
      )
    )
  }
  if (isObject(afterValue)) {
    return Object.keys(afterValue).flatMap((key) =>
      flattenChangedFields(
        isObject(beforeValue) ? beforeValue[key] : undefined,
        afterValue[key],
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

export default function ReviewShareEditsModal({ open, onClose, share, currentForms, onApprove, onDecline }) {
  const pendingForms = share?.pendingEdits?.forms || {}
  const baselineForms = currentForms || share?.snapshot?.forms || {}

  const changes = useMemo(() => {
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
    return rows
  }, [baselineForms, pendingForms])

  return (
    <Modal title="Review profile edits" open={open} onClose={onClose} panelClassName="max-w-3xl">
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          {`Edits submitted by ${share?.recipientName || 'a shared link'}.`}
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {changes.length ? (
            changes.map((change, index) => (
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
          <button type="button" className="pill-btn-ghost px-4" onClick={onDecline}>
            Decline & stop sharing
          </button>
          <button type="button" className="pill-btn-primary px-5" onClick={onApprove}>
            Accept changes
          </button>
        </div>
      </div>
    </Modal>
  )
}
