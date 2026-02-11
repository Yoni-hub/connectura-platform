const express = require('express')
const fs = require('fs')
const path = require('path')
const prisma = require('../prisma')
const { getAuthToken } = require('../middleware/auth')
const { verifyToken } = require('../utils/token')

const router = express.Router()

const ERROR_LOG_PATH = process.env.ERROR_LOG_PATH || path.join(__dirname, '..', '..', 'error-events.log')

const clamp = (value, maxLength) => {
  if (value === null || value === undefined) return null
  const str = String(value)
  if (!str.trim()) return null
  if (!maxLength || str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}...`
}

const safeJsonStringify = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch (err) {
    return String(value)
  }
}

const resolveUserId = (req) => {
  const token = getAuthToken(req)
  if (!token) return null
  try {
    const decoded = verifyToken(token)
    const candidate = Number(decoded?.id || decoded?.userId)
    if (!Number.isFinite(candidate)) return null
    return candidate
  } catch (err) {
    return null
  }
}

const appendErrorLog = (entry) => {
  try {
    const dir = path.dirname(ERROR_LOG_PATH)
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.appendFile(ERROR_LOG_PATH, `${JSON.stringify(entry)}\n`, () => {})
  } catch (err) {
    // ignore file log failures to avoid blocking the API response
  }
}

router.post('/', async (req, res) => {
  const payload = req.body || {}
  const message = clamp(payload.message, 1000)
  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  const entry = {
    level: clamp(payload.level, 20) || 'error',
    source: clamp(payload.source, 40) || 'frontend',
    message,
    stack: clamp(payload.stack, 8000),
    url: clamp(payload.url, 1000),
    userAgent: clamp(payload.userAgent, 400),
    componentStack: clamp(payload.componentStack, 6000),
    release: clamp(payload.release, 120),
    sessionId: clamp(payload.sessionId, 120),
    fingerprint: clamp(payload.fingerprint, 200),
    metadata: clamp(safeJsonStringify(payload.metadata), 8000),
    userId: resolveUserId(req),
  }

  const logEntry = {
    ...entry,
    createdAt: new Date().toISOString(),
  }
  appendErrorLog(logEntry)

  try {
    const created = await prisma.errorEvent.create({ data: entry })
    return res.status(201).json({ ok: true, id: created.id })
  } catch (err) {
    console.error('error event create failed', err)
    return res.status(202).json({ ok: false })
  }
})

module.exports = router
