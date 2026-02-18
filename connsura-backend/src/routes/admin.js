const express = require('express')
const bcrypt = require('bcrypt')
const prisma = require('../prisma')
const { adminGuard, ADMIN_AUTH_COOKIE } = require('../middleware/auth')
const { generateToken } = require('../utils/token')
const { parseJson } = require('../utils/transform')
const { getEmailOtp } = require('../utils/emailOtp')
const {
  notifyFeatureUpdateBroadcast,
  notifyMarketingBroadcast,
} = require('../utils/notifications/dispatcher')
const { SITE_CONTENT_DEFAULTS, sanitizeContent, checkComplianceWarnings } = require('../utils/siteContent')
const { DEFAULT_CREATE_PROFILE_SCHEMA } = require('../utils/formSchema')
const { slugify, ensureProductCatalog } = require('../utils/productCatalog')
const { buildQuestionRecords, normalizeQuestion } = require('../utils/questionBank')

const router = express.Router()

const ADMIN_JWT_EXPIRY = process.env.ADMIN_JWT_EXPIRY || '2h'
const NOTIFICATION_EXPORT_WINDOW_MS = Number(process.env.NOTIFICATION_EXPORT_WINDOW_MS || 30 * 1000)
const NOTIFICATION_EXPORT_MAX = Number(process.env.NOTIFICATION_EXPORT_MAX || 3)
const notificationExportRates = new Map()
const NOTIFICATION_CHANNELS = new Set(['EMAIL', 'IN_APP'])
const NOTIFICATION_STATUSES = new Set(['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED'])

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

const getAdminCookieOptions = () => {
  const rawSameSite = String(process.env.ADMIN_COOKIE_SAMESITE || 'lax').toLowerCase()
  const sameSite = ['lax', 'strict', 'none'].includes(rawSameSite) ? rawSameSite : 'lax'
  const domain = String(process.env.ADMIN_COOKIE_DOMAIN || '').trim()
  const secureFromEnv = String(process.env.ADMIN_COOKIE_SECURE || '').toLowerCase() === 'true'
  const secure = secureFromEnv || process.env.NODE_ENV === 'production' || sameSite === 'none'
  const options = {
    httpOnly: true,
    sameSite,
    secure,
    path: '/admin',
  }
  if (domain) {
    options.domain = domain
  }
  return options
}

const getAdminCookieMaxAge = () => parseDurationMs(ADMIN_JWT_EXPIRY) || 2 * 60 * 60 * 1000


const formatCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  email: customer.user?.email,
  userPassword: customer.user?.password,
  preferredLangs: parseJson(customer.preferredLangs, []),
  coverages: parseJson(customer.coverages, []),
  priorInsurance: parseJson(customer.priorInsurance, []),
  profileData: parseJson(customer.profileData, {}),
  isDisabled: customer.isDisabled,
})

const logAudit = async (actorId, targetType, targetId, action, diff = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        targetType,
        targetId: String(targetId),
        action,
        diff: diff ? JSON.stringify(diff) : null,
      },
    })
  } catch (err) {
    console.error('audit log error', err)
  }
}

const parseAuditDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const parsePositiveInt = (value, fallback) => {
  const raw = Number.parseInt(String(value), 10)
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return raw
}

const parseBoolean = (value) => {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes'].includes(normalized)) return true
  if (['false', '0', 'no'].includes(normalized)) return false
  return null
}

const parseNotificationDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const encodeCursor = (entry) => {
  if (!entry) return null
  const payload = { createdAt: entry.createdAt, id: entry.id }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

const decodeCursor = (cursor) => {
  if (!cursor) return null
  try {
    const raw = Buffer.from(String(cursor), 'base64').toString('utf8')
    const payload = JSON.parse(raw)
    const createdAt = parseNotificationDate(payload?.createdAt)
    const id = String(payload?.id || '').trim()
    if (!createdAt || !id) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

const formatNotificationLogSummary = (row) => ({
  id: row.id,
  createdAt: row.createdAt,
  channel: row.channel,
  eventType: row.eventType,
  severity: row.severity,
  userId: row.userId,
  recipientEmail: row.recipientEmail,
  subject: row.subject,
  provider: row.provider,
  providerMessageId: row.providerMessageId,
  status: row.status,
  required: row.required,
  actorType: row.actorType,
  actorUserId: row.actorUserId,
  correlationId: row.correlationId,
  failureReason: row.failureReason,
})

const formatNotificationLogDetail = (row) => ({
  ...formatNotificationLogSummary(row),
  recipientUserAgentHash: row.recipientUserAgentHash,
  preferenceSnapshot: row.preferenceSnapshot,
  metadata: row.metadata,
  dedupeKey: row.dedupeKey,
})

const checkNotificationExportRate = (adminId) => {
  if (!adminId) return { ok: true }
  const now = Date.now()
  const existing = notificationExportRates.get(adminId)
  if (!existing || now > existing.resetAt) {
    const next = { count: 1, resetAt: now + NOTIFICATION_EXPORT_WINDOW_MS }
    notificationExportRates.set(adminId, next)
    return { ok: true, remaining: NOTIFICATION_EXPORT_MAX - 1, resetAt: next.resetAt }
  }
  if (existing.count >= NOTIFICATION_EXPORT_MAX) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }
  existing.count += 1
  notificationExportRates.set(adminId, existing)
  return { ok: true, remaining: NOTIFICATION_EXPORT_MAX - existing.count, resetAt: existing.resetAt }
}

const ensureSiteContentDefaults = async () => {
  const existing = await prisma.siteContent.findMany({
    where: { slug: { in: SITE_CONTENT_DEFAULTS.map((entry) => entry.slug) } },
  })
  const existingSlugs = new Set(existing.map((entry) => entry.slug))
  const missing = SITE_CONTENT_DEFAULTS.filter((entry) => !existingSlugs.has(entry.slug))
  if (!missing.length) return
  await prisma.siteContent.createMany({
    data: missing.map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      content: entry.content,
      updatedBy: 'system',
    })),
  })
}

