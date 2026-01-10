const crypto = require('crypto')
const { sendEmail } = require('./emailClient')

const OTP_TTL_MS = Number(process.env.EMAIL_OTP_TTL_MS || 10 * 60 * 1000)
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5)

const otpStore = new Map()

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex')

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')

const deliverEmail = async (email, code) => {
  const expiresMinutes = Math.max(1, Math.round(OTP_TTL_MS / 60000))
  const delivery = await sendEmail({
    to: email,
    subject: 'Your Connsura verification code',
    text: `Your Connsura verification code is ${code}. It expires in ${expiresMinutes} minutes.`,
  })
  if (delivery.delivery === 'disabled' && String(process.env.EMAIL_LOG_CODES || '').toLowerCase() === 'true') {
    console.log(`[email-otp] code for ${email}: ${code}`)
  }
  return delivery
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
