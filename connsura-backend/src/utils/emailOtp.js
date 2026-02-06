const crypto = require('crypto')
const prisma = require('../prisma')
const { sendEmail } = require('./emailClient')

const OTP_TTL_MS = Number(process.env.EMAIL_OTP_TTL_MS || 10 * 60 * 1000)
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5)
const OTP_EMAIL_WINDOW_MS = Number(process.env.EMAIL_OTP_EMAIL_WINDOW_MS || 10 * 60 * 1000)
const OTP_EMAIL_MAX_SENDS = Number(process.env.EMAIL_OTP_EMAIL_MAX_SENDS || 5)
const OTP_IP_WINDOW_MS = Number(process.env.EMAIL_OTP_IP_WINDOW_MS || 10 * 60 * 1000)
const OTP_IP_MAX_SENDS = Number(process.env.EMAIL_OTP_IP_MAX_SENDS || 20)

class RateLimitError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message)
    this.code = 'RATE_LIMIT'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex')

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')

const VERIFY_EMAIL_SUBJECT = 'Verify your email'
const VERIFY_EMAIL_REPLY_TO = 'security@connsura.com'

const OTP_TEMPLATES = {
  email_verify: {
    subject: VERIFY_EMAIL_SUBJECT,
    heading: 'Verify your email',
    intro: 'Use this one-time verification code to confirm your email address:',
  },
  name_change: {
    subject: 'Confirm your name change',
    heading: 'Confirm your name change',
    intro:
      'A name change was requested for your Connsura account. Enter the code below in your app to confirm:',
  },
  password_change: {
    subject: 'Confirm your password change',
    heading: 'Confirm your password change',
    intro:
      'There is a password change request for your Connsura account. If this is you, enter the code below in your dashboard. If not, contact security@connsura.com immediately.',
  },
}

const resolveTemplate = (template) => {
  if (!template) return OTP_TEMPLATES.email_verify
  if (typeof template === 'string' && OTP_TEMPLATES[template]) return OTP_TEMPLATES[template]
  if (typeof template === 'object') {
    return {
      ...OTP_TEMPLATES.email_verify,
      ...template,
    }
  }
  return OTP_TEMPLATES.email_verify
}

const buildOtpText = ({ code, expiresMinutes, heading, intro }) => {
  return `CONNSURA
================

${heading}

${intro}

${code}

This code expires in ${expiresMinutes} minutes.

For your security, never share this code. If you did not request this, you can ignore this email.

Thanks,
The Connsura Team`
}

