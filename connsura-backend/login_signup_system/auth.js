const express = require('express')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const prisma = require('../src/prisma')
const { generateToken } = require('../src/utils/token')
const { authGuard } = require('../src/middleware/auth')
const { sendEmail } = require('../src/utils/emailClient')
const { sendEmailOtp, verifyEmailOtp } = require('../src/utils/emailOtp')
const { logClientAudit } = require('../src/utils/auditLog')
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

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  emailPending: user.emailPending || null,
  name: user.customer?.name || user.agent?.name || '',
  role: user.role,
  emailVerified: Boolean(user.emailVerified),
  agentId: user.agent?.id,
  customerId: user.customer?.id,
  agentStatus: user.agent?.status,
  agentSuspended: user.agent?.isSuspended,
  agentUnderReview: user.agent?.underReview,
  totpEnabled: Boolean(user.totpEnabled),
  recoveryId: user.totpRecoveryId || null,
})

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase()
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

const PASSWORD_CHANGE_SUBJECT = 'Your Connsura password was changed'
const EMAIL_VERIFIED_SUBJECT = 'Your email was verified'
const ACCOUNT_DELETED_SUBJECT = 'Your Connsura account was deleted'
const TWO_FACTOR_ENABLED_SUBJECT = 'Two-factor authentication enabled'
const TWO_FACTOR_DISABLED_SUBJECT = 'Two-factor authentication disabled'
const LOGOUT_OTHER_DEVICES_SUBJECT = 'You were logged out of other devices'
const ACCOUNT_DEACTIVATED_SUBJECT = 'Your Connsura account was deactivated'