const ensureFormSchemaDefaults = async () => {
  const existing = await prisma.formSchema.findUnique({ where: { slug: 'create-profile' } })
  if (existing) return
  await prisma.formSchema.create({
    data: {
      slug: 'create-profile',
      schema: JSON.stringify(DEFAULT_CREATE_PROFILE_SCHEMA),
      updatedBy: 'system',
    },
  })
}

const formatFormSchema = (entry) => ({
  slug: entry.slug,
  schema: JSON.parse(entry.schema),
  updatedBy: entry.updatedBy,
  updatedAt: entry.updatedAt,
})

const formatSiteContent = (entry) => ({
  slug: entry.slug,
  title: entry.title,
  content: entry.content,
  lastUpdated: entry.lastUpdated,
  updatedBy: entry.updatedBy,
})

const parseErrorMetadata = (value) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (err) {
    return value
  }
}

const formatErrorEvent = (event) => ({
  id: event.id,
  createdAt: event.createdAt,
  level: event.level,
  source: event.source,
  message: event.message,
  stack: event.stack,
  url: event.url,
  userAgent: event.userAgent,
  componentStack: event.componentStack,
  release: event.release,
  sessionId: event.sessionId,
  fingerprint: event.fingerprint,
  metadata: parseErrorMetadata(event.metadata),
  userId: event.userId,
  userEmail: event.user?.email || null,
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const admin = await prisma.adminUser.findUnique({ where: { email } })
  if (!admin) return res.status(400).json({ error: 'Invalid credentials' })
  const match = await bcrypt.compare(password, admin.password)
  if (!match) return res.status(400).json({ error: 'Invalid credentials' })
  const token = generateToken({ adminId: admin.id, role: admin.role, type: 'ADMIN' }, { expiresIn: ADMIN_JWT_EXPIRY })
  const cookieOptions = getAdminCookieOptions()
  res.cookie(ADMIN_AUTH_COOKIE, token, { ...cookieOptions, maxAge: getAdminCookieMaxAge() })
  res.json({ token, admin: { id: admin.id, email: admin.email, role: admin.role } })
})

router.post('/logout', (req, res) => {
  const cookieOptions = getAdminCookieOptions()
  res.clearCookie(ADMIN_AUTH_COOKIE, cookieOptions)
  res.json({ ok: true })
})

router.get('/me', adminGuard, async (req, res) => {
  if (!req.admin) return res.status(401).json({ error: 'Invalid token' })
  res.json({ admin: { id: req.admin.id, email: req.admin.email, role: req.admin.role } })
})

router.get('/email-otp', adminGuard, async (req, res) => {
  const email = String(req.query?.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email is required' })
  const otp = await getEmailOtp(email)
  if (!otp) return res.status(404).json({ error: 'No active verification code for this email.' })
  res.json({ code: otp.code, createdAt: otp.createdAt, expiresAt: otp.expiresAt, attempts: otp.attempts })
})

router.post('/notifications/broadcast', adminGuard, async (req, res) => {
  const type = String(req.body?.type || '').trim().toLowerCase()
  if (!['feature', 'marketing'].includes(type)) {
    return res.status(400).json({ error: 'Type must be feature or marketing' })
  }
  const title = String(req.body?.title || '').trim()
  const summary = String(req.body?.summary || '').trim()
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER', email: { not: null }, emailVerified: true },
    select: { id: true, email: true },
  })
  try {
    const actor = { type: 'ADMIN', id: req.admin?.id || null }
    if (type === 'feature') {
      await notifyFeatureUpdateBroadcast({ users, title, summary, actor })
    } else {
      await notifyMarketingBroadcast({ users, title, summary, actor })
    }
    await logAudit(req.admin.id, 'Admin', req.admin.id, 'notification_broadcast', {
      type,
      title: title || null,
      summary: summary || null,
      targetCount: users.length,
    })
  } catch (err) {
    console.error('notification broadcast error', err)
    return res.status(500).json({ error: 'Failed to send notification broadcast' })
  }
  return res.json({ sent: true, targetCount: users.length })
})

// Customers
router.get('/clients', adminGuard, async (req, res) => {
  const query = String(req.query?.query || '').trim()
  const statusRaw = String(req.query?.status || '').trim().toLowerCase()
  const status = statusRaw === 'disabled' ? 'disabled' : statusRaw === 'active' ? 'active' : ''
  const limit = Math.min(parsePositiveInt(req.query?.limit, 25), 200)
  const page = parsePositiveInt(req.query?.page, 1)
  const offsetParam = Number.parseInt(String(req.query?.offset || ''), 10)
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : (page - 1) * limit
  const effectivePage =
    Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offset / limit) + 1 : page

  const where = {
    ...(status === 'disabled' ? { isDisabled: true } : {}),
    ...(status === 'active' ? { isDisabled: false } : {}),
  }

  if (query) {
    const numericId = Number(query)
    const isNumeric = Number.isFinite(numericId)
    const orFilters = []
    if (isNumeric) {
      orFilters.push({ id: numericId }, { userId: numericId })
    }
    orFilters.push(
      { name: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } }
    )
    where.OR = orFilters
  }

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { user: true },
      orderBy: { id: 'desc' },
      skip: offset,
      take: limit + 1,
    }),
  ])
  const hasMore = rows.length > limit
  const trimmed = rows.slice(0, limit)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  res.json({
    clients: trimmed.map(formatCustomer),
    page: effectivePage,
    limit,
    offset,
    total,
    totalPages,
    hasMore,
    nextPage: hasMore ? effectivePage + 1 : null,
    nextOffset: hasMore ? offset + limit : null,
  })
})

router.get('/clients/:id', adminGuard, async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(req.params.id) },
    include: { user: true },
  })
  if (!customer) return res.status(404).json({ error: 'Client not found' })
  res.json({ client: formatCustomer(customer) })
})

