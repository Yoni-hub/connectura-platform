const questionBank = require('../data/insuranceQuestionBank')

const normalizeQuestion = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const QUESTION_INPUT_TYPES = new Set(['general', 'select', 'yes/no', 'number', 'date', 'text'])
const normalizeInputType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'yesno' || normalized === 'yes-no' || normalized === 'yes_no') return 'yes/no'
  if (QUESTION_INPUT_TYPES.has(normalized)) return normalized
  return ''
}

const normalizeSelectOptionsList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
      }
    } catch {
      // Fall back to comma-separated parsing.
    }
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

const resolveQuestionText = (question) => {
  if (question === null || question === undefined) return ''
  if (typeof question === 'string' || typeof question === 'number') {
    return String(question).trim()
  }
  if (typeof question === 'object') {
    if (question.text !== undefined) return String(question.text).trim()
    if (question.question !== undefined) return String(question.question).trim()
  }
  return String(question).trim()
}

const resolveQuestionConfig = (question) => {
  if (!question || typeof question !== 'object') return {}
  const inputType = normalizeInputType(question.inputType)
  const selectOptions = normalizeSelectOptionsList(question.selectOptions)
  return {
    ...(inputType ? { inputType } : {}),
    ...(selectOptions.length ? { selectOptions: JSON.stringify(selectOptions) } : {}),
  }
}

const buildQuestionRecords = (questions = [], source = 'SYSTEM', productId = null, customerId = null) => {
  const unique = new Map()
  questions.forEach((question) => {
    if (!question) return
    const text = resolveQuestionText(question)
    if (!text) return
    const normalized = normalizeQuestion(text)
    if (!normalized || unique.has(normalized)) return
    const config = resolveQuestionConfig(question)
    unique.set(normalized, { text, normalized, source, productId, customerId, ...config })
  })
  return Array.from(unique.values())
}

const buildCustomerQuestionRecords = (questions = [], productId = null, customerId = null, formName = '') => {
  const unique = new Map()
  const safeFormName = (formName || '').toString().trim()
  questions.forEach((question) => {
    if (!question) return
    const text = question.toString().trim()
    if (!text) return
    const normalized = normalizeQuestion(text)
    if (!normalized || unique.has(normalized)) return
    unique.set(normalized, {
      text,
      normalized,
      productId,
      customerId,
      formName: safeFormName,
    })
  })
  return Array.from(unique.values())
}

module.exports = {
  questionBank,
  normalizeQuestion,
  buildQuestionRecords,
  buildCustomerQuestionRecords,
}
