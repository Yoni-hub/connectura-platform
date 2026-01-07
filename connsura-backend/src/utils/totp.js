const crypto = require('crypto')
const { authenticator } = require('otplib')
const qrcode = require('qrcode')

const ISSUER = process.env.TOTP_ISSUER || 'Connsura'
const WINDOW = Number(process.env.TOTP_WINDOW || 1)
const KEY_SEED = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET

if (!KEY_SEED) {
  throw new Error('TOTP_ENCRYPTION_KEY or JWT_SECRET is required for TOTP encryption')
}

const ENCRYPTION_KEY = crypto.createHash('sha256').update(KEY_SEED).digest()

authenticator.options = { window: Number.isNaN(WINDOW) ? 1 : WINDOW }

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decryptSecret(payload) {
  if (!payload) return ''
  const parts = payload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid TOTP secret payload')
  }
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

function generateTotpSecret() {
  return authenticator.generateSecret()
}

function buildOtpAuthUrl(email, secret) {
  return authenticator.keyuri(email, ISSUER, secret)
}

async function generateQrDataUrl(otpauthUrl) {
  return qrcode.toDataURL(otpauthUrl)
}

function verifyTotp(code, secret) {
  return authenticator.check(code, secret)
}

function normalizeBackupCode(code) {
  return String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function hashBackupCode(code, salt) {
  return crypto.createHash('sha256').update(`${salt}:${normalizeBackupCode(code)}`).digest('hex')
}

function generateBackupCodes(count = 8) {
  const codes = []
  const records = []
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase()
    const display = `${raw.slice(0, 5)}-${raw.slice(5)}`
    const salt = crypto.randomBytes(8).toString('hex')
    records.push({ salt, hash: hashBackupCode(raw, salt), usedAt: null })
    codes.push(display)
  }
  return { codes, records }
}

function consumeBackupCode(code, records) {
  const normalized = normalizeBackupCode(code)
  if (!normalized) return { valid: false, records }
  const nextRecords = Array.isArray(records) ? records.map((record) => ({ ...record })) : []
  const matchedIndex = nextRecords.findIndex(
    (record) => !record.usedAt && record.hash === hashBackupCode(normalized, record.salt)
  )
  if (matchedIndex === -1) return { valid: false, records: nextRecords }
  nextRecords[matchedIndex].usedAt = new Date().toISOString()
  return { valid: true, records: nextRecords }
}

function generateRecoveryId() {
  return `REC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

module.exports = {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrDataUrl,
  verifyTotp,
  normalizeBackupCode,
  generateBackupCodes,
  consumeBackupCode,
  generateRecoveryId,
}