router.put('/clients/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const payload = req.body || {}
  const data = {}
  const userUpdates = {}
  if (payload.email !== undefined) userUpdates.email = payload.email
  if (payload.password !== undefined) userUpdates.password = await bcrypt.hash(payload.password, 10)
  if (payload.name !== undefined) data.name = payload.name
  if (payload.preferredLangs !== undefined) data.preferredLangs = JSON.stringify(payload.preferredLangs)
  if (payload.coverages !== undefined) data.coverages = JSON.stringify(payload.coverages)
  if (payload.priorInsurance !== undefined) data.priorInsurance = JSON.stringify(payload.priorInsurance)
  if (payload.profileData !== undefined) data.profileData = JSON.stringify(payload.profileData)
  if (payload.isDisabled !== undefined) data.isDisabled = payload.isDisabled

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...data,
      ...(Object.keys(userUpdates).length ? { user: { update: userUpdates } } : {}),
    },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Client', id, 'update', { ...data, ...(Object.keys(userUpdates).length ? { user: userUpdates } : {}) })
  res.json({ client: formatCustomer(customer) })
})

router.post('/clients/:id/disable', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const customer = await prisma.customer.update({
    where: { id },
    data: { isDisabled: true },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Client', id, 'disable')
  res.json({ client: formatCustomer(customer) })
})

router.post('/clients/:id/enable', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const customer = await prisma.customer.update({
    where: { id },
    data: { isDisabled: false },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Client', id, 'enable')
  res.json({ client: formatCustomer(customer) })
})

router.delete('/clients/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const customer = await prisma.customer.findUnique({ where: { id } })
  if (!customer) return res.status(404).json({ error: 'Client not found' })
  await prisma.user.delete({ where: { id: customer.userId } })
  await logAudit(req.admin.id, 'Client', id, 'delete')
  res.json({ success: true })
})

// Audit logs
router.get('/audit', adminGuard, async (req, res) => {
  const type = String(req.query?.type || '').trim().toLowerCase()
  const query = String(req.query?.query || '').trim()
  const startRaw = String(req.query?.start || '').trim()
  const endRaw = String(req.query?.end || '').trim()
  const limit = Math.min(parsePositiveInt(req.query?.limit, 10), 100)
  const page = parsePositiveInt(req.query?.page, 1)
  const offsetParam = Number.parseInt(String(req.query?.offset || ''), 10)
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : (page - 1) * limit
  const effectivePage =
    Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offset / limit) + 1 : page
  const startDate = parseAuditDate(startRaw)
  const endDate = parseAuditDate(endRaw)
  if ((startRaw && !startDate) || (endRaw && !endDate)) {
    return res.status(400).json({ error: 'Invalid date range' })
  }
  if (startDate && endDate && endDate < startDate) {
    return res.status(400).json({ error: 'End date must be after start date' })
  }

  const createdAt = {}
  if (startDate) createdAt.gte = startDate
  if (endDate) createdAt.lte = endDate
  const baseWhere = Object.keys(createdAt).length ? { createdAt } : {}

  let where = baseWhere

  if (type === 'client') {
    const targetType = 'Client'
    if (!query) {
      where = {
        ...baseWhere,
        targetType,
      }
    } else {
      const normalizedQuery = query.toLowerCase()
      const numericId = Number(query)
      const isNumeric = Number.isFinite(numericId)
      const matches = []

      const customerWhere = { OR: [] }
      if (isNumeric) {
        customerWhere.OR.push({ id: numericId }, { userId: numericId })
      }
      customerWhere.OR.push(
        { name: { contains: query, mode: 'insensitive' } },
        { user: { email: { contains: query, mode: 'insensitive' } } }
      )
      const customers = await prisma.customer.findMany({
        where: customerWhere,
        select: { id: true },
        take: 50,
      })
      matches.push(...customers.map((customer) => String(customer.id)))

      const orFilters = [
        { targetId: { equals: query } },
        { targetId: { equals: normalizedQuery, mode: 'insensitive' } },
      ]
      if (matches.length) {
        orFilters.push({ targetId: { in: matches } })
      }
      if (query.includes('@')) {
        orFilters.push({ targetId: { equals: normalizedQuery, mode: 'insensitive' } })
      }

      where = {
        ...baseWhere,
        targetType,
        OR: orFilters,
      }
    }
  } else if (type === 'admin') {
    where = {
      ...baseWhere,
      targetType: { notIn: ['Client'] },
    }
  } else if (type) {
    return res.status(400).json({ error: 'Invalid audit log type' })
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
      include: { actor: true },
    }),
  ])
  const hasMore = logs.length > limit
  const trimmed = logs.slice(0, limit)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  res.json({
    logs: trimmed.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actor?.email,
      targetType: log.targetType,
      targetId: log.targetId,
      action: log.action,
      diff: log.diff ? JSON.parse(log.diff) : null,
      createdAt: log.createdAt,
    })),
    page: effectivePage,
    limit,
    offset,
    total,
    totalPages,
    hasMore,
    nextPage: hasMore ? effectivePage + 1 : null,
    nextOffset: hasMore ? offset + limit : null,
  })
})

