const express = require('express')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const prisma = require('../src/prisma')
const { generateToken } = require('../src/utils/token')
const { authGuard } = require('../src/middleware/auth')
const { sendEmail } = require('../src/utils/emailClient')
const { sendEmailOtp, verifyEmailOtp } = require('../src/utils/emailOtp')
const { logInAppNotification } = require('../src/utils/notifications/logging')
const { logClientAudit } = require('../src/utils/auditLog')
const { lookupGeoIp } = require('../src/utils/geoip')
const {
  notifyEmailChanged,
  notifyLoginAlert,
  notifyPasswordChanged,
} = require('../src/utils/notifications/dispatcher')
const {
  LEGAL_DOC_TYPES,
  getLatestDocuments,
  getRequiredDocTypes,
  getConsentStatus,
  buildConsentItems,
} = require('../src/utils/legalDocuments')
const {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrDataUrl,
  verifyTotp,
  generateBackupCodes,
  consumeBackupCode,
  generateRecoveryId,
} = require('../src/utils/totp')

const router = express.Router()

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'connsura_session'
const SESSION_COOKIE_PATH = process.env.SESSION_COOKIE_PATH || '/'
const SESSION_COOKIE_SAMESITE = process.env.SESSION_COOKIE_SAMESITE || 'lax'
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN || ''
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE || ''
const SESSION_COOKIE_MAX_AGE = process.env.SESSION_COOKIE_MAX_AGE || '7d'
const DEVICE_COOKIE_NAME = process.env.DEVICE_COOKIE_NAME || 'connsura_device'
const DEVICE_COOKIE_MAX_AGE = process.env.DEVICE_COOKIE_MAX_AGE || '365d'

const parseDurationMs = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    return Number(raw) * 1000
  }
  const match = raw.match(/^(\d+)(s|m|h|d)$/i)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  return amount * multipliers[unit]
}

const getCookieValue = (req, name) => {
  const header = req.headers?.cookie
  if (!header) return null
  const parts = header.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    if (key !== name) continue
    const value = trimmed.slice(eqIndex + 1)
    return decodeURIComponent(value)
  }
  return null
}

const getSessionCookieOptions = () => {
  const rawSameSite = String(SESSION_COOKIE_SAMESITE || '').toLowerCase()
  const sameSite = ['lax', 'strict', 'none'].includes(rawSameSite) ? rawSameSite : 'lax'
  const domain = String(SESSION_COOKIE_DOMAIN || '').trim()
  const secureFromEnv = String(SESSION_COOKIE_SECURE || '').toLowerCase() === 'true'
  const secure = secureFromEnv || process.env.NODE_ENV === 'production' || sameSite === 'none'
  const options = {
    httpOnly: true,
    sameSite,
    secure,
    path: SESSION_COOKIE_PATH || '/',
  }
  if (domain) {
    options.domain = domain
  }
  return options
}

const getSessionCookieMaxAge = () => parseDurationMs(SESSION_COOKIE_MAX_AGE) || 7 * 24 * 60 * 60 * 1000

const setSessionCookie = (res, token) => {
  if (!token) return
  const options = getSessionCookieOptions()
  res.cookie(SESSION_COOKIE_NAME, token, { ...options, maxAge: getSessionCookieMaxAge() })
}

const getDeviceCookieOptions = () => {
  const base = getSessionCookieOptions()
  return { ...base, httpOnly: true }
}

const getDeviceCookieMaxAge = () =>
  parseDurationMs(DEVICE_COOKIE_MAX_AGE) || 365 * 24 * 60 * 60 * 1000

const setDeviceCookie = (res, token) => {
  if (!token) return
  const options = getDeviceCookieOptions()
  res.cookie(DEVICE_COOKIE_NAME, token, { ...options, maxAge: getDeviceCookieMaxAge() })
}

const clearSessionCookie = (res) => {
  const options = getSessionCookieOptions()
  res.clearCookie(SESSION_COOKIE_NAME, options)
}

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  emailPending: user.emailPending || null,
  name: user.customer?.name || user.email || '',
  role: user.role,
  emailVerified: Boolean(user.emailVerified),
  customerId: user.customer?.id,
  totpEnabled: Boolean(user.totpEnabled),
  recoveryId: user.totpRecoveryId || null,
})

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase()
const PASSWORD_PENDING_TTL_MS = Number(
  process.env.PASSWORD_CHANGE_TTL_MS || process.env.EMAIL_OTP_TTL_MS || 10 * 60 * 1000
)
const RECOVERY_WINDOW_MS = Number(process.env.RECOVERY_WINDOW_MS || 15 * 60 * 1000)
const RECOVERY_MAX_ATTEMPTS = Number(process.env.RECOVERY_MAX_ATTEMPTS || 5)
const RECOVERY_ERROR = 'Unable to recover account. Check your details and try again.'
const recoveryAttempts = new Map()

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const ip = raw || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || ''
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '')
}

const hashValue = (value = '') => crypto.createHash('sha256').update(String(value)).digest('hex')

const parseAuditDiff = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

const getIpPrefix = (ip) => {
  if (!ip) return null
  const value = String(ip).trim()
  if (!value) return null
  if (value.includes(':')) {
    const parts = value.split(':').filter(Boolean)
    if (!parts.length) return null
    return `${parts.slice(0, 4).join(':')}::/64`
  }
  const octets = value.split('.')
  if (octets.length < 4) return null
  return `${octets.slice(0, 3).join('.')}.0/24`
}

const ensureUserDevice = async ({ userId, deviceId, ipPrefix, userAgent }) => {
  const existing = await prisma.userDevice.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
  })
  if (!existing) {
    const created = await prisma.userDevice.create({
      data: {
        userId,
        deviceId,
        lastIpPrefix: ipPrefix,
        lastUserAgent: userAgent || null,
        lastSeenAt: new Date(),
      },
    })
    return { record: created, isNewDevice: true, ipChanged: false }
  }
  const previousPrefix = existing.lastIpPrefix || null
  const ipChanged = Boolean(ipPrefix && previousPrefix && previousPrefix !== ipPrefix)
  await prisma.userDevice.update({
    where: { id: existing.id },
    data: {
      lastIpPrefix: ipPrefix || existing.lastIpPrefix,
      lastUserAgent: userAgent || existing.lastUserAgent,
      lastSeenAt: new Date(),
    },
  })
  return { record: existing, isNewDevice: false, ipChanged }
}

