const questionBank = require('../data/insuranceQuestionBank')

const normalizeQuestion = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const buildQuestionRecords = (questions = [], source = 'SYSTEM') => {
  const unique = new Map()
  questions.forEach((question) => {
    if (!question) return
    const text = question.toString().trim()
    if (!text) return
    const normalized = normalizeQuestion(text)
    if (!normalized || unique.has(normalized)) return
    unique.set(normalized, { text, normalized, source })
  })
  return Array.from(unique.values())
}

module.exports = {
  questionBank,
  normalizeQuestion,
  buildQuestionRecords,
}