// Error events
router.get('/errors', adminGuard, async (req, res) => {
  const query = String(req.query?.query || '').trim()
  const level = String(req.query?.level || '').trim().toLowerCase()
  const source = String(req.query?.source || '').trim().toLowerCase()
  const startRaw = String(req.query?.start || '').trim()
  const endRaw = String(req.query?.end || '').trim()
  const limit = Math.min(parsePositiveInt(req.query?.limit, 25), 200)
  const page = parsePositiveInt(req.query?.page, 1)
  const offsetParam = Number.parseInt(String(req.query?.offset || ''), 10)
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : (page - 1) * limit
  const effectivePage =
    Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offset / limit) + 1 : page
  const startDate = parseAuditDate(startRaw)
  const endDate = parseAuditDate(endRaw)
  if ((startRaw && !startDate) || (endRaw && !endDate)) {
    return res.status(400).json({ error: 'Invalid date range' })
  }
  if (startDate && endDate && endDate < startDate) {
    return res.status(400).json({ error: 'End date must be after start date' })
  }

  const createdAt = {}
  if (startDate) createdAt.gte = startDate
  if (endDate) createdAt.lte = endDate
  const baseWhere = Object.keys(createdAt).length ? { createdAt } : {}
  const where = {
    ...baseWhere,
    ...(level ? { level } : {}),
    ...(source ? { source } : {}),
    ...(query
      ? {
          OR: [
            { message: { contains: query, mode: 'insensitive' } },
            { url: { contains: query, mode: 'insensitive' } },
            { stack: { contains: query, mode: 'insensitive' } },
            { userAgent: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.errorEvent.count({ where }),
    prisma.errorEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
      include: { user: true },
    }),
  ])
  const hasMore = rows.length > limit
  const trimmed = rows.slice(0, limit)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  res.json({
    errors: trimmed.map(formatErrorEvent),
    page: effectivePage,
    limit,
    offset,
    total,
    totalPages,
    hasMore,
    nextPage: hasMore ? effectivePage + 1 : null,
    nextOffset: hasMore ? offset + limit : null,
  })
})

// Notification logs
router.get('/notification-logs', adminGuard, async (req, res) => {
  const query = String(req.query?.q || '').trim()
  const userIdParam = req.query?.user_id ?? req.query?.userId
  const eventType = String(req.query?.event_type || req.query?.eventType || '').trim().toUpperCase()
  const channelRaw = String(req.query?.channel || '').trim().toUpperCase()
  const statusRaw = String(req.query?.status || '').trim().toUpperCase()
  const required = parseBoolean(req.query?.required)
  const recipientEmail = String(req.query?.recipient_email || req.query?.recipientEmail || '').trim()
  const dateFrom = parseNotificationDate(req.query?.date_from || req.query?.dateFrom)
  const dateTo = parseNotificationDate(req.query?.date_to || req.query?.dateTo)
  const limit = Math.min(parsePositiveInt(req.query?.limit, 50), 200)
  const sortRaw = String(req.query?.sort || '').trim().toLowerCase()
  const sortDir = sortRaw === 'asc' || sortRaw === 'oldest' ? 'asc' : 'desc'
  const cursor = decodeCursor(req.query?.cursor)

  const userId = userIdParam ? Number(userIdParam) : null
  const where = {}
  if (Number.isFinite(userId) && userId > 0) where.userId = userId
  if (eventType) where.eventType = eventType
  if (NOTIFICATION_CHANNELS.has(channelRaw)) where.channel = channelRaw
  if (NOTIFICATION_STATUSES.has(statusRaw)) where.status = statusRaw
  if (required !== null) where.required = required
  if (recipientEmail) where.recipientEmail = { contains: recipientEmail, mode: 'insensitive' }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    }
  }

  const andFilters = []
  if (query) {
    andFilters.push({
      OR: [
        { subject: { contains: query, mode: 'insensitive' } },
        { recipientEmail: { contains: query, mode: 'insensitive' } },
        { providerMessageId: { contains: query, mode: 'insensitive' } },
        { correlationId: { contains: query, mode: 'insensitive' } },
      ],
    })
  }

  const countWhere = { ...where, ...(andFilters.length ? { AND: andFilters } : {}) }

  if (cursor) {
    const comparator = sortDir === 'asc' ? 'gt' : 'lt'
    andFilters.push({
      OR: [
        { createdAt: { [comparator]: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { [comparator]: cursor.id } },
      ],
    })
  }

  const listWhere = { ...where, ...(andFilters.length ? { AND: andFilters } : {}) }
  const [total, rows] = await Promise.all([
    prisma.notificationLog.count({ where: countWhere }),
    prisma.notificationLog.findMany({
      where: listWhere,
      orderBy: [{ createdAt: sortDir }, { id: sortDir }],
      take: limit + 1,
    }),
  ])

  const hasMore = rows.length > limit
  const trimmed = rows.slice(0, limit)
  const nextCursor = hasMore ? encodeCursor(trimmed[trimmed.length - 1]) : null
  res.json({
    logs: trimmed.map(formatNotificationLogSummary),
    total,
    limit,
    hasMore,
    nextCursor,
  })
})

router.get('/notification-logs/export', adminGuard, async (req, res) => {
  const rate = checkNotificationExportRate(req.admin?.id)
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))
    res.set('Retry-After', String(retryAfter))
    return res.status(429).json({ error: 'Export rate limit exceeded. Try again shortly.' })
  }

  const query = String(req.query?.q || '').trim()
  const userIdParam = req.query?.user_id ?? req.query?.userId
  const eventType = String(req.query?.event_type || req.query?.eventType || '').trim().toUpperCase()
  const channelRaw = String(req.query?.channel || '').trim().toUpperCase()
  const statusRaw = String(req.query?.status || '').trim().toUpperCase()
  const required = parseBoolean(req.query?.required)
  const recipientEmail = String(req.query?.recipient_email || req.query?.recipientEmail || '').trim()
  const dateFrom = parseNotificationDate(req.query?.date_from || req.query?.dateFrom)
  const dateTo = parseNotificationDate(req.query?.date_to || req.query?.dateTo)
  const limit = Math.min(parsePositiveInt(req.query?.limit, 1000), 5000)

  const userId = userIdParam ? Number(userIdParam) : null
  const where = {}
  if (Number.isFinite(userId) && userId > 0) where.userId = userId
  if (eventType) where.eventType = eventType
  if (NOTIFICATION_CHANNELS.has(channelRaw)) where.channel = channelRaw
  if (NOTIFICATION_STATUSES.has(statusRaw)) where.status = statusRaw
  if (required !== null) where.required = required
  if (recipientEmail) where.recipientEmail = { contains: recipientEmail, mode: 'insensitive' }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    }
  }

  const andFilters = []
  if (query) {
    andFilters.push({
      OR: [
        { subject: { contains: query, mode: 'insensitive' } },
        { recipientEmail: { contains: query, mode: 'insensitive' } },
        { providerMessageId: { contains: query, mode: 'insensitive' } },
        { correlationId: { contains: query, mode: 'insensitive' } },
      ],
    })
  }

  const exportWhere = { ...where, ...(andFilters.length ? { AND: andFilters } : {}) }
  const rows = await prisma.notificationLog.findMany({
    where: exportWhere,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const header = [
    'created_at',
    'channel',
    'event_type',
    'severity',
    'user_id',
    'recipient_email',
    'subject',
    'provider',
    'provider_message_id',
    'status',
    'required',
    'actor_type',
    'actor_user_id',
    'correlation_id',
    'failure_reason',
    'metadata',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    const metadataValue = row.metadata ? JSON.stringify(row.metadata) : ''
    const values = [
      row.createdAt.toISOString(),
      row.channel,
      row.eventType,
      row.severity,
      row.userId || '',
      row.recipientEmail || '',
      row.subject || '',
      row.provider || '',
      row.providerMessageId || '',
      row.status,
      row.required ? 'true' : 'false',
      row.actorType || '',
      row.actorUserId || '',
      row.correlationId || '',
      row.failureReason || '',
      metadataValue.replace(/\n|\r/g, ' '),
    ]
    lines.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
  }

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=\"notification-logs.csv\"')
  res.send(lines.join('\n'))
})