const upsertUserSession = async ({
  userId,
  sessionId,
  ip,
  ipPrefix,
  userAgent,
  location,
}) => {
  if (!sessionId) return null
  const payload = {
    ip: ip || null,
    ipPrefix: ipPrefix || null,
    userAgent: userAgent || null,
    city: location?.city || null,
    region: location?.region || null,
    country: location?.country || null,
    locationLabel: location?.locationLabel || null,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    lastSeenAt: new Date(),
    revokedAt: null,
  }
  return prisma.userSession.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    create: { userId, sessionId, ...payload },
    update: payload,
  })
}

const PASSWORD_CHANGE_SUBJECT = 'Your Connsura password was changed'
const EMAIL_VERIFIED_SUBJECT = 'Your email was verified'
const ACCOUNT_DELETED_SUBJECT = 'Your Connsura account was deleted'
const TWO_FACTOR_ENABLED_SUBJECT = 'Two-factor authentication enabled'
const TWO_FACTOR_DISABLED_SUBJECT = 'Two-factor authentication disabled'
const LOGOUT_OTHER_DEVICES_SUBJECT = 'You were logged out of other devices'
const ACCOUNT_DEACTIVATED_SUBJECT = 'Your Connsura account was deactivated'

const sendPasswordChangeEmail = async (email) => notifyPasswordChanged({ email })

const buildEmailVerifiedEmail = () => ({
  text: 'Your email was verified.\n\nIf this was not you, contact us immediately at security@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Email verified</h2>
      <p style="margin: 0 0 12px 0;">Your email was verified.</p>
      <p style="margin: 0;">If this was not you, contact us immediately at security@connsura.com.</p>
    </div>
  `,
})

const sendEmailVerifiedEmail = async (email, userId) => {
  const content = buildEmailVerifiedEmail()
  return sendEmail({
    to: email,
    subject: EMAIL_VERIFIED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
    log: {
      eventType: 'EMAIL_VERIFIED',
      severity: 'SECURITY',
      userId: userId || null,
      required: true,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorUserId: userId || null,
    },
  })
}

const buildAccountDeletedEmail = () => ({
  text:
    'Your Connsura account was deleted.\n\nIf this was not you, contact us immediately at support@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Account deleted</h2>
      <p style="margin: 0 0 12px 0;">Your Connsura account was deleted.</p>
      <p style="margin: 0;">If this was not you, contact us immediately at support@connsura.com.</p>
    </div>
  `,
})

const sendAccountDeletedEmail = async (email, userId) => {
  const content = buildAccountDeletedEmail()
  return sendEmail({
    to: email,
    subject: ACCOUNT_DELETED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'support@connsura.com',
    log: {
      eventType: 'ACCOUNT_DELETED',
      severity: 'SECURITY',
      userId: userId || null,
      required: true,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorUserId: userId || null,
    },
  })
}

const buildTwoFactorEnabledEmail = () => ({
  text:
    'Two-factor authentication has been enabled on your Connsura account.\n\nIf this was not you, contact us immediately at security@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Two-factor authentication enabled</h2>
      <p style="margin: 0 0 12px 0;">Two-factor authentication has been enabled on your Connsura account.</p>
      <p style="margin: 0;">If this was not you, contact us immediately at security@connsura.com.</p>
    </div>
  `,
})

const sendTwoFactorEnabledEmail = async (email, userId) => {
  const content = buildTwoFactorEnabledEmail()
  return sendEmail({
    to: email,
    subject: TWO_FACTOR_ENABLED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
    log: {
      eventType: 'TWO_FACTOR_ENABLED',
      severity: 'SECURITY',
      userId: userId || null,
      required: true,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorUserId: userId || null,
    },
  })
}

const buildTwoFactorDisabledEmail = () => ({
  text:
    'Two-factor authentication has been disabled on your Connsura account.\n\nIf this was not you, contact us immediately at security@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Two-factor authentication disabled</h2>
      <p style="margin: 0 0 12px 0;">Two-factor authentication has been disabled on your Connsura account.</p>
      <p style="margin: 0;">If this was not you, contact us immediately at security@connsura.com.</p>
    </div>
  `,
})

const sendTwoFactorDisabledEmail = async (email, userId) => {
  const content = buildTwoFactorDisabledEmail()
  return sendEmail({
    to: email,
    subject: TWO_FACTOR_DISABLED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
    log: {
      eventType: 'TWO_FACTOR_DISABLED',
      severity: 'SECURITY',
      userId: userId || null,
      required: true,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorUserId: userId || null,
    },
  })
}

const buildLogoutOtherDevicesEmail = () => ({
  text:
    'You were logged out of other devices on your Connsura account.\n\nIf this was not you, contact us immediately at security@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Logged out of other devices</h2>
      <p style="margin: 0 0 12px 0;">You were logged out of other devices on your Connsura account.</p>
      <p style="margin: 0;">If this was not you, contact us immediately at security@connsura.com.</p>
    </div>
  `,
})

const sendLogoutOtherDevicesEmail = async (email, userId) => {
  const content = buildLogoutOtherDevicesEmail()
  return sendEmail({
    to: email,
    subject: LOGOUT_OTHER_DEVICES_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
    log: {
      eventType: 'LOGOUT_OTHER_DEVICES',
      severity: 'SECURITY',
      userId: userId || null,
      required: true,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorUserId: userId || null,
    },
  })
}

const buildAccountDeactivatedEmail = () => ({
  text:
    'Your Connsura account was deactivated.\n\nIf this was not you, contact us immediately at support@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Account deactivated</h2>
      <p style="margin: 0 0 12px 0;">Your Connsura account was deactivated.</p>
      <p style="margin: 0;">If this was not you, contact us immediately at support@connsura.com.</p>
    </div>
  `,
})

