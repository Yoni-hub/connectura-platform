const crypto = require('crypto')
const nodemailer = require('nodemailer')

const OTP_TTL_MS = Number(process.env.EMAIL_OTP_TTL_MS || 10 * 60 * 1000)
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5)

const otpStore = new Map()
let cachedTransporter = null

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex')

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter

  const smtpUrl = process.env.SMTP_URL
  if (smtpUrl) {
    cachedTransporter = nodemailer.createTransport(smtpUrl)
    return cachedTransporter
  }

  const host = process.env.SMTP_HOST
  if (!host) return null

  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })

  return cachedTransporter
}

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')

const deliverEmail = async (email, code) => {
  const transport = getTransporter()
  if (!transport) {
    console.log(`[email-otp] code for ${email}: ${code}`)
    return { delivery: 'log' }
  }

  const from = process.env.SMTP_FROM || 'no-reply@connectura.com'
  const expiresMinutes = Math.max(1, Math.round(OTP_TTL_MS / 60000))
  await transport.sendMail({
    from,
    to: email,
    subject: 'Your Connectura verification code',
    text: `Your Connectura verification code is ${code}. It expires in ${expiresMinutes} minutes.`,
  })
  return { delivery: 'smtp' }
}

const sendEmailOtp = async (email) => {
  const normalized = normalizeEmail(email)
  const code = generateCode()
  const now = Date.now()
  otpStore.set(normalized, {
    hash: hashCode(code),
    code,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
  })
  const delivery = await deliverEmail(normalized, code)
  return { delivery: delivery.delivery }
}

const getEmailOtp = (email) => {
  const normalized = normalizeEmail(email)
  const entry = otpStore.get(normalized)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized)
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

const verifyEmailOtp = (email, code) => {
  const normalized = normalizeEmail(email)
  const entry = otpStore.get(normalized)
  if (!entry) {
    return { valid: false, error: 'No code found. Request a new one.' }
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized)
    return { valid: false, error: 'Code expired. Request a new one.' }
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(normalized)
    return { valid: false, error: 'Too many attempts. Request a new code.' }
  }

  const isValid = hashCode(String(code || '').trim()) === entry.hash
  if (!isValid) {
    entry.attempts += 1
    otpStore.set(normalized, entry)
    return { valid: false, error: 'Invalid code.' }
  }

  otpStore.delete(normalized)
  return { valid: true }
}

module.exports = { sendEmailOtp, verifyEmailOtp, getEmailOtp }