router.get('/notification-logs/:id', adminGuard, async (req, res) => {
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ error: 'Log id is required' })
  const log = await prisma.notificationLog.findUnique({ where: { id } })
  if (!log) return res.status(404).json({ error: 'Notification log not found' })
  res.json({ log: formatNotificationLogDetail(log) })
})

// Site content management
router.get('/site-content', adminGuard, async (req, res) => {
  await ensureSiteContentDefaults()
  const entries = await prisma.siteContent.findMany({
    where: { slug: { in: SITE_CONTENT_DEFAULTS.map((entry) => entry.slug) } },
    orderBy: { slug: 'asc' },
  })
  res.json({ content: entries.map(formatSiteContent) })
})

router.put('/site-content/:slug', adminGuard, async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ error: 'Slug is required' })
  const incomingTitle = String(req.body?.title || '').trim()
  const incomingContent = String(req.body?.content || '')
  if (!incomingTitle) return res.status(400).json({ error: 'Title is required' })

  const sanitizedContent = sanitizeContent(incomingContent)
  const warnings = checkComplianceWarnings(sanitizedContent)

  const entry = await prisma.siteContent.upsert({
    where: { slug },
    create: {
      slug,
      title: incomingTitle,
      content: sanitizedContent,
      updatedBy: req.admin?.email || String(req.admin?.id || ''),
      lastUpdated: new Date(),
    },
    update: {
      title: incomingTitle,
      content: sanitizedContent,
      updatedBy: req.admin?.email || String(req.admin?.id || ''),
      lastUpdated: new Date(),
    },
  })

  if (warnings.length) {
    console.warn(`content compliance warning for ${slug}:`, warnings)
    await logAudit(req.admin.id, 'SiteContent', slug, 'content_warning', { warnings })
  }

  await logAudit(req.admin.id, 'SiteContent', slug, 'update', {
    title: incomingTitle,
    warningCount: warnings.length,
  })
  res.json({ content: formatSiteContent(entry), warnings })
})

// Form schema management
router.get('/form-schema/:slug', adminGuard, async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ error: 'Slug is required' })
  if (slug === 'create-profile') {
    await ensureFormSchemaDefaults()
  }
  const entry = await prisma.formSchema.findUnique({ where: { slug } })
  if (!entry) return res.status(404).json({ error: 'Schema not found' })
  res.json({ schema: formatFormSchema(entry) })
})

router.put('/form-schema/:slug', adminGuard, async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ error: 'Slug is required' })
  const schema = req.body?.schema
  if (!schema) return res.status(400).json({ error: 'Schema is required' })

  const entry = await prisma.formSchema.upsert({
    where: { slug },
    create: {
      slug,
      schema: JSON.stringify(schema),
      updatedBy: req.admin?.email || String(req.admin?.id || ''),
    },
    update: {
      schema: JSON.stringify(schema),
      updatedBy: req.admin?.email || String(req.admin?.id || ''),
    },
  })
  await logAudit(req.admin.id, 'FormSchema', slug, 'update')
  res.json({ schema: formatFormSchema(entry) })
})

// Product catalog
router.get('/products', adminGuard, async (req, res) => {
  await ensureProductCatalog(prisma)
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  res.json({ products })
})

router.post('/products', adminGuard, async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Name is required' })
  const slug = slugify(req.body?.slug || name)
  if (!slug) return res.status(400).json({ error: 'Slug is required' })
  const product = await prisma.product.create({ data: { name, slug } })
  await logAudit(req.admin.id, 'Product', product.id, 'create')
  res.status(201).json({ product })
})

router.delete('/products/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Product id required' })
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Product not found' })
  await prisma.product.delete({ where: { id } })
  await logAudit(req.admin.id, 'Product', id, 'delete')
  res.json({ ok: true })
})

const parseProductFormSchema = (value) => {
  const parsed = parseJson(value, {})
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : []
  return { sections }
}

const normalizeProductSectionKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeCaseInsensitiveQuestionText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()

const normalizeProductFormSchema = (value) => {
  const parsed = value && typeof value === 'object' ? value : {}
  const sections = Array.isArray(parsed.sections) ? parsed.sections : []
  return {
    sections: sections
      .map((section, index) => {
        const key = normalizeProductSectionKey(section?.key || section?.label || `section-${index + 1}`)
        const label = String(section?.label || key || `Section ${index + 1}`).trim()
        const questionIds = Array.isArray(section?.questionIds)
          ? Array.from(
              new Set(
                section.questionIds
                  .map((id) => Number(id))
                  .filter((id) => Number.isInteger(id) && id > 0)
              )
            )
          : []
        if (!key) return null
        return { key, label, questionIds }
      })
      .filter(Boolean),
  }
}