const sendAccountDeactivatedEmail = async (email, userId) => {
  const content = buildAccountDeactivatedEmail()
  return sendEmail({
    to: email,
    subject: ACCOUNT_DEACTIVATED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'support@connsura.com',
    log: {
      eventType: 'ACCOUNT_DEACTIVATED',
      severity: 'SECURITY',
      userId: userId || null,
      required: true,
      actorType: userId ? 'USER' : 'SYSTEM',
      actorUserId: userId || null,
    },
  })
}

const handleOtpSendError = (err, res) => {
  if (err && err.code === 'RATE_LIMIT') {
    if (err.retryAfterSeconds) {
      res.set('Retry-After', String(err.retryAfterSeconds))
    }
    return res.status(429).json({ error: err.message || 'Too many requests' })
  }
  console.error('email otp send error', err)
  return res.status(500).json({ error: 'Failed to send verification code' })
}

const parseBackupCodes = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const registerRecoveryAttempt = (key) => {
  const now = Date.now()
  const entry = recoveryAttempts.get(key)
  if (!entry || now > entry.resetAt) {
    recoveryAttempts.set(key, { count: 1, resetAt: now + RECOVERY_WINDOW_MS })
    return { limited: false }
  }
  if (entry.count >= RECOVERY_MAX_ATTEMPTS) {
    return { limited: true, resetAt: entry.resetAt }
  }
  entry.count += 1
  recoveryAttempts.set(key, entry)
  return { limited: false }
}

const ensureRecoveryId = async (current) => {
  if (current) return current
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateRecoveryId()
    const existing = await prisma.user.findUnique({ where: { totpRecoveryId: candidate } })
    if (!existing) return candidate
  }
  throw new Error('Unable to generate a recovery ID')
}

router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      languages = [],
      consents = {},
    } = req.body
    const requestedRole = String(req.body?.role || 'CUSTOMER').toUpperCase()
    if (requestedRole !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts are supported' })
    }
    const role = 'CUSTOMER'
    const isCustomer = true
    const auditTarget = normalizeEmail(email) || 'unknown'
    if (isCustomer) {
      await logClientAudit(auditTarget, 'CLIENT_SIGN_UP_SUBMITTED')
    }
    if (!email || !password || !name) {
      if (isCustomer) {
        await logClientAudit(auditTarget, 'CLIENT_SIGN_UP_FAILED', { reason: 'missing_fields' })
      }
      return res.status(400).json({ error: 'Email, password, and name are required' })
    }
    const requiredConsentKeys = ['terms', 'privacy', 'emailCommunications', 'platformDisclaimer']
    const missingConsents = requiredConsentKeys.filter((key) => !consents?.[key])
    if (missingConsents.length) {
      if (isCustomer) {
        await logClientAudit(auditTarget, 'CLIENT_SIGN_UP_FAILED', { reason: 'missing_consents', missingConsents })
      }
      return res.status(400).json({ error: 'Consent required', code: 'CONSENT_REQUIRED', missingConsents })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      if (isCustomer) {
        await logClientAudit(auditTarget, 'CLIENT_SIGN_UP_FAILED', { reason: 'email_exists' })
      }
      return res.status(400).json({ error: 'Email already registered' })
    }
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role,
        customer: {
          create: {
            name,
            preferredLangs: JSON.stringify(languages),
            priorInsurance: JSON.stringify([]),
            coverages: JSON.stringify([]),
          },
        },
      },
      include: { customer: true },
    })
    await prisma.notificationPreferences
      .create({
        data: {
          userId: user.id,
          emailProfileUpdatesEnabled: false,
          emailFeatureUpdatesEnabled: true,
          emailMarketingEnabled: false,
          preferencesVersion: 1,
          updatedByUserId: user.id,
        },
      })
      .catch(() => {})
    const requiredDocTypes = getRequiredDocTypes(role)
    if (requiredDocTypes.length) {
      const latestDocs = await getLatestDocuments(prisma, requiredDocTypes)
      const ip = getRequestIp(req)
      const userAgent = String(req.headers['user-agent'] || '')
      const consentRecords = []
      if (latestDocs[LEGAL_DOC_TYPES.TERMS]) {
        consentRecords.push({
          userId: user.id,
          role: user.role,
          documentType: LEGAL_DOC_TYPES.TERMS,
          version: latestDocs[LEGAL_DOC_TYPES.TERMS].version,
          ipAddress: ip,
          userAgent,
          consentItems: buildConsentItems({
            platformDisclaimer: Boolean(consents?.platformDisclaimer),
          }),
        })
      }
      if (latestDocs[LEGAL_DOC_TYPES.PRIVACY]) {
        consentRecords.push({
          userId: user.id,
          role: user.role,
          documentType: LEGAL_DOC_TYPES.PRIVACY,
          version: latestDocs[LEGAL_DOC_TYPES.PRIVACY].version,
          ipAddress: ip,
          userAgent,
          consentItems: buildConsentItems({
            emailCommunications: Boolean(consents?.emailCommunications),
          }),
        })
      }
      if (consentRecords.length) {
        await prisma.userConsent.createMany({ data: consentRecords })
      }
    }
    if (isCustomer) {
      try {
        const result = await sendEmailOtp(email, { ip: getRequestIp(req), userId: user.id })
        await logClientAudit(user.customer?.id || user.id, 'EMAIL_VERIFY_SENT', { delivery: result.delivery })
        await logClientAudit(user.customer?.id || user.id, 'CLIENT_SIGN_UP_SUCCESS')
      } catch (err) {
        await logClientAudit(user.customer?.id || user.id, 'CLIENT_SIGN_UP_FAILED', { reason: 'email_send_failed' })
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
        return handleOtpSendError(err, res)
      }
    }
    const token = generateToken({ id: user.id, role: user.role })
    const consentStatus = await getConsentStatus(prisma, user)
    setSessionCookie(res, token)
    return res.status(201).json({ token, user: sanitizeUser(user), consent: consentStatus })
  } catch (err) {
    console.error('register error', err)
    const auditTarget = normalizeEmail(req.body?.email || '') || 'unknown'
    if ((req.body?.role || 'CUSTOMER') === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_SIGN_UP_FAILED', { reason: 'server_error' })
    }
    res.status(500).json({ error: 'Failed to register' })
  }
})

