const crypto = require('crypto')
const prisma = require('../../prisma')

const MAX_STRING_LENGTH = 500
const MAX_METADATA_DEPTH = 6
const MAX_METADATA_KEYS = 100
const MAX_METADATA_ARRAY = 50

const SENSITIVE_KEY_PATTERNS = [
  'profile',
  'profiledata',
  'snapshot',
  'forms',
  'drivers',
  'vehicles',
  'address',
  'password',
  'secret',
  'token',
  'otp',
  'backup',
  'code',
  'ssn',
  'dob',
  'birth',
  'license',
  'vin',
]

const isSensitiveKey = (key) => {
  const normalized = String(key || '').toLowerCase()
  if (!normalized) return false
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern))
}

const normalizeString = (value, maxLength = MAX_STRING_LENGTH) => {
  if (value === null || value === undefined) return null
  const text = String(value)
  if (!maxLength || text.length <= maxLength) return text
  return text.slice(0, maxLength)
}

const sanitizeMetadata = (value, depth = 0) => {
  if (value === null || value === undefined) return value
  if (depth > MAX_METADATA_DEPTH) return undefined
  if (typeof value === 'string') return normalizeString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_METADATA_ARRAY)
      .map((entry) => sanitizeMetadata(entry, depth + 1))
      .filter((entry) => entry !== undefined)
  }
  if (typeof value !== 'object') return undefined

  const output = {}
  let count = 0
  for (const [key, entry] of Object.entries(value)) {
    if (count >= MAX_METADATA_KEYS) break
    if (isSensitiveKey(key)) {
      output[key] = '[redacted]'
      count += 1
      continue
    }
    const sanitized = sanitizeMetadata(entry, depth + 1)
    if (sanitized !== undefined) {
      output[key] = sanitized
      count += 1
    }
  }
  return output
}

const buildPreferenceSnapshot = (prefs) => {
  if (!prefs) return null
  return sanitizeMetadata({
    email_profile_updates_enabled: Boolean(prefs.emailProfileUpdatesEnabled),
    email_feature_updates_enabled: Boolean(prefs.emailFeatureUpdatesEnabled),
    email_marketing_enabled: Boolean(prefs.emailMarketingEnabled),
    preferences_version: prefs.preferencesVersion ?? null,
    updated_by_user_id: prefs.updatedByUserId ?? null,
  })
}

const hashUserAgent = (userAgent) => {
  if (!userAgent) return null
  return crypto.createHash('sha256').update(String(userAgent)).digest('hex')
}

const createNotificationLog = async (payload) => {
  try {
    const record = await prisma.notificationLog.create({
      data: {
        channel: payload.channel,
        eventType: normalizeString(payload.eventType, 200) || 'UNKNOWN',
        severity: payload.severity || 'INFO',
        userId: payload.userId || null,
        recipientEmail: normalizeString(payload.recipientEmail, 320),
        recipientUserAgentHash: normalizeString(payload.recipientUserAgentHash, 128),
        subject: normalizeString(payload.subject, 200),
        provider: normalizeString(payload.provider, 100),
        providerMessageId: normalizeString(payload.providerMessageId, 255),
        status: payload.status || 'QUEUED',
        failureReason: normalizeString(payload.failureReason, 500),
        required: payload.required !== undefined ? Boolean(payload.required) : true,
        preferenceSnapshot: payload.preferenceSnapshot ? sanitizeMetadata(payload.preferenceSnapshot) : undefined,
        metadata: payload.metadata ? sanitizeMetadata(payload.metadata) : undefined,
        actorType: payload.actorType || 'SYSTEM',
        actorUserId: payload.actorUserId || null,
        correlationId: normalizeString(payload.correlationId, 120),
        dedupeKey: normalizeString(payload.dedupeKey, 120),
      },
    })
    return record
  } catch (err) {
    console.error('notification log error', err)
    return null
  }
}

const updateNotificationLog = async (id, updates = {}) => {
  if (!id) return null
  try {
    const record = await prisma.notificationLog.update({
      where: { id },
      data: {
        status: updates.status || undefined,
        provider: updates.provider ? normalizeString(updates.provider, 100) : undefined,
        providerMessageId: updates.providerMessageId
          ? normalizeString(updates.providerMessageId, 255)
          : undefined,
        failureReason: updates.failureReason ? normalizeString(updates.failureReason, 500) : undefined,
      },
    })
    return record
  } catch (err) {
    console.error('notification log update error', err)
    return null
  }
}

const logInAppNotification = async ({
  eventType,
  severity = 'INFO',
  userId,
  required = true,
  metadata,
  actorType = 'SYSTEM',
  actorUserId = null,
  correlationId,
  dedupeKey,
} = {}) => {
  return createNotificationLog({
    channel: 'IN_APP',
    eventType,
    severity,
    userId,
    recipientEmail: null,
    status: 'SENT',
    required,
    metadata,
    actorType,
    actorUserId,
    correlationId,
    dedupeKey,
  })
}

module.exports = {
  buildPreferenceSnapshot,
  createNotificationLog,
  hashUserAgent,
  logInAppNotification,
  sanitizeMetadata,
  updateNotificationLog,
}