const formatProductWithSchema = (product) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  formSchema: parseProductFormSchema(product.formSchema),
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
})

router.get('/forms/products', adminGuard, async (req, res) => {
  await ensureProductCatalog(prisma)
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  res.json({ products: products.map(formatProductWithSchema) })
})

router.put('/forms/products/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Product id required' })
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const name = req.body?.name === undefined ? undefined : String(req.body?.name || '').trim()
  if (name !== undefined && !name) {
    return res.status(400).json({ error: 'Name cannot be empty' })
  }

  const incomingSchema = req.body?.formSchema
  const normalizedSchema =
    incomingSchema === undefined
      ? parseProductFormSchema(existing.formSchema)
      : normalizeProductFormSchema(incomingSchema)

  const allQuestionIds = Array.from(
    new Set(
      normalizedSchema.sections
        .flatMap((section) => section.questionIds || [])
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  )
  if (allQuestionIds.length) {
    const found = await prisma.questionBank.findMany({
      where: { id: { in: allQuestionIds }, source: 'SYSTEM' },
      select: { id: true },
    })
    const foundIds = new Set(found.map((row) => row.id))
    const missing = allQuestionIds.filter((id) => !foundIds.has(id))
    if (missing.length) {
      return res.status(400).json({ error: `Unknown questionIds: ${missing.join(', ')}` })
    }
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      formSchema: JSON.stringify(normalizedSchema),
    },
  })
  await logAudit(req.admin.id, 'Product', id, 'update', {
    ...(name !== undefined ? { name } : {}),
    formSchema: normalizedSchema,
  })
  res.json({ product: formatProductWithSchema(updated) })
})

router.post('/forms/questions/deduplicate', adminGuard, async (req, res) => {
  const productId = Number(req.body?.productId)
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Valid productId is required' })
  }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const schema = parseProductFormSchema(product.formSchema)
  const mappedQuestionIds = new Set(
    (Array.isArray(schema?.sections) ? schema.sections : [])
      .flatMap((section) => (Array.isArray(section?.questionIds) ? section.questionIds : []))
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )

  const questions = await prisma.questionBank.findMany({
    where: { source: 'SYSTEM' },
    orderBy: [{ id: 'asc' }],
    select: { id: true, text: true },
  })

  const groups = new Map()
  questions.forEach((question) => {
    const normalized = normalizeCaseInsensitiveQuestionText(question.text)
    if (!normalized) return
    const existing = groups.get(normalized) || []
    existing.push(question)
    groups.set(normalized, existing)
  })

  const toDelete = []
  groups.forEach((group) => {
    if (!Array.isArray(group) || group.length <= 1) return
    const mappedInCurrentProduct = group.filter((question) => mappedQuestionIds.has(Number(question.id)))
    const keeper = mappedInCurrentProduct[0] || group[0]
    group.forEach((question) => {
      if (Number(question.id) === Number(keeper.id)) return
      if (mappedQuestionIds.has(Number(question.id))) return
      toDelete.push(question)
    })
  })

  if (!toDelete.length) {
    return res.json({ deleted: 0, deletedIds: [] })
  }

  const deleteIds = toDelete.map((question) => Number(question.id)).filter((id) => Number.isInteger(id) && id > 0)
  await prisma.questionBank.deleteMany({ where: { id: { in: deleteIds } } })
  await Promise.all(
    toDelete.map((question) =>
      logAudit(req.admin.id, 'QuestionBank', question.id, 'delete_duplicate_unused_for_product', {
        productId,
        text: question.text,
      })
    )
  )

  return res.json({ deleted: deleteIds.length, deletedIds: deleteIds })
})