router.post('/email-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Please sign in.' })
    }
    const result = await sendEmailOtp(email, { ip: getRequestIp(req) })
    res.json({ sent: true, delivery: result.delivery })
  } catch (err) {
    return handleOtpSendError(err, res)
  }
})

router.post('/email-otp/verify', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' })
  }
  try {
    const result = await verifyEmailOtp(email, code)
    if (!result.valid) {
      return res.status(400).json({ error: result.error || 'Invalid code' })
    }
    return res.json({ verified: true })
  } catch (err) {
    console.error('email otp verify error', err)
    return res.status(500).json({ error: 'Failed to verify email' })
  }
})

router.post('/email-change/request', authGuard, async (req, res) => {
  const nextEmailRaw = String(req.body?.email || '')
  const nextEmail = normalizeEmail(nextEmailRaw)
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (!nextEmail) {
    return res.status(400).json({ error: 'Email is required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const normalizedCurrent = normalizeEmail(user.email)
    if (normalizedCurrent === nextEmail) {
      return res.status(400).json({ error: 'Email is unchanged' })
    }
    const existing = await prisma.user.findUnique({ where: { email: nextEmail } })
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' })
    }
    const auditTarget = user.customer?.id || user.id
    if (user.role === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_EMAIL_CHANGE_STARTED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        new_email_hash: hashValue(nextEmail),
      })
    }
    const result = await sendEmailOtp(nextEmail, { ip, subject: 'Verify your new email', userId: user.id })
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailPending: nextEmail,
        emailPendingRequestedAt: new Date(),
        emailVerified: false,
      },
      include: { customer: true },
    })
    if (user.role === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_EMAIL_VERIFICATION_SENT', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        delivery: result.delivery,
        new_email_hash: hashValue(nextEmail),
      })
      await logClientAudit(auditTarget, 'SECURITY_EMAIL_SENT', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        type: 'email_verify',
        result: 'success',
        delivery: result.delivery,
      })
    }
    return res.json({ sent: true, delivery: result.delivery, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('email change request error', err)
    return res.status(500).json({ error: 'Failed to start email change' })
  }
})

router.post('/email-otp/request', authGuard, async (req, res) => {
  const pendingEmail = normalizeEmail(req.user?.emailPending || '')
  const email = pendingEmail || String(req.user?.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (req.user.emailVerified && !pendingEmail) {
    return res.json({ verified: true, user: sanitizeUser(req.user) })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const result = await sendEmailOtp(email, {
      ip,
      subject: pendingEmail ? 'Verify your new email' : undefined,
      userId: user?.id || null,
    })
    if (req.user?.role === 'CUSTOMER') {
      await logClientAudit(req.user.customer?.id || req.user.id, 'EMAIL_VERIFY_SENT', {
        delivery: result.delivery,
        pending: Boolean(pendingEmail),
        session_id: sessionId,
        ip,
        user_agent: userAgent,
      })
      if (pendingEmail) {
        await logClientAudit(req.user.customer?.id || req.user.id, 'CLIENT_EMAIL_VERIFICATION_SENT', {
          delivery: result.delivery,
          new_email_hash: hashValue(pendingEmail),
          session_id: sessionId,
          ip,
          user_agent: userAgent,
        })
        await logClientAudit(req.user.customer?.id || req.user.id, 'SECURITY_EMAIL_SENT', {
          delivery: result.delivery,
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'email_verify',
          result: 'success',
        })
      }
    }
    return res.json({ sent: true, delivery: result.delivery })
  } catch (err) {
    return handleOtpSendError(err, res)
  }
})

router.post('/email-otp/confirm', authGuard, async (req, res) => {
  if (req.user.emailVerified) {
    return res.json({ verified: true, user: sanitizeUser(req.user) })
  }
  const code = String(req.body?.code || '').trim()
  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' })
  }
  const pendingEmail = normalizeEmail(req.user?.emailPending || '')
  const previousEmail = req.user.email
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  let result
  try {
    result = await verifyEmailOtp(pendingEmail || req.user.email, code)
  } catch (err) {
    console.error('email otp confirm error', err)
    return res.status(500).json({ error: 'Failed to verify email' })
  }
  if (!result.valid) {
    return res.status(400).json({ error: result.error || 'Invalid code' })
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: pendingEmail
        ? { email: pendingEmail, emailVerified: true, emailPending: null, emailPendingRequestedAt: null }
        : { emailVerified: true },
      include: { customer: true },
    })
    if (pendingEmail && updated.customer?.id) {
      const customer = await prisma.customer.findUnique({ where: { id: updated.customer.id } })
      if (customer) {
        let profileData = {}
        try {
          profileData = customer.profileData ? JSON.parse(customer.profileData) : {}
        } catch {
          profileData = {}
        }
        const updatedProfileData = { ...profileData, email: pendingEmail }
        await prisma.customer.update({
          where: { id: updated.customer.id },
          data: { profileData: JSON.stringify(updatedProfileData) },
        })
      }
    }
    if (updated.role === 'CUSTOMER') {
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_EMAIL_VERIFIED', {
        new_email_hash: pendingEmail ? hashValue(pendingEmail) : null,
        session_id: sessionId,
        ip,
        user_agent: userAgent,
      })
    }
    if (pendingEmail && updated.role === 'CUSTOMER') {
      let emailDelivery = 'disabled'
      try {
        const emailResult = await notifyEmailChanged({ user: updated, previousEmail })
        const deliveries = Array.isArray(emailResult?.delivery) ? emailResult.delivery : []
        emailDelivery = deliveries.some((entry) => entry.status === 'fulfilled') ? 'ses' : 'disabled'
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'email_changed',
          result: 'success',
          delivery: emailDelivery,
        })
      } catch (err) {
        console.error('email change notification error', err)
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'email_changed',
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }
    return res.json({ verified: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('email otp confirm error', err)
    return res.status(500).json({ error: 'Failed to verify email' })
  }
})