const buildOtpHtml = ({ code, expiresMinutes, heading, intro }) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin: 0 0 12px 0;">${heading}</h2>
      <p style="margin: 0 0 16px 0;">${intro}</p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 0.2em; margin: 0 0 16px 0;">${code}</p>
      <p style="margin: 0 0 12px 0; color: #6b7280;">This code expires in ${expiresMinutes} minutes.</p>
    </div>
  `
}

const deliverEmail = async (email, code, { subject, heading, intro } = {}) => {
  const expiresMinutes = Math.max(1, Math.round(OTP_TTL_MS / 60000))
  const text = buildOtpText({ code, expiresMinutes, heading, intro })
  const html = buildOtpHtml({ code, expiresMinutes, heading, intro })
  const delivery = await sendEmail({
    to: email,
    subject: subject || VERIFY_EMAIL_SUBJECT,
    text,
    html,
    replyTo: VERIFY_EMAIL_REPLY_TO,
  })
  if (delivery.delivery === 'disabled' && String(process.env.EMAIL_LOG_CODES || '').toLowerCase() === 'true') {
    console.log(`[email-otp] code for ${email}: ${code}`)
  }
  return delivery
}

const computeRetryAfter = (oldest, windowMs, nowMs) => {
  if (!oldest) return Math.ceil(windowMs / 1000)
  const remainingMs = oldest.getTime() + windowMs - nowMs
  return Math.max(1, Math.ceil(remainingMs / 1000))
}

const checkRateLimit = async (email, ip) => {
  const nowMs = Date.now()
  const emailWindowStart = new Date(nowMs - OTP_EMAIL_WINDOW_MS)
  const ipWindowStart = new Date(nowMs - OTP_IP_WINDOW_MS)

  const emailCountPromise = prisma.emailOtpRequest.count({
    where: { email, createdAt: { gte: emailWindowStart } },
  })
  const emailOldestPromise = prisma.emailOtpRequest.findFirst({
    where: { email, createdAt: { gte: emailWindowStart } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })

  let ipCountPromise = Promise.resolve(0)
  let ipOldestPromise = Promise.resolve(null)
  if (ip) {
    ipCountPromise = prisma.emailOtpRequest.count({
      where: { ip, createdAt: { gte: ipWindowStart } },
    })
    ipOldestPromise = prisma.emailOtpRequest.findFirst({
      where: { ip, createdAt: { gte: ipWindowStart } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    })
  }

  const [emailCount, emailOldest, ipCount, ipOldest] = await Promise.all([
    emailCountPromise,
    emailOldestPromise,
    ipCountPromise,
    ipOldestPromise,
  ])

  if (emailCount >= OTP_EMAIL_MAX_SENDS) {
    const retryAfter = computeRetryAfter(emailOldest?.createdAt, OTP_EMAIL_WINDOW_MS, nowMs)
    throw new RateLimitError('Too many verification requests for this email. Please wait and try again.', retryAfter)
  }

  if (ip && ipCount >= OTP_IP_MAX_SENDS) {
    const retryAfter = computeRetryAfter(ipOldest?.createdAt, OTP_IP_WINDOW_MS, nowMs)
    throw new RateLimitError('Too many verification requests from this network. Please wait and try again.', retryAfter)
  }

  const cutoff = new Date(nowMs - Math.max(OTP_EMAIL_WINDOW_MS, OTP_IP_WINDOW_MS) * 2)
  prisma.emailOtpRequest.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {})
}

const sendEmailOtp = async (email, { ip, subject, template } = {}) => {
  const normalized = normalizeEmail(email)
  await checkRateLimit(normalized, ip)

  const code = generateCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS)

  await prisma.emailOtpRequest.create({
    data: {
      email: normalized,
      ip: ip || null,
      createdAt: now,
    },
  })

  await prisma.emailOtp.upsert({
    where: { email: normalized },
    update: {
      code,
      codeHash: hashCode(code),
      createdAt: now,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      lastSentIp: ip || null,
    },
    create: {
      email: normalized,
      code,
      codeHash: hashCode(code),
      createdAt: now,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      lastSentIp: ip || null,
    },
  })

  const resolvedTemplate = resolveTemplate(template)
  const delivery = await deliverEmail(normalized, code, {
    subject: subject || resolvedTemplate.subject,
    heading: resolvedTemplate.heading,
    intro: resolvedTemplate.intro,
  })
  return { delivery: delivery.delivery }
}

const getEmailOtp = async (email) => {
  const normalized = normalizeEmail(email)
  const entry = await prisma.emailOtp.findUnique({ where: { email: normalized } })
  if (!entry) return null
  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.emailOtp.delete({ where: { email: normalized } })
    return null
  }
  return {
    email: normalized,
    code: entry.code,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    attempts: entry.attempts,
  }
}

const verifyEmailOtp = async (email, code) => {
  const normalized = normalizeEmail(email)
  const entry = await prisma.emailOtp.findUnique({ where: { email: normalized } })
  if (!entry) {
    return { valid: false, error: 'No code found. Request a new one.' }
  }
  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.emailOtp.delete({ where: { email: normalized } })
    return { valid: false, error: 'Code expired. Request a new one.' }
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.emailOtp.delete({ where: { email: normalized } })
    return { valid: false, error: 'Too many attempts. Request a new code.' }
  }

  const isValid = hashCode(String(code || '').trim()) === entry.codeHash
  if (!isValid) {
    const nextAttempts = entry.attempts + 1
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailOtp.delete({ where: { email: normalized } })
      return { valid: false, error: 'Too many attempts. Request a new code.' }
    }
    await prisma.emailOtp.update({
      where: { email: normalized },
      data: { attempts: nextAttempts },
    })
    return { valid: false, error: 'Invalid code.' }
  }

  await prisma.emailOtp.delete({ where: { email: normalized } })
  return { valid: true }
}

module.exports = { sendEmailOtp, verifyEmailOtp, getEmailOtp, RateLimitError }
