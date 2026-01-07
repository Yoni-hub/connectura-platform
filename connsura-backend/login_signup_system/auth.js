const express = require('express')
const bcrypt = require('bcrypt')
const prisma = require('../src/prisma')
const { generateToken } = require('../src/utils/token')
const { authGuard } = require('../src/middleware/auth')
const { sendEmailOtp, verifyEmailOtp } = require('../src/utils/emailOtp')
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
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
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
                  sharedWithAgent: false,
                },
              }
            : undefined,
      },
      include: { agent: true, customer: true },
    })
    const token = generateToken({ id: user.id, role: user.role })
    return res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (err) {
    console.error('register error', err)
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
    const result = await sendEmailOtp(email)
    res.json({ sent: true, delivery: result.delivery })
  } catch (err) {
    console.error('email otp send error', err)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
})

router.post('/email-otp/verify', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' })
  }
  const result = verifyEmailOtp(email, code)
  if (!result.valid) {
    return res.status(400).json({ error: result.error || 'Invalid code' })
  }
  return res.json({ verified: true })
})

router.post('/email-otp/request', authGuard, async (req, res) => {
  const email = String(req.user?.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }
  if (req.user.emailVerified) {
    return res.json({ verified: true, user: sanitizeUser(req.user) })
  }
  try {
    const result = await sendEmailOtp(email)
    return res.json({ sent: true, delivery: result.delivery })
  } catch (err) {
    console.error('email otp request error', err)
    return res.status(500).json({ error: 'Failed to send verification code' })
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
  const result = verifyEmailOtp(req.user.email, code)
  if (!result.valid) {
    return res.status(400).json({ error: result.error || 'Invalid code' })
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { emailVerified: true },
      include: { agent: true, customer: true },
    })
    return res.json({ verified: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('email otp confirm error', err)
    return res.status(500).json({ error: 'Failed to verify email' })
  }
})

router.post('/totp/setup', authGuard, async (req, res) => {
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
    if (!valid) {
      return res.status(400).json({ error: 'Invalid authenticator code' })
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
      include: { agent: true, customer: true },
    })
    return res.json({ verified: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('totp confirm error', err)
    return res.status(500).json({ error: 'Failed to enable authenticator' })
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
    return res.json({ disabled: true, user: sanitizeUser(updated) })
  } catch (err) {
    console.error('totp disable error', err)
    return res.status(500).json({ error: 'Failed to disable authenticator' })
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
      data: { password: hashed, totpBackupCodes: updatedBackupCodes },
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
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(400).json({ error: 'Invalid credentials' })
    const token = generateToken({ id: user.id, role: user.role })
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ error: 'Failed to login' })
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