router.post('/totp/setup', authGuard, async (req, res) => {
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!user.email) return res.status(400).json({ error: 'Email is required for authenticator setup' })
    if (user.totpEnabled) {
      return res.status(400).json({ error: 'Authenticator is already enabled. Disable it to reconfigure.' })
    }
    if (user.role === 'CUSTOMER') {
      await logClientAudit(user.customer?.id || user.id, 'CLIENT_2FA_SETUP_STARTED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'started',
      })
    }
    const secret = generateTotpSecret()
    const encryptedSecret = encryptSecret(secret)
    const recoveryId = await ensureRecoveryId(user.totpRecoveryId)
    const { codes, records } = generateBackupCodes()
    const otpauthUrl = buildOtpAuthUrl(user.email, secret)
    const qrDataUrl = await generateQrDataUrl(otpauthUrl)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: encryptedSecret,
        totpEnabled: false,
        totpRecoveryId: recoveryId,
        totpBackupCodes: JSON.stringify(records),
        totpBackupCodesUpdatedAt: new Date(),
      },
      include: { customer: true },
    })
    return res.json({
      secret,
      otpauthUrl,
      qrDataUrl,
      recoveryId,
      backupCodes: codes,
      user: sanitizeUser(updated),
    })
  } catch (err) {
    console.error('totp setup error', err)
    return res.status(500).json({ error: 'Failed to start authenticator setup' })
  }
})

router.post('/totp/confirm', authGuard, async (req, res) => {
  const code = String(req.body?.code || '').trim()
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user || !user.totpSecret) {
      return res.status(400).json({ error: 'Authenticator setup not started' })
    }
    const secret = decryptSecret(user.totpSecret)
    const valid = verifyTotp(code, secret)
    if (user.role === 'CUSTOMER') {
      await logClientAudit(user.customer?.id || user.id, 'CLIENT_2FA_VERIFICATION_SUBMITTED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: valid ? 'success' : 'failed',
      })
    }
    if (!valid) {
      return res.status(400).json({ error: 'Invalid authenticator code' })
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
      include: { customer: true },
    })
    if (updated.role === 'CUSTOMER') {
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_2FA_ENABLED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'success',
      })
    }
    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendTwoFactorEnabledEmail(updated.email, updated.id)
      emailDelivery = emailResult?.delivery || 'smtp'
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: '2fa_enabled_receipt',
          result: 'success',
          delivery: emailDelivery,
        })
      }
    } catch (err) {
      console.error('2fa enabled email error', err)
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: '2fa_enabled_receipt',
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }
    return res.json({ verified: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('totp confirm error', err)
    return res.status(500).json({ error: 'Failed to enable authenticator' })
  }
})

router.post('/totp/cancel', authGuard, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.totpEnabled) {
      return res.status(400).json({ error: 'Authenticator is already enabled' })
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpRecoveryId: null,
        totpBackupCodes: '[]',
        totpBackupCodesUpdatedAt: null,
      },
      include: { customer: true },
    })
    return res.json({ cancelled: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('totp cancel error', err)
    return res.status(500).json({ error: 'Failed to cancel authenticator setup' })
  }
})

router.post('/totp/backup-codes', authGuard, async (req, res) => {
  const code = String(req.body?.code || '').trim()
  const backupCode = String(req.body?.backupCode || '').trim()
  if (!code && !backupCode) {
    return res.status(400).json({ error: 'Enter a code to generate backup codes' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: 'Authenticator is not enabled yet' })
    }
    const secret = decryptSecret(user.totpSecret)
    let valid = false
    if (code) {
      valid = verifyTotp(code, secret)
    }
    if (!valid && backupCode) {
      const current = parseBackupCodes(user.totpBackupCodes)
      const result = consumeBackupCode(backupCode, current)
      valid = result.valid
    }
    if (!valid) {
      return res.status(400).json({ error: 'Invalid authenticator code' })
    }
    const { codes, records } = generateBackupCodes()
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        totpBackupCodes: JSON.stringify(records),
        totpBackupCodesUpdatedAt: new Date(),
      },
      include: { customer: true },
    })
    return res.json({ backupCodes: codes, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('totp backup codes error', err)
    return res.status(500).json({ error: 'Failed to generate backup codes' })
  }
})

router.post('/totp/disable', authGuard, async (req, res) => {
  const password = String(req.body?.password || '')
  const code = String(req.body?.code || '').trim()
  const backupCode = String(req.body?.backupCode || '').trim()
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (!password) {
    return res.status(400).json({ error: 'Password is required' })
  }
  if (!code && !backupCode) {
    return res.status(400).json({ error: 'Enter an authenticator or backup code' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: 'Authenticator is not enabled' })
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(user.customer?.id || user.id, 'CLIENT_2FA_DISABLE_CONFIRMED', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          result: 'failed',
          reason: 'invalid_password',
        })
      }
      return res.status(400).json({ error: 'Invalid password' })
    }
    const secret = decryptSecret(user.totpSecret)
    let valid = false
    if (code) {
      valid = verifyTotp(code, secret)
    }
    if (!valid && backupCode) {
      const current = parseBackupCodes(user.totpBackupCodes)
      const result = consumeBackupCode(backupCode, current)
      valid = result.valid
    }
    if (!valid) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(user.customer?.id || user.id, 'CLIENT_2FA_DISABLE_CONFIRMED', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          result: 'failed',
          reason: 'invalid_code',
        })
      }
      return res.status(400).json({ error: 'Invalid authenticator code' })
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryId: null,
        totpBackupCodes: '[]',
        totpBackupCodesUpdatedAt: null,
      },
      include: { customer: true },
    })
    if (updated.role === 'CUSTOMER') {
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_2FA_DISABLE_CONFIRMED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'success',
      })
    }
    if (updated.role === 'CUSTOMER') {
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_2FA_DISABLED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'success',
      })
    }
    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendTwoFactorDisabledEmail(updated.email, updated.id)
      emailDelivery = emailResult?.delivery || 'smtp'
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: '2fa_disabled_receipt',
          result: 'success',
          delivery: emailDelivery,
        })
      }
    } catch (err) {
      console.error('2fa disabled email error', err)
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: '2fa_disabled_receipt',
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }
    return res.json({ disabled: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('totp disable error', err)
    return res.status(500).json({ error: 'Failed to disable authenticator' })
  }
})

