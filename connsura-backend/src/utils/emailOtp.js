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

const buildOtpText = (code, expiresMinutes) => `CONNSURA
================

Verify your Connsura account

Use this one-time verification code to confirm your email address:

${code}

This code expires in ${expiresMinutes} minutes.

For your security, never share this code. If you did not request this, you can ignore this email.

Thanks,
The Connsura Team`

const buildOtpHtml = (code, expiresMinutes) => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f7f9fc;font-family:Arial,sans-serif;color:#0b1f3a;">
    <div style="width:100%;padding:24px 16px;box-sizing:border-box;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <h1 style="font-size:20px;margin:0 0 12px;">Verify your Connsura account</h1>
        <p style="margin:0 0 16px;">Use this one-time verification code to confirm your email address:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:4px;padding:12px 16px;background:#f1f5f9;border-radius:10px;text-align:center;margin-bottom:16px;">
          ${code}
        </div>
        <p style="margin:0 0 16px;">This code expires in ${expiresMinutes} minutes.</p>
        <p style="margin:0 0 16px;font-size:13px;color:#475569;">
          For your security, never share this code. If you did not request this, you can ignore this email.
        </p>
        <p style="margin:0;font-size:13px;color:#475569;">Thanks,<br />The Connsura Team</p>
      </div>
    </div>
  </body>
</html>`

const deliverEmail = async (email, code) => {
  const expiresMinutes = Math.max(1, Math.round(OTP_TTL_MS / 60000))
  const text = buildOtpText(code, expiresMinutes)
  const html = buildOtpHtml(code, expiresMinutes)
  const delivery = await sendEmail({
    to: email,
    subject: 'Your Connsura verification code',
    text,
    html,
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

const sendEmailOtp = async (email, { ip } = {}) => {
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

  const delivery = await deliverEmail(normalized, code)
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
