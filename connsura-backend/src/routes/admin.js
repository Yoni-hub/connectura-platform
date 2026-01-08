const express = require('express')
const bcrypt = require('bcrypt')
const prisma = require('../prisma')
const { adminGuard } = require('../middleware/auth')
const { generateToken } = require('../utils/token')
const { parseJson } = require('../utils/transform')
const { getEmailOtp } = require('../utils/emailOtp')
const { SITE_CONTENT_DEFAULTS, sanitizeContent, checkComplianceWarnings } = require('../utils/siteContent')

const router = express.Router()

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
  const token = generateToken({ adminId: admin.id, role: admin.role, type: 'ADMIN' })
  res.json({ token, admin: { id: admin.id, email: admin.email, role: admin.role } })
})

router.get('/email-otp', adminGuard, (req, res) => {
  const email = String(req.query?.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email is required' })
  const otp = getEmailOtp(email)
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

module.exports = router