router.post('/password/request', authGuard, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const auditTarget = user.customer?.id || user.id
    const auditMeta = {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
    }
    if (user.role === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_STARTED', auditMeta)
    }
    if (!currentPassword || !newPassword) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_FAILED', {
          ...auditMeta,
          result: 'failed',
          reason: 'missing_fields',
        })
      }
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    const match = await bcrypt.compare(currentPassword, user.password)
    if (!match) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_FAILED', {
          ...auditMeta,
          result: 'failed',
          reason: 'invalid_current_password',
        })
      }
      return res.status(400).json({ error: 'Invalid current password' })
    }
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordPendingHash: hashed,
        passwordPendingRequestedAt: new Date(),
      },
    })
    const result = await sendEmailOtp(user.email, { ip, template: 'password_change', userId: user.id })
    return res.json({ sent: true, delivery: result.delivery })
  } catch (err) {
    console.error('password change request error', err)
    return handleOtpSendError(err, res)
  }
})

router.post('/password/resend', authGuard, async (req, res) => {
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (!user.passwordPendingHash || !user.passwordPendingRequestedAt) {
      return res.status(400).json({ error: 'No pending password change found' })
    }
    const requestedAt = new Date(user.passwordPendingRequestedAt)
    if (Number.isNaN(requestedAt.getTime()) || Date.now() - requestedAt.getTime() > PASSWORD_PENDING_TTL_MS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordPendingHash: null, passwordPendingRequestedAt: null },
      })
      return res.status(400).json({ error: 'Password change request expired. Please start again.' })
    }
    const result = await sendEmailOtp(user.email, { ip, template: 'password_change', userId: user.id })
    return res.json({ sent: true, delivery: result.delivery })
  } catch (err) {
    console.error('password change resend error', err)
    return handleOtpSendError(err, res)
  }
})

router.post('/password/confirm', authGuard, async (req, res) => {
  const code = String(req.body?.code || '').trim()
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (!user.passwordPendingHash || !user.passwordPendingRequestedAt) {
      return res.status(400).json({ error: 'No pending password change found' })
    }
    const requestedAt = new Date(user.passwordPendingRequestedAt)
    if (Number.isNaN(requestedAt.getTime()) || Date.now() - requestedAt.getTime() > PASSWORD_PENDING_TTL_MS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordPendingHash: null, passwordPendingRequestedAt: null },
      })
      return res.status(400).json({ error: 'Password change request expired. Please start again.' })
    }
    const result = await verifyEmailOtp(user.email, code)
    if (!result.valid) {
      return res.status(400).json({ error: result.error || 'Invalid code' })
    }
    const passwordChangedAt = new Date()
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: user.passwordPendingHash,
        passwordChangedAt,
        passwordPendingHash: null,
        passwordPendingRequestedAt: null,
      },
      include: { customer: true },
    })
    const token = generateToken({ id: updated.id, role: updated.role })
    setSessionCookie(res, token)

    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendPasswordChangeEmail(updated.email)
      emailDelivery = emailResult?.delivery || 'smtp'
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'password_changed_receipt',
          result: 'success',
          delivery: emailDelivery,
        })
      }
    } catch (err) {
      console.error('password change email error', err)
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'password_changed_receipt',
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }

    if (updated.role === 'CUSTOMER') {
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_PASSWORD_CHANGE_SUCCESS', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'success',
        email_delivery: emailDelivery,
      })
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_SESSIONS_REVOKED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'success',
        mode: 'password_changed_at',
      })
    }

    return res.json({ updated: true, user: sanitizeUser(updated), token })
  } catch (err) {
    console.error('password change confirm error', err)
    if (req.user?.role === 'CUSTOMER') {
      await logClientAudit(req.user.customer?.id || req.user.id, 'CLIENT_PASSWORD_CHANGE_FAILED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'failed',
        reason: 'server_error',
      })
    }
    return res.status(500).json({ error: 'Failed to update password' })
  }
})

router.post('/password', authGuard, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const auditTarget = user.customer?.id || user.id
    const auditMeta = {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
    }
    if (user.role === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_STARTED', auditMeta)
    }
    if (!currentPassword || !newPassword) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_FAILED', {
          ...auditMeta,
          result: 'failed',
          reason: 'missing_fields',
        })
      }
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    const match = await bcrypt.compare(currentPassword, user.password)
    if (!match) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_FAILED', {
          ...auditMeta,
          result: 'failed',
          reason: 'invalid_current_password',
        })
      }
      return res.status(400).json({ error: 'Invalid current password' })
    }
    const hashed = await bcrypt.hash(newPassword, 10)
    const passwordChangedAt = new Date()
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordChangedAt },
      include: { customer: true },
    })
    const token = generateToken({ id: updated.id, role: updated.role })
    setSessionCookie(res, token)

    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendPasswordChangeEmail(updated.email)
      emailDelivery = emailResult?.delivery || 'smtp'
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'SECURITY_EMAIL_SENT', {
          ...auditMeta,
          type: 'password_changed_receipt',
          result: 'success',
          delivery: emailDelivery,
        })
      }
    } catch (err) {
      console.error('password change email error', err)
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'SECURITY_EMAIL_SENT', {
          ...auditMeta,
          type: 'password_changed_receipt',
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }

    if (updated.role === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_PASSWORD_CHANGE_SUCCESS', {
        ...auditMeta,
        result: 'success',
        email_delivery: emailDelivery,
      })
      await logClientAudit(auditTarget, 'CLIENT_SESSIONS_REVOKED', {
        ...auditMeta,
        result: 'success',
        mode: 'password_changed_at',
      })
    }
    return res.json({ updated: true, user: sanitizeUser(updated), token })
  } catch (err) {
    console.error('password change error', err)
    if (req.user?.role === 'CUSTOMER') {
      await logClientAudit(req.user.customer?.id || req.user.id, 'CLIENT_PASSWORD_CHANGE_FAILED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'failed',
        reason: 'server_error',
      })
    }
    return res.status(500).json({ error: 'Failed to update password' })
  }
})

