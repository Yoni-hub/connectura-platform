const express = require('express')
const bcrypt = require('bcrypt')
const prisma = require('../prisma')
const { adminGuard, ADMIN_AUTH_COOKIE } = require('../middleware/auth')
const { generateToken } = require('../utils/token')
const { parseJson } = require('../utils/transform')
const { getEmailOtp } = require('../utils/emailOtp')
const { SITE_CONTENT_DEFAULTS, sanitizeContent, checkComplianceWarnings } = require('../utils/siteContent')
const { DEFAULT_CREATE_PROFILE_SCHEMA } = require('../utils/formSchema')
const { slugify, ensureProductCatalog } = require('../utils/productCatalog')
const { buildQuestionRecords, normalizeQuestion } = require('../utils/questionBank')

const router = express.Router()

const ADMIN_JWT_EXPIRY = process.env.ADMIN_JWT_EXPIRY || '2h'

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

const formatAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  bio: agent.bio,
  photo: agent.photo,
  email: agent.user?.email,
  userPassword: agent.user?.password,
  phone: agent.phone,
  languages: parseJson(agent.languages, []),
  states: parseJson(agent.states, []),
  specialty: agent.specialty,
  producerNumber: agent.producerNumber,
  address: agent.address,
  zip: agent.zip,
  products: parseJson(agent.products, []),
  appointedCarriers: parseJson(agent.appointedCarriers, []),
  availability: agent.availability,
  rating: agent.rating,
  reviews: parseJson(agent.reviews, []),
  status: agent.status,
  isSuspended: agent.isSuspended,
  underReview: agent.underReview,
})

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

// Agents
router.get('/agents', adminGuard, async (req, res) => {
  const agents = await prisma.agent.findMany({ include: { user: true } })
  res.json({ agents: agents.map(formatAgent) })
})

router.get('/agents/:id', adminGuard, async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: Number(req.params.id) }, include: { user: true } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  res.json({ agent: formatAgent(agent) })
})

router.post('/agents/:id/approve', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const agent = await prisma.agent.update({
    where: { id },
    data: { status: 'approved', underReview: false, isSuspended: false },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Agent', id, 'approve')
  res.json({ agent: formatAgent(agent) })
})

router.post('/agents/:id/reject', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const agent = await prisma.agent.update({
    where: { id },
    data: { status: 'rejected', underReview: false },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Agent', id, 'reject')
  res.json({ agent: formatAgent(agent) })
})

router.post('/agents/:id/suspend', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const agent = await prisma.agent.update({
    where: { id },
    data: { isSuspended: true, status: 'suspended' },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Agent', id, 'suspend')
  res.json({ agent: formatAgent(agent) })
})

router.post('/agents/:id/restore', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const agent = await prisma.agent.update({
    where: { id },
    data: { isSuspended: false, status: 'approved', underReview: false },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Agent', id, 'restore')
  res.json({ agent: formatAgent(agent) })
})

router.post('/agents/:id/review', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const agent = await prisma.agent.update({
    where: { id },
    data: { underReview: true, status: 'pending' },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Agent', id, 'mark_under_review')
  res.json({ agent: formatAgent(agent) })
})

router.put('/agents/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const payload = req.body || {}
  const data = {}
  const userUpdates = {}
  if (payload.email !== undefined) userUpdates.email = payload.email
  if (payload.password !== undefined) userUpdates.password = await bcrypt.hash(payload.password, 10)
  if (payload.name !== undefined) data.name = payload.name
  if (payload.bio !== undefined) data.bio = payload.bio
  if (payload.phone !== undefined) data.phone = payload.phone
  if (payload.address !== undefined) data.address = payload.address
  if (payload.zip !== undefined) data.zip = payload.zip
  if (payload.availability !== undefined) data.availability = payload.availability
  if (payload.specialty !== undefined) data.specialty = payload.specialty
  if (payload.producerNumber !== undefined) data.producerNumber = payload.producerNumber
  if (payload.languages !== undefined) data.languages = JSON.stringify(payload.languages)
  if (payload.states !== undefined) data.states = JSON.stringify(payload.states)
  if (payload.products !== undefined) data.products = JSON.stringify(payload.products)
  if (payload.appointedCarriers !== undefined) data.appointedCarriers = JSON.stringify(payload.appointedCarriers)
  if (payload.status !== undefined) data.status = payload.status
  if (payload.underReview !== undefined) data.underReview = payload.underReview
  if (payload.isSuspended !== undefined) data.isSuspended = payload.isSuspended
  if (payload.rating !== undefined) data.rating = payload.rating

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      ...data,
      ...(Object.keys(userUpdates).length ? { user: { update: userUpdates } } : {}),
    },
    include: { user: true },
  })
  await logAudit(req.admin.id, 'Agent', id, 'update', { ...data, ...(Object.keys(userUpdates).length ? { user: userUpdates } : {}) })
  res.json({ agent: formatAgent(agent) })
})

router.delete('/agents/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const agent = await prisma.agent.findUnique({ where: { id } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  await prisma.user.delete({ where: { id: agent.userId } })
  await logAudit(req.admin.id, 'Agent', id, 'delete')
  res.json({ success: true })
})

