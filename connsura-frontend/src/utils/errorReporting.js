import { API_URL } from '../services/api'

const ERROR_ENDPOINT = `${API_URL}/errors`
const DEDUPE_WINDOW_MS = 30000
const RECENT_ERRORS = new Map()
let initialized = false

const clamp = (value, maxLength) => {
  if (value === null || value === undefined) return null
  const str = String(value)
  if (!str.trim()) return null
  if (!maxLength || str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}...`
}

const getSessionId = () => {
  try {
    const key = 'connsura_error_session'
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session_${Math.random().toString(36).slice(2)}${Date.now()}`
    sessionStorage.setItem(key, generated)
    return generated
  } catch (err) {
    return null
  }
}

const shouldReport = (fingerprint) => {
  if (!fingerprint) return true
  const now = Date.now()
  const last = RECENT_ERRORS.get(fingerprint)
  if (last && now - last < DEDUPE_WINDOW_MS) return false
  RECENT_ERRORS.set(fingerprint, now)
  return true
}

const isEnabled = () => {
  const flag = import.meta.env.VITE_ERROR_REPORTING
  if (flag === 'false' || flag === '0') return false
  return true
}

const sendPayload = (payload) => {
  const body = JSON.stringify(payload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(ERROR_ENDPOINT, blob)
      return
    } catch (err) {
      // fall through to fetch
    }
  }
  fetch(ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

export const reportError = (payload = {}) => {
  if (!isEnabled()) return
  const message = clamp(payload.message, 1000)
  if (!message) return

  const fingerprint = clamp(payload.fingerprint, 200) || `${message}|${payload.source || 'frontend'}`
  if (!shouldReport(fingerprint)) return

  const entry = {
    level: clamp(payload.level, 20) || 'error',
    source: clamp(payload.source, 40) || 'frontend',
    message,
    stack: clamp(payload.stack, 8000),
    url: clamp(payload.url, 1000) || (typeof window !== 'undefined' ? window.location.href : null),
    userAgent: clamp(payload.userAgent, 400) || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    componentStack: clamp(payload.componentStack, 6000),
    release: clamp(payload.release, 120) || import.meta.env.VITE_APP_VERSION || null,
    sessionId: clamp(payload.sessionId, 120) || getSessionId(),
    fingerprint,
    metadata: payload.metadata || null,
  }

  sendPayload(entry)
}

export const initErrorReporting = () => {
  if (initialized) return
  initialized = true
  if (!isEnabled()) return

  window.addEventListener('error', (event) => {
    if (!event) return
    const error = event.error
    if (error) {
      reportError({
        source: 'window',
        message: error.message || 'Unhandled error',
        stack: error.stack,
        metadata: {
          filename: event.filename || null,
          lineno: event.lineno || null,
          colno: event.colno || null,
        },
      })
      return
    }
    if (event.message) {
      reportError({
        source: 'window',
        message: event.message,
        metadata: {
          filename: event.filename || null,
          lineno: event.lineno || null,
          colno: event.colno || null,
        },
      })
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    if (reason instanceof Error) {
      reportError({
        source: 'unhandledrejection',
        message: reason.message || 'Unhandled promise rejection',
        stack: reason.stack,
      })
      return
    }
    reportError({
      source: 'unhandledrejection',
      message: typeof reason === 'string' ? reason : 'Unhandled promise rejection',
      metadata: { reason },
    })
  })
}
