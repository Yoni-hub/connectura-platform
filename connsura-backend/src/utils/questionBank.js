const questionBank = require('../data/insuranceQuestionBank')

const normalizeQuestion = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const buildQuestionRecords = (questions = [], source = 'SYSTEM', productId = null, customerId = null) => {
  const unique = new Map()
  questions.forEach((question) => {
    if (!question) return
    const text = question.toString().trim()
    if (!text) return
    const normalized = normalizeQuestion(text)
    if (!normalized || unique.has(normalized)) return
    unique.set(normalized, { text, normalized, source, productId, customerId })
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