router.post('/recovery/reset', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim()
  const code = String(req.body?.code || '').trim()
  const backupCode = String(req.body?.backupCode || '').trim()
  const newPassword = String(req.body?.newPassword || '')
  if (!identifier || !newPassword || (!code && !backupCode)) {
    return res.status(400).json({ error: RECOVERY_ERROR })
  }
  const attemptKey = `${identifier.toLowerCase()}:${req.ip || ''}`
  const throttle = registerRecoveryAttempt(attemptKey)
  if (throttle.limited) {
    return res.status(429).json({ error: 'Too many recovery attempts. Try again later.' })
  }
  try {
    const normalizedEmail = normalizeEmail(identifier)
    const looksLikeEmail = identifier.includes('@')
    let user = null
    if (looksLikeEmail) {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { customer: true },
      })
    }
    if (!user) {
      const recoveryId = identifier.replace(/\s+/g, '').toUpperCase()
      user = await prisma.user.findUnique({
        where: { totpRecoveryId: recoveryId },
        include: { customer: true },
      })
    }
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: RECOVERY_ERROR })
    }
    const secret = decryptSecret(user.totpSecret)
    let valid = false
    let updatedBackupCodes = user.totpBackupCodes || '[]'
    if (code) {
      valid = verifyTotp(code, secret)
    }
    if (!valid && backupCode) {
      const current = parseBackupCodes(user.totpBackupCodes)
      const result = consumeBackupCode(backupCode, current)
      valid = result.valid
      if (result.valid) {
        updatedBackupCodes = JSON.stringify(result.records)
      }
    }
    if (!valid) {
      return res.status(400).json({ error: RECOVERY_ERROR })
    }
    const hashed = await bcrypt.hash(newPassword, 10)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, totpBackupCodes: updatedBackupCodes, passwordChangedAt: new Date() },
      include: { customer: true },
    })
    recoveryAttempts.delete(attemptKey)
    notifyPasswordChanged(updated).catch((err) =>
      console.error('recovery password change notification error', err)
    )
    const token = generateToken({ id: updated.id, role: updated.role })
    setSessionCookie(res, token)
    return res.json({ token, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('recovery reset error', err)
    return res.status(500).json({ error: RECOVERY_ERROR })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { customer: true },
    })
    if (!user) return res.status(400).json({ error: 'Invalid credentials' })
    if (user.role === 'AGENT') {
      return res.status(403).json({ error: 'This account type is disabled' })
    }
    if (user.customer?.isDisabled) {
      return res.status(403).json({ error: 'Account is deactivated' })
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(400).json({ error: 'Invalid credentials' })
    if (user.role === 'CUSTOMER') {
      const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
      const ip = getRequestIp(req)
      const userAgent = String(req.headers['user-agent'] || '')
      const customerId = user.customer?.id || user.id
      let deviceId = getCookieValue(req, DEVICE_COOKIE_NAME)
      let shouldAlert = false
      let deviceState = null
      if (!deviceId || deviceId.length < 16) {
        deviceId = crypto.randomBytes(16).toString('hex')
        setDeviceCookie(res, deviceId)
        shouldAlert = true
      }
      const ipPrefix = getIpPrefix(ip)
      let location = null
      try {
        location = await lookupGeoIp(ip)
      } catch (err) {
        console.error('geo lookup error', err)
      }
      try {
        deviceState = await ensureUserDevice({
          userId: user.id,
          deviceId,
          ipPrefix,
          userAgent,
        })
        if (deviceState.isNewDevice || deviceState.ipChanged) {
          shouldAlert = true
        }
      } catch (err) {
        console.error('login alert detection error', err)
        shouldAlert = true
      }
      try {
        await upsertUserSession({
          userId: user.id,
          sessionId,
          ip,
          ipPrefix,
          userAgent,
          location,
        })
      } catch (err) {
        console.error('session upsert error', err)
      }
      await logClientAudit(customerId, 'CLIENT_LOGIN_SUCCESS', {
        session_id: sessionId,
        ip,
        ip_prefix: ipPrefix,
        user_agent: userAgent,
        device_id: deviceId,
        city: location?.city || null,
        region: location?.region || null,
        country: location?.country || null,
        location: location?.locationLabel || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      })
      if (shouldAlert) {
        notifyLoginAlert({
          user,
          ip,
          userAgent,
          location: location?.locationLabel || null,
          wasNewDevice: Boolean(deviceState?.isNewDevice || deviceState?.ipChanged),
        }).catch((err) =>
          console.error('login alert notification error', err)
        )
      }
    }
    const token = generateToken({ id: user.id, role: user.role })
    const consentStatus = await getConsentStatus(prisma, user)
    setSessionCookie(res, token)
    res.json({ token, user: sanitizeUser(user), consent: consentStatus })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ error: 'Failed to login' })
  }
})

