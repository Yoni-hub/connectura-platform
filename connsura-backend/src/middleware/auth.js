const prisma = require('../prisma')
const { verifyToken } = require('../utils/token')
const { getConsentStatus } = require('../utils/legalDocuments')

const ADMIN_AUTH_COOKIE = process.env.ADMIN_AUTH_COOKIE || 'connsura_admin_session'

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

async function authGuard(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  const token = header.replace('Bearer ', '')
  try {
    const decoded = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: decoded.id } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    if (user.passwordChangedAt && decoded.iat) {
      const issuedAt = new Date(decoded.iat * 1000)
      if (issuedAt < user.passwordChangedAt) {
        return res.status(401).json({ error: 'Session expired' })
      }
    }
    if (user.sessionsRevokedAt && decoded.iat) {
      const issuedAt = new Date(decoded.iat * 1000)
      if (issuedAt < user.sessionsRevokedAt) {
        return res.status(401).json({ error: 'Session expired' })
      }
    }
    req.user = user

    const path = req.originalUrl || req.path || ''
    const bypassConsent =
      path.startsWith('/auth') ||
      path.startsWith('/legal/status') ||
      path.startsWith('/legal/consent')
    if (!bypassConsent) {
      const consentStatus = await getConsentStatus(prisma, user)
      if (consentStatus?.missing?.length) {
        return res.status(403).json({
          error: 'Consent required',
          code: 'CONSENT_REQUIRED',
          missing: consentStatus.missing,
        })
      }
    }

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

async function adminGuard(req, res, next) {
  const header = req.headers.authorization
  let token = null
  if (header && header.startsWith('Bearer ')) {
    token = header.replace('Bearer ', '')
  }
  if (!token) {
    token = getCookieValue(req, ADMIN_AUTH_COOKIE)
  }
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' })
  }
  try {
    const decoded = verifyToken(token)
    if (!(decoded.type === 'ADMIN' || decoded.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const adminId = decoded.adminId || decoded.id
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })
    if (!admin) return res.status(401).json({ error: 'Invalid token' })
    req.admin = admin
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

module.exports = { authGuard, adminGuard, ADMIN_AUTH_COOKIE }