router.get('/forms/questions', adminGuard, async (req, res) => {
  const query = String(req.query?.query || '').trim()
  const where = {
    source: 'SYSTEM',
    ...(query
      ? {
          OR: [
            { text: { contains: query, mode: 'insensitive' } },
            { normalized: { contains: query.toLowerCase(), mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const questions = await prisma.questionBank.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  res.json({
    questions: questions.map((row) => ({
      id: row.id,
      label: row.text,
      text: row.text,
      type: row.inputType || 'general',
      inputType: row.inputType || 'general',
      options: parseJson(row.selectOptions, []),
      selectOptions: parseJson(row.selectOptions, []),
      productId: row.productId,
    })),
  })
})

const parseCustomerProfile = (profileData) => parseJson(profileData, {})

const resolveFormProductId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const QUESTION_INPUT_TYPES = new Set(['general', 'select', 'yes/no', 'number', 'date', 'text'])
const normalizeQuestionInputType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (QUESTION_INPUT_TYPES.has(normalized)) return normalized
  if (normalized === 'yesno' || normalized === 'yes-no' || normalized === 'yes_no') return 'yes/no'
  return 'general'
}

const normalizeSelectOptions = (value) => {
  if (!value) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
}

const collectDuplicateValues = (values = []) => {
  const seen = new Set()
  const duplicates = new Set()
  values.forEach((value) => {
    if (!value) return
    if (seen.has(value)) {
      duplicates.add(value)
      return
    }
    seen.add(value)
  })
  return Array.from(duplicates)
}

const resolveFormName = (form, fallbackName) => {
  const name = String(form?.name || form?.productName || fallbackName || '').trim()
  return name
}

const migrateDeletedSystemQuestions = async (questions = []) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { created: 0 }
  }
  const normalizedMap = new Map()
  questions.forEach((question) => {
    if (!question?.text) return
    const normalized = question.normalized || normalizeQuestion(question.text)
    if (!normalized || normalizedMap.has(normalized)) return
    normalizedMap.set(normalized, {
      id: question.id,
      text: question.text,
      normalized,
      productId: question.productId ?? null,
    })
  })
  if (!normalizedMap.size) return { created: 0 }

  const productIds = Array.from(
    new Set(
      Array.from(normalizedMap.values())
        .map((question) => question.productId)
        .filter((id) => Boolean(id))
    )
  )
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      })
    : []
  const productNameById = new Map(products.map((product) => [product.id, product.name]))

  const customers = await prisma.customer.findMany({
    select: { id: true, profileData: true },
  })
  const records = []
  const recordKeys = new Set()

  customers.forEach((customer) => {
    const profile = parseCustomerProfile(customer.profileData)
    const additionalForms = Array.isArray(profile?.additional?.additionalForms)
      ? profile.additional.additionalForms
      : Array.isArray(profile?.additionalForms)
        ? profile.additionalForms
        : []
    if (!additionalForms.length) return

    additionalForms.forEach((form) => {
      const formQuestions = Array.isArray(form?.questions) ? form.questions : []
      if (!formQuestions.length) return
      const formProductId = resolveFormProductId(form?.productId)
      formQuestions.forEach((question) => {
        const text = typeof question === 'string' ? question : question?.question || question?.text || ''
        if (!text) return
        const normalized = normalizeQuestion(text)
        if (!normalized || !normalizedMap.has(normalized)) return
        const deleted = normalizedMap.get(normalized)
        if (deleted?.productId && formProductId && deleted.productId !== formProductId) return
        const resolvedProductId = deleted?.productId ?? formProductId ?? null
        const fallbackName = deleted?.productId ? productNameById.get(deleted.productId) : ''
        const formName = resolveFormName(form, fallbackName)
        if (!formName) return
        const key = `${customer.id}|${resolvedProductId || ''}|${formName}|${normalized}`
        if (recordKeys.has(key)) return
        recordKeys.add(key)
        records.push({
          text: deleted.text,
          normalized,
          productId: resolvedProductId,
          customerId: customer.id,
          formName,
        })
      })
    })
  })

  if (!records.length) {
    return { created: 0 }
  }
  const result = await prisma.customerQuestion.createMany({
    data: records,
    skipDuplicates: true,
  })
  return { created: result.count }
}

// Question bank management
router.get('/questions', adminGuard, async (req, res) => {
  const productId = req.query.productId ? Number(req.query.productId) : null
  const source = req.query.source ? String(req.query.source).toUpperCase() : null
  const normalizedSource = source === 'SYSTEM' || source === 'CUSTOMER' ? source : null
  const sourceRank = { SYSTEM: 1, CUSTOMER: 0 }

  const systemQuestions =
    !normalizedSource || normalizedSource === 'SYSTEM'
      ? await prisma.questionBank.findMany({
          where: {
            ...(productId ? { productId } : {}),
            source: 'SYSTEM',
          },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        })
      : []

  const customerQuestions =
    !normalizedSource || normalizedSource === 'CUSTOMER'
      ? await prisma.customerQuestion.findMany({
          where: {
            ...(productId ? { productId } : {}),
          },
          orderBy: { id: 'asc' },
          include: { customer: { include: { user: true } } },
        })
      : []

  const combined = [
    ...systemQuestions.map((row) => ({
      id: row.id,
      text: row.text,
      source: 'SYSTEM',
      productId: row.productId,
      inputType: row.inputType || 'general',
      selectOptions: parseJson(row.selectOptions, []),
      customerId: null,
      customerName: null,
      customerEmail: null,
      formName: null,
    })),
    ...customerQuestions.map((row) => ({
      id: row.id,
      text: row.text,
      source: 'CUSTOMER',
      productId: row.productId,
      inputType: 'general',
      selectOptions: [],
      customerId: row.customerId,
      customerName: row.customer?.name || null,
      customerEmail: row.customer?.user?.email || null,
      formName: row.formName || null,
    })),
  ].sort((a, b) => {
    const sourceDelta = (sourceRank[b.source] ?? 0) - (sourceRank[a.source] ?? 0)
    if (sourceDelta !== 0) return sourceDelta
    return a.id - b.id
  })

  res.json({ questions: combined })
})

router.post('/questions', adminGuard, async (req, res) => {
  const productId = req.body?.productId ? Number(req.body.productId) : null
  const sync = Boolean(req.body?.sync)
  const incoming = Array.isArray(req.body?.texts) ? req.body.texts : [req.body?.text]
  const received = incoming
    .flatMap((entry) => String(entry || '').split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (!received.length) return res.status(400).json({ error: 'Question text is required' })
  const normalizedReceived = received.map((entry) => normalizeQuestion(entry)).filter(Boolean)
  const duplicateIncoming = collectDuplicateValues(normalizedReceived)
  if (duplicateIncoming.length) {
    return res.status(400).json({ error: 'No duplicated questions' })
  }

  if (!sync) {
    const existing = await prisma.questionBank.findMany({
      where: { source: 'SYSTEM', normalized: { in: normalizedReceived } },
      select: { normalized: true },
    })
    if (existing.length) {
      return res.status(400).json({ error: 'No duplicated questions' })
    }
  }

  const records = buildQuestionRecords(received, 'SYSTEM', productId || null, null)
  if (!records.length) return res.status(400).json({ error: 'Invalid question text' })
  const orderMap = new Map(records.map((record, index) => [record.normalized, index + 1]))
  records.forEach((record) => {
    record.sortOrder = orderMap.get(record.normalized) || null
  })

  if (sync) {
    if (!productId) return res.status(400).json({ error: 'Product is required for sync' })

    const existing = await prisma.questionBank.findMany({
      where: { productId, source: 'SYSTEM' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const existingByNormalized = new Map(existing.map((item) => [item.normalized, item]))
    const incomingNormalized = new Set(records.map((record) => record.normalized))

    const toDelete = existing.filter((item) => !incomingNormalized.has(item.normalized))
    const toCreate = records.filter((record) => !existingByNormalized.has(record.normalized))
    const toUpdateOrder = existing.filter(
      (item) =>
        orderMap.has(item.normalized) && item.sortOrder !== orderMap.get(item.normalized)
    )
    let skipped = 0
    const skippedTexts = []

    if (toDelete.length) {
      await migrateDeletedSystemQuestions(toDelete)
      await prisma.questionBank.deleteMany({ where: { id: { in: toDelete.map((item) => item.id) } } })
      for (const item of toDelete) {
        await logAudit(req.admin.id, 'QuestionBank', item.id, 'delete', { productId })
      }
    }

    if (toUpdateOrder.length) {
      await prisma.$transaction(
        toUpdateOrder.map((item) =>
          prisma.questionBank.update({
            where: { id: item.id },
            data: { sortOrder: orderMap.get(item.normalized) },
          })
        )
      )
    }

    const createdQuestions = []
    for (const record of toCreate) {
      try {
        const created = await prisma.questionBank.create({ data: record })
        createdQuestions.push(created)
        await logAudit(req.admin.id, 'QuestionBank', created.id, 'create', {
          productId: created.productId,
        })
      } catch (err) {
        if (err?.code === 'P2002') {
          skipped += 1
          skippedTexts.push(record.text)
          continue
        }
        if (err?.code !== 'P2002') {
          throw err
        }
      }
    }

    const updated = await prisma.questionBank.findMany({
      where: { productId, source: 'SYSTEM' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })

    return res.status(201).json({
      created: createdQuestions.length,
      deleted: toDelete.length,
      skipped,
      skippedTexts,
      prepared: records.length,
      received: received.length,
      questions: updated.map((question) => ({
        id: question.id,
        text: question.text,
        source: question.source,
        productId: question.productId,
        inputType: question.inputType || 'general',
        selectOptions: parseJson(question.selectOptions, []),
      })),
    })
  }

  const createdQuestions = []
  let skipped = 0
  const skippedTexts = []
  let sortCursor = 0
  if (productId || productId === 0) {
    const last = await prisma.questionBank.findFirst({
      where: { productId, source: 'SYSTEM' },
      orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }],
      select: { sortOrder: true },
    })
    sortCursor = last?.sortOrder ?? 0
  }
  for (const record of records) {
    try {
      sortCursor += 1
      record.sortOrder = sortCursor
      const created = await prisma.questionBank.create({ data: record })
      createdQuestions.push(created)
      await logAudit(req.admin.id, 'QuestionBank', created.id, 'create', {
        productId: created.productId,
        })
      } catch (err) {
        if (err?.code === 'P2002') {
          skipped += 1
          skippedTexts.push(record.text)
          continue
        }
        throw err
      }
    }

    const payload = {
      created: createdQuestions.length,
      prepared: records.length,
      received: received.length,
      skipped,
      skippedTexts,
      questions: createdQuestions.map((question) => ({
        id: question.id,
        text: question.text,
        source: question.source,
        productId: question.productId,
        inputType: question.inputType || 'general',
        selectOptions: parseJson(question.selectOptions, []),
    })),
  }

  if (payload.questions.length === 1) {
    payload.question = payload.questions[0]
  }

  res.status(201).json(payload)
})

router.delete('/questions/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Question id required' })
  const source = req.query.source ? String(req.query.source).toUpperCase() : null
  if (source === 'CUSTOMER') {
    await prisma.customerQuestion.delete({ where: { id } })
    await logAudit(req.admin.id, 'CustomerQuestion', id, 'delete')
  } else {
    const existing = await prisma.questionBank.findUnique({ where: { id } })
    if (!existing && source !== 'SYSTEM') {
      const customer = await prisma.customerQuestion.findUnique({ where: { id } })
      if (!customer) return res.status(404).json({ error: 'Question not found' })
      await prisma.customerQuestion.delete({ where: { id } })
      await logAudit(req.admin.id, 'CustomerQuestion', id, 'delete')
      return res.json({ ok: true })
    }
    if (existing) {
      await migrateDeletedSystemQuestions([existing])
    }
    await prisma.questionBank.delete({ where: { id } })
    await logAudit(req.admin.id, 'QuestionBank', id, 'delete')
  }
  res.json({ ok: true })
})

router.put('/questions/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Question id required' })
  const source = String(req.body?.source || req.query.source || '').toUpperCase()
  if (source === 'CUSTOMER') {
    const text = String(req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'Question text is required' })
    const existing = await prisma.customerQuestion.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Question not found' })
    const normalized = normalizeQuestion(text)
    if (!normalized) return res.status(400).json({ error: 'Invalid question text' })
    const updated = await prisma.customerQuestion.update({
      where: { id },
      data: {
        text,
        normalized,
      },
    })
    await logAudit(req.admin.id, 'CustomerQuestion', id, 'update', { text })
    return res.json({
      question: {
        id: updated.id,
        text: updated.text,
        source: 'CUSTOMER',
        productId: updated.productId,
        formName: updated.formName,
        inputType: 'general',
        selectOptions: [],
      },
    })
  }

  const existing = await prisma.questionBank.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Question not found' })
  const nextInputType = normalizeQuestionInputType(req.body?.inputType ?? existing.inputType)
  const hasSelectOptions = Object.prototype.hasOwnProperty.call(req.body || {}, 'selectOptions')
  const nextSelectOptions = hasSelectOptions
    ? normalizeSelectOptions(req.body?.selectOptions)
    : parseJson(existing.selectOptions, [])
  const nextText = String(req.body?.text || '').trim()
  const data = {
    inputType: nextInputType,
    selectOptions: JSON.stringify(nextSelectOptions),
  }
  if (nextText) {
    const normalized = normalizeQuestion(nextText)
    if (!normalized) return res.status(400).json({ error: 'Invalid question text' })
    data.text = nextText
    data.normalized = normalized
  }
  const updated = await prisma.questionBank.update({
    where: { id },
    data,
  })
  await logAudit(req.admin.id, 'QuestionBank', id, 'update', {
    text: nextText || updated.text,
    inputType: nextInputType,
  })
  res.json({
    question: {
      id: updated.id,
      text: updated.text,
      source: updated.source,
      productId: updated.productId,
      inputType: updated.inputType || 'general',
      selectOptions: parseJson(updated.selectOptions, []),
    },
  })
})

module.exports = router