const buildPasswordChangeEmail = () => ({
  text:
    'Your password was successfully changed.\n\nIf this was not you, contact support immediately at security@connsura.com.',
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Password changed</h2>
      <p style="margin: 0 0 12px 0;">Your password was successfully changed.</p>
      <p style="margin: 0;">If this was not you, contact support immediately at security@connsura.com.</p>
    </div>
  `,
})

const sendPasswordChangeEmail = async (email) => {
  const content = buildPasswordChangeEmail()
  return sendEmail({
    to: email,
    subject: PASSWORD_CHANGE_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
  })
}

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

const sendEmailVerifiedEmail = async (email) => {
  const content = buildEmailVerifiedEmail()
  return sendEmail({
    to: email,
    subject: EMAIL_VERIFIED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
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

const sendAccountDeletedEmail = async (email) => {
  const content = buildAccountDeletedEmail()
  return sendEmail({
    to: email,
    subject: ACCOUNT_DELETED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'support@connsura.com',
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

const sendTwoFactorEnabledEmail = async (email) => {
  const content = buildTwoFactorEnabledEmail()
  return sendEmail({
    to: email,
    subject: TWO_FACTOR_ENABLED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
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

const sendTwoFactorDisabledEmail = async (email) => {
  const content = buildTwoFactorDisabledEmail()
  return sendEmail({
    to: email,
    subject: TWO_FACTOR_DISABLED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
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

const sendLogoutOtherDevicesEmail = async (email) => {
  const content = buildLogoutOtherDevicesEmail()
  return sendEmail({
    to: email,
    subject: LOGOUT_OTHER_DEVICES_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'security@connsura.com',
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

const sendAccountDeactivatedEmail = async (email) => {
  const content = buildAccountDeactivatedEmail()
  return sendEmail({
    to: email,
    subject: ACCOUNT_DEACTIVATED_SUBJECT,
    text: content.text,
    html: content.html,
    replyTo: 'support@connsura.com',
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
      role = 'CUSTOMER',
      name,
      languages = [],
      states = [],
      specialty = 'Auto',
      producerNumber = '',
      address = '',
      zip = '',
      products = [],
    } = req.body
    const isCustomer = role === 'CUSTOMER'
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
        agent:
          role === 'AGENT'
            ? {
                create: {
                  name,
                  bio: 'New agent on Connsura.',
                  languages: JSON.stringify(languages),
                  states: JSON.stringify(states),
                  specialty: specialty || (products[0] || 'Auto'),
                  producerNumber,
                  address,
                  zip,
                  products: JSON.stringify(products),
                  availability: 'online',
                  rating: 4.5,
                  reviews: JSON.stringify([]),
                  photo: '/uploads/agents/agent1.svg',
                  status: 'pending',
                  underReview: true,
                  isSuspended: false,
                },
              }
            : undefined,
        customer:
          role === 'CUSTOMER'
            ? {
                create: {
                  name,
                  preferredLangs: JSON.stringify(languages),
                  priorInsurance: JSON.stringify([]),
                  coverages: JSON.stringify([]),
                },
              }
            : undefined,
      },
      include: { agent: true, customer: true },
    })
    if (isCustomer) {
      try {
        const result = await sendEmailOtp(email, { ip: getRequestIp(req) })
        await logClientAudit(user.customer?.id || user.id, 'EMAIL_VERIFY_SENT', { delivery: result.delivery })
        await logClientAudit(user.customer?.id || user.id, 'CLIENT_SIGN_UP_SUCCESS')
      } catch (err) {
        await logClientAudit(user.customer?.id || user.id, 'CLIENT_SIGN_UP_FAILED', { reason: 'email_send_failed' })
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
        return handleOtpSendError(err, res)
      }
    }
    const token = generateToken({ id: user.id, role: user.role })
    return res.status(201).json({ token, user: sanitizeUser(user) })
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
    const result = await sendEmailOtp(nextEmail, { ip, subject: 'Verify your new email' })
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailPending: nextEmail,
        emailPendingRequestedAt: new Date(),
        emailVerified: false,
      },
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
        const emailResult = await sendEmailVerifiedEmail(updated.email)
        emailDelivery = emailResult?.delivery || 'smtp'
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'email_verified',
          result: 'success',
          delivery: emailDelivery,
        })
      } catch (err) {
        console.error('email verified receipt error', err)
        await logClientAudit(updated.customer?.id || updated.id, 'SECURITY_EMAIL_SENT', {
          session_id: sessionId,
          ip,
          user_agent: userAgent,
          type: 'email_verified',
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      const emailResult = await sendTwoFactorEnabledEmail(updated.email)
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
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
      const emailResult = await sendTwoFactorDisabledEmail(updated.email)
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

router.post('/password', authGuard, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
    })
    const token = generateToken({ id: updated.id, role: updated.role })

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
        include: { agent: true, customer: true },
      })
    }
    if (!user) {
      const recoveryId = identifier.replace(/\s+/g, '').toUpperCase()
      user = await prisma.user.findUnique({
        where: { totpRecoveryId: recoveryId },
        include: { agent: true, customer: true },
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
      include: { agent: true, customer: true },
    })
    recoveryAttempts.delete(attemptKey)
    const token = generateToken({ id: updated.id, role: updated.role })
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
      include: { agent: true, customer: true },
    })
    if (!user) return res.status(400).json({ error: 'Invalid credentials' })
    if (user.customer?.isDisabled) {
      return res.status(403).json({ error: 'Account is deactivated' })
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(400).json({ error: 'Invalid credentials' })
    if (user.role === 'CUSTOMER') {
      const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
      await logClientAudit(user.customer?.id || user.id, 'CLIENT_LOGIN_SUCCESS', {
        session_id: sessionId,
        ip: getRequestIp(req),
        user_agent: String(req.headers['user-agent'] || ''),
      })
    }
    const token = generateToken({ id: user.id, role: user.role })
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ error: 'Failed to login' })
  }
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
    }
    let emailDelivery = 'disabled'
    try {
      const emailResult = await sendAccountDeletedEmail(email)
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
      const emailResult = await sendAccountDeactivatedEmail(user.email)
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
      include: { agent: true, customer: true },
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
      const emailResult = await sendLogoutOtherDevicesEmail(updated.email)
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
    return res.json({ revoked: true, token, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('revoke sessions error', err)
    return res.status(500).json({ error: 'Failed to revoke sessions' })
  }
})

router.get('/me', authGuard, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { agent: true, customer: true },
  })
  res.json({ user: sanitizeUser(user) })
})

module.exports = router