router.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.post('/account/delete', authGuard, async (req, res) => {
  const password = String(req.body?.password || '')
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const deletionReason = req.body?.deletionReason ? String(req.body.deletionReason) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (!password) {
    if (req.user?.role === 'CUSTOMER') {
      await logClientAudit(req.user.customer?.id || req.user.id, 'CLIENT_DELETE_ACCOUNT_FAILED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'failed',
        reason: 'missing_password',
        deletion_reason: deletionReason,
      })
    }
    return res.status(400).json({ error: 'Password is required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const auditTarget = user.customer?.id || user.id
    const auditMeta = {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
      deletion_reason: deletionReason,
    }
    if (user.role === 'CUSTOMER') {
      await logClientAudit(auditTarget, 'CLIENT_DELETE_ACCOUNT_CONFIRMED', auditMeta)
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      if (user.role === 'CUSTOMER') {
        await logClientAudit(auditTarget, 'CLIENT_DELETE_ACCOUNT_FAILED', {
          ...auditMeta,
          result: 'failed',
          reason: 'invalid_password',
        })
      }
      return res.status(400).json({ error: 'Invalid password' })
    }
    const email = user.email
    const customerId = user.customer?.id || null
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.emailOtp.delete({ where: { email } }).catch(() => {})
    await prisma.emailOtpRequest.deleteMany({ where: { email } }).catch(() => {})
    if (user.role === 'CUSTOMER' && customerId) {
      await logClientAudit(customerId, 'CLIENT_DELETE_ACCOUNT_SUCCESS', {
        ...auditMeta,
        result: 'success',
      })
      await logClientAudit(customerId, 'CLIENT_SESSION_REVOKED', {
        ...auditMeta,
        result: 'success',
        mode: 'account_deleted',
      })
      await logClientAudit(customerId, 'INAPP_NOTICE_SHOWN', {
        ...auditMeta,
        type: 'account_deleted',
      })
      await logInAppNotification({
        eventType: 'IN_APP_NOTICE',
        severity: 'INFO',
        userId: user.id,
        required: true,
        metadata: { type: 'account_deleted' },
        actorType: 'USER',
        actorUserId: user.id,
      })
    }
    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendAccountDeletedEmail(email, user.id)
      emailDelivery = emailResult?.delivery || 'smtp'
      if (user.role === 'CUSTOMER' && customerId) {
        await logClientAudit(customerId, 'SUPPORT_EMAIL_SENT', {
          ...auditMeta,
          type: 'account_deleted_receipt',
          result: 'success',
          delivery: emailDelivery,
        })
      }
    } catch (err) {
      console.error('account deleted email error', err)
      if (user.role === 'CUSTOMER' && customerId) {
        await logClientAudit(customerId, 'SUPPORT_EMAIL_SENT', {
          ...auditMeta,
          type: 'account_deleted_receipt',
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }
    return res.json({ deleted: true })
  } catch (err) {
    console.error('delete account error', err)
    if (req.user?.role === 'CUSTOMER') {
      await logClientAudit(req.user.customer?.id || req.user.id, 'CLIENT_DELETE_ACCOUNT_FAILED', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'failed',
        reason: 'server_error',
        deletion_reason: deletionReason,
      })
    }
    return res.status(500).json({ error: 'Failed to delete account' })
  }
})

router.post('/account/deactivate', authGuard, async (req, res) => {
  const password = String(req.body?.password || '')
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (!password) {
    return res.status(400).json({ error: 'Password is required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { customer: true },
    })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.status(400).json({ error: 'Invalid password' })
    }
    if (!user.customer) {
      return res.status(400).json({ error: 'Customer profile not found' })
    }
    const customerId = user.customer.id
    await prisma.customer.update({
      where: { id: customerId },
      data: { isDisabled: true },
    })
    await prisma.profileShare.updateMany({
      where: { customerId, status: { not: 'revoked' } },
      data: { status: 'revoked' },
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionsRevokedAt: new Date() },
    })
    await logClientAudit(customerId, 'CLIENT_ACCOUNT_DEACTIVATED', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
      result: 'success',
    })
    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendAccountDeactivatedEmail(user.email, user.id)
      emailDelivery = emailResult?.delivery || 'smtp'
      await logClientAudit(customerId, 'SUPPORT_EMAIL_SENT', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        type: 'account_deactivated_receipt',
        result: 'success',
        delivery: emailDelivery,
      })
    } catch (err) {
      console.error('account deactivated email error', err)
      await logClientAudit(customerId, 'SUPPORT_EMAIL_SENT', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        type: 'account_deactivated_receipt',
        result: 'failed',
        reason: 'email_send_failed',
      })
    }
    return res.json({ deactivated: true })
  } catch (err) {
    console.error('deactivate account error', err)
    return res.status(500).json({ error: 'Failed to deactivate account' })
  }
})

router.get('/sessions', authGuard, async (req, res) => {
  const sessionId = req.query?.sessionId ? String(req.query.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  const ipPrefix = getIpPrefix(ip)
  let location = null
  try {
    location = await lookupGeoIp(ip)
  } catch (err) {
    console.error('geo lookup error', err)
  }
  try {
    await upsertUserSession({
      userId: req.user.id,
      sessionId,
      ip,
      ipPrefix,
      userAgent,
      location,
    })
  } catch (err) {
    console.error('session upsert error', err)
  }
  if (req.user?.role === 'CUSTOMER') {
    await logClientAudit(req.user.customer?.id || req.user.id, 'CLIENT_ACTIVE_SESSIONS_VIEWED', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
    })
  }
  res.json({
    sessions: [
      {
        id: sessionId || 'current',
        current: true,
        ip,
        userAgent,
        location: location?.locationLabel || null,
        city: location?.city || null,
        region: location?.region || null,
        country: location?.country || null,
        lastSeenAt: new Date().toISOString(),
      },
    ],
  })
})

router.post('/sessions/revoke-others', authGuard, async (req, res) => {
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { sessionsRevokedAt: new Date() },
      include: { customer: true },
    })
    const token = generateToken({ id: updated.id, role: updated.role })
    if (updated.role === 'CUSTOMER') {
      await logClientAudit(updated.customer?.id || updated.id, 'CLIENT_LOGOUT_ALL_SESSIONS', {
        session_id: sessionId,
        ip,
        user_agent: userAgent,
        result: 'success',
      })
    }
    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendLogoutOtherDevicesEmail(updated.email, updated.id)
      emailDelivery = emailResult?.delivery || 'smtp'
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          result: 'success',
          delivery: emailDelivery,
        })
      }
    } catch (err) {
      console.error('logout other devices email error', err)
      if (updated.role === 'CUSTOMER') {
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          result: 'failed',
          reason: 'email_send_failed',
        })
      }
    }
    if (sessionId) {
      await prisma.userSession.updateMany({
        where: { userId: updated.id, sessionId: { not: sessionId } },
        data: { revokedAt: new Date() },
      })
    }
    setSessionCookie(res, token)
    return res.json({ revoked: true, token, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('revoke sessions error', err)
    return res.status(500).json({ error: 'Failed to revoke sessions' })
  }
})

router.get('/me', authGuard, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { customer: true },
  })
  const consentStatus = await getConsentStatus(prisma, user)
  res.json({ user: sanitizeUser(user), consent: consentStatus })
})

module.exports = router