// Customers
router.get('/clients', adminGuard, async (req, res) => {
  const customers = await prisma.customer.findMany({ include: { user: true } })
  res.json({ clients: customers.map(formatCustomer) })
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
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: true },
  })
  res.json({
    logs: logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actor?.email,
      targetType: log.targetType,
      targetId: log.targetId,
      action: log.action,
      diff: log.diff ? JSON.parse(log.diff) : null,
      createdAt: log.createdAt,
    })),
  })
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
          orderBy: { id: 'asc' },
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

  const records = buildQuestionRecords(received, 'SYSTEM', productId || null, null)
  if (!records.length) return res.status(400).json({ error: 'Invalid question text' })

  if (sync) {
    if (!productId) return res.status(400).json({ error: 'Product is required for sync' })

    const existing = await prisma.questionBank.findMany({
      where: { productId, source: 'SYSTEM' },
      orderBy: { id: 'asc' },
    })
    const existingByNormalized = new Map(existing.map((item) => [item.normalized, item]))
    const incomingNormalized = new Set(records.map((record) => record.normalized))

    const toDelete = existing.filter((item) => !incomingNormalized.has(item.normalized))
    const toCreate = records.filter((record) => !existingByNormalized.has(record.normalized))

    if (toDelete.length) {
      await prisma.questionBank.deleteMany({ where: { id: { in: toDelete.map((item) => item.id) } } })
      for (const item of toDelete) {
        await logAudit(req.admin.id, 'QuestionBank', item.id, 'delete', { productId })
      }
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
        if (err?.code !== 'P2002') {
          throw err
        }
      }
    }

    const updated = await prisma.questionBank.findMany({
      where: { productId, source: 'SYSTEM' },
      orderBy: { id: 'asc' },
    })

    return res.status(201).json({
      created: createdQuestions.length,
      deleted: toDelete.length,
      prepared: records.length,
      received: received.length,
      questions: updated.map((question) => ({
        id: question.id,
        text: question.text,
        source: question.source,
        productId: question.productId,
      })),
    })
  }

  const createdQuestions = []
  let skipped = 0
  for (const record of records) {
    try {
      const created = await prisma.questionBank.create({ data: record })
      createdQuestions.push(created)
      await logAudit(req.admin.id, 'QuestionBank', created.id, 'create', {
        productId: created.productId,
      })
    } catch (err) {
      if (err?.code === 'P2002') {
        skipped += 1
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
    questions: createdQuestions.map((question) => ({
      id: question.id,
      text: question.text,
      source: question.source,
      productId: question.productId,
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
    await prisma.questionBank.delete({ where: { id } })
    await logAudit(req.admin.id, 'QuestionBank', id, 'delete')
  }
  res.json({ ok: true })
})

router.put('/questions/:id', adminGuard, async (req, res) => {
  const id = Number(req.params.id)
  const text = String(req.body?.text || '').trim()
  if (!id) return res.status(400).json({ error: 'Question id required' })
  if (!text) return res.status(400).json({ error: 'Question text is required' })
  const source = String(req.body?.source || req.query.source || '').toUpperCase()
  if (source === 'CUSTOMER') {
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
      },
    })
  }

  const existing = await prisma.questionBank.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Question not found' })
  if (existing.source !== 'CUSTOMER') {
    return res.status(400).json({ error: 'Only customer questions can be edited' })
  }
  const normalized = normalizeQuestion(text)
  if (!normalized) return res.status(400).json({ error: 'Invalid question text' })
  const updated = await prisma.questionBank.update({
    where: { id },
    data: {
      text,
      normalized,
    },
  })
  await logAudit(req.admin.id, 'QuestionBank', id, 'update', { text })
  res.json({
    question: {
      id: updated.id,
      text: updated.text,
      source: updated.source,
      productId: updated.productId,
    },
  })
})

module.exports = router
