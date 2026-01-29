const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const crypto = require('crypto')
const { sendEmail } = require('../utils/emailClient')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')
const { logClientAudit } = require('../utils/auditLog')

const router = express.Router()

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const ip = raw || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || ''
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '')
}

const DEFAULT_NOTIFICATION_PREFS = {
  email: 'all',
  inapp: true,
  loginAlerts: true,
  groups: {
    messages: true,
    passport: true,
    system: true,
  },
}

const normalizeNotificationPrefs = (value = {}) => {
  const prefs = value && typeof value === 'object' ? value : {}
  const groups = prefs.groups && typeof prefs.groups === 'object' ? prefs.groups : {}
  const email = ['all', 'important', 'none'].includes(prefs.email) ? prefs.email : 'all'
  return {
    email,
    inapp: typeof prefs.inapp === 'boolean' ? prefs.inapp : true,
    loginAlerts: true,
    groups: {
      messages: typeof groups.messages === 'boolean' ? groups.messages : true,
      passport: typeof groups.passport === 'boolean' ? groups.passport : true,
      system: typeof groups.system === 'boolean' ? groups.system : true,
    },
  }
}

const buildNotificationHash = (prefs) =>
  crypto.createHash('sha256').update(JSON.stringify(prefs)).digest('hex')

const buildFullName = (first, middle, last) => [first, middle, last].filter(Boolean).join(' ').trim()

const parseAuditDiff = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

const COOKIE_PREF_OPTIONS = ['all', 'essential', 'none']
const normalizeCookiePreference = (value) => {
  const normalized = String(value || '').toLowerCase()
  return COOKIE_PREF_OPTIONS.includes(normalized) ? normalized : 'all'
}

const buildCookiePrefEmail = (timestamp) => ({
  text:
    `Your cookie preferences were updated.\n\n` +
    `Some features that rely on cookies may not work as expected.\n\n` +
    `Updated: ${timestamp}\n\n` +
    `If this was not you, contact us at privacy@connsura.com.`,
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Cookie preferences updated</h2>
      <p style="margin: 0 0 12px 0;">Your cookie preferences were updated.</p>
      <p style="margin: 0 0 12px 0;">Some features that rely on cookies may not work as expected.</p>
      <p style="margin: 0 0 12px 0;"><strong>Updated:</strong> ${timestamp}</p>
      <p style="margin: 0;">If this was not you, contact us at privacy@connsura.com.</p>
    </div>
  `,
})

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'customers')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    const customerId = req.params.id || 'customer'
    cb(null, `customer-${customerId}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'))
    }
    return cb(null, true)
  },
})

const handlePhotoUpload = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    return next()
  })
}

const formatCustomerProfile = (customer) => ({
  id: customer.id,
  name: customer.name,
  preferredLangs: parseJson(customer.preferredLangs, []),
  coverages: parseJson(customer.coverages, []),
  priorInsurance: parseJson(customer.priorInsurance, []),
  drivers: customer.drivers || [],
  vehicles: customer.vehicles || [],
  profileData: parseJson(customer.profileData, {}),
  isDisabled: customer.isDisabled,
})

const formatSavedAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  photo: agent.photo,
  email: agent.user?.email,
  languages: parseJson(agent.languages, []),
  states: parseJson(agent.states, []),
  products: parseJson(agent.products, []),
  specialty: agent.specialty,
  availability: agent.availability,
  rating: agent.rating,
})

const getSavedAgentIds = (customer) => {
  const profileData = parseJson(customer.profileData, {})
  const savedAgents = Array.isArray(profileData.savedAgents) ? profileData.savedAgents : []
  return savedAgents.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
}

router.get('/:id/profile', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json({ profile: formatCustomerProfile(customer) })
})

router.post('/:id/photo', authGuard, handlePhotoUpload, async (req, res) => {
  const customerId = Number(req.params.id)
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer || customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' })
  }
  const photoPath = `/uploads/customers/${req.file.filename}`
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, photo: photoPath }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_PROFILE_PICTURE_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ profile: formatCustomerProfile(updated), photo: photoPath })
})

router.post('/:id/photo/remove', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer || customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, photo: '' }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_PROFILE_PICTURE_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
    removed: true,
  })
  res.json({ profile: formatCustomerProfile(updated), photo: '' })
})

router.post('/:id/profile', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const {
    name,
    preferredLangs = [],
    coverages = [],
    priorInsurance = [],
    drivers = [],
    vehicles = [],
    profileData = {},
  } = req.body
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const currentProfileData = parseJson(customer.profileData, {})
  const mergedProfileData = { ...currentProfileData, ...profileData }

  await prisma.driver.deleteMany({ where: { customerId } })
  await prisma.vehicle.deleteMany({ where: { customerId } })

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: name ?? customer.name,
      preferredLangs: JSON.stringify(preferredLangs),
      coverages: JSON.stringify(coverages),
      priorInsurance: JSON.stringify(priorInsurance),
      profileData: JSON.stringify(mergedProfileData),
      drivers: {
        create: drivers.map((driver) => ({
          name: driver.name,
          licenseNo: driver.licenseNo,
          birthDate: new Date(driver.birthDate || new Date()),
          relationship: driver.relationship || 'Self',
        })),
      },
      vehicles: {
        create: vehicles.map((v) => ({
          year: v.year || 2020,
          make: v.make || 'Unknown',
          model: v.model || 'Vehicle',
          vin: v.vin || `VIN-${Date.now()}`,
          primaryUse: v.primaryUse || 'Commute',
        })),
      },
    },
    include: { drivers: true, vehicles: true },
  })
  res.status(201).json({ profile: formatCustomerProfile(updated) })
})

router.patch('/:id/profile-data', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const updates = req.body?.profileData || {}
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, ...updates }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      profileData: JSON.stringify(updatedProfileData),
    },
    include: { drivers: true, vehicles: true },
  })
  res.json({ profile: formatCustomerProfile(updated) })
})

router.patch('/:id/name', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const firstName = String(req.body?.firstName || '').trim()
  const middleName = String(req.body?.middleName || '').trim()
  const lastName = String(req.body?.lastName || '').trim()
  const fullName = buildFullName(firstName, middleName, lastName)
  if (!fullName) {
    return res.status(400).json({ error: 'Name is required' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, firstName, middleName, lastName }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: fullName,
      profileData: JSON.stringify(updatedProfileData),
    },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_NAME_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ profile: formatCustomerProfile(updated) })
})

router.patch('/:id/preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const language = req.body?.language ? String(req.body.language).trim() : ''
  const timezone = req.body?.timezone ? String(req.body.timezone).trim() : ''
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = {
    ...currentProfileData,
    language: language || currentProfileData.language || null,
    timezone: timezone || currentProfileData.timezone || null,
  }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_PREFERENCES_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ profile: formatCustomerProfile(updated) })
})

router.post('/:id/forms/start', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }

  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = {
    ...currentProfileData,
    profile_status: 'draft',
    current_section: 'Household Information',
    forms_started: true,
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })

  await logClientAudit(customerId, 'CLIENT_ONBOARDING_CTA_CLICKED')
  await logClientAudit(customerId, 'CLIENT_FORMS_FLOW_STARTED', { current_section: 'Household Information' })

  res.json({ profile: formatCustomerProfile(updated) })
})

router.post('/:id/forms/section-save', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }

  const section = req.body?.section || ''
  const nextSection = req.body?.nextSection || ''

  const logClick = req.body?.logClick !== false
  if (logClick) {
    await logClientAudit(customerId, 'CLIENT_FORMS_SAVE_CONTINUE_CLICKED', {
      section,
    })
  }

  const currentProfileData = parseJson(customer.profileData, {})
  const incomingProfileData = req.body?.profileData || {}
  const requestedStatus = req.body?.profileStatus || incomingProfileData.profile_status
  const nextProfileStatus = requestedStatus || currentProfileData.profile_status || 'draft'
  const updatedProfileData = {
    ...currentProfileData,
    ...incomingProfileData,
    profile_status: nextProfileStatus,
    current_section: nextSection || currentProfileData.current_section,
    forms_started: true,
  }

  try {
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { profileData: JSON.stringify(updatedProfileData) },
      include: { drivers: true, vehicles: true },
    })
    await logClientAudit(customerId, 'CLIENT_FORM_SECTION_SAVED', {
      section,
      result: 'SUCCESS',
    })
    if (nextSection === 'Summary') {
      await logClientAudit(customerId, 'CLIENT_PROFILE_SUMMARY_VIEWED')
      if (currentProfileData.profile_status !== 'completed' && nextProfileStatus === 'completed') {
        await logClientAudit(customerId, 'CLIENT_PROFILE_COMPLETED')
      }
    }
    return res.json({ profile: formatCustomerProfile(updated) })
  } catch (error) {
    await logClientAudit(customerId, 'CLIENT_FORM_SECTION_SAVED', {
      section,
      result: 'FAILED',
    })
    return res.status(500).json({ error: 'Failed to save profile section' })
  }
})

router.post('/:id/agent-search/click', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  await logClientAudit(customerId, 'CLIENT_TALK_TO_AGENT_CLICKED')
  res.json({ ok: true })
})

router.post('/:id/agent-search/view', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = {
    ...currentProfileData,
    agent_search_viewed: true,
  }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_AGENT_SEARCH_PAGE_VIEWED')
  res.json({ profile: formatCustomerProfile(updated) })
})

router.post('/:id/agent-profile/view', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const agentId = Number(req.body?.agentId)
  if (!customerId || !agentId) return res.status(400).json({ error: 'Customer id and agent id are required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  await logClientAudit(customerId, 'CLIENT_AGENT_PROFILE_VIEWED', {
    agentId,
    source: req.body?.source || null,
  })
  res.json({ ok: true })
})

router.post('/:id/tab-view', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const tabName = String(req.body?.tabName || '').trim()
  if (!customerId || !tabName) return res.status(400).json({ error: 'Customer id and tab name are required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const profileStatus = req.body?.profileStatus ? String(req.body.profileStatus) : null
  const currentSection = req.body?.currentSection ? String(req.body.currentSection) : null
  const savedAgentsCount = Number.isFinite(Number(req.body?.savedAgentsCount))
    ? Number(req.body.savedAgentsCount)
    : null

  await logClientAudit(customerId, 'CLIENT_TAB_VIEWED', {
    tab_name: tabName,
    session_id: sessionId,
    profile_status: profileStatus,
    current_section: currentSection,
    saved_agents_count: savedAgentsCount,
  })
  if (tabName.toLowerCase() === 'my insurance passport') {
    await logClientAudit(customerId, 'CLIENT_INSURANCE_PASSPORT_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
      profile_status: profileStatus,
      current_section: currentSection,
    })
  }
  if (tabName.toLowerCase() === 'forms') {
    await logClientAudit(customerId, 'CLIENT_FORMS_TAB_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
      profile_status: profileStatus,
      current_section: currentSection,
    })
  }
  if (tabName.toLowerCase() === 'messages') {
    await logClientAudit(customerId, 'CLIENT_MESSAGES_TAB_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
    })
  }
  if (tabName.toLowerCase() === 'settings') {
    await logClientAudit(customerId, 'CLIENT_SETTINGS_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
    })
  }
  if (tabName.toLowerCase() === 'agents') {
    await logClientAudit(customerId, 'CLIENT_AGENTS_TAB_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
      saved_agents_count: savedAgentsCount,
    })
  }
  res.json({ ok: true })
})

router.get('/:id/notification-preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const profileData = parseJson(customer.profileData, {})
  const prefs = normalizeNotificationPrefs(profileData.notification_prefs || {})
  const hash = buildNotificationHash(prefs)
  const sessionId = req.query?.sessionId ? String(req.query.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_NOTIFICATION_PREFERENCES_VIEWED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    new_preferences_hash: hash,
  })
  res.json({ preferences: prefs })
})

router.put('/:id/notification-preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const profileData = parseJson(customer.profileData, {})
  const previousPrefs = normalizeNotificationPrefs(profileData.notification_prefs || {})
  const nextPrefs = normalizeNotificationPrefs(req.body?.preferences || {})
  const previousHash = buildNotificationHash(previousPrefs)
  const newHash = buildNotificationHash(nextPrefs)
  const channelChanged = []
  if (previousPrefs.email !== nextPrefs.email) channelChanged.push('email')
  if (previousPrefs.inapp !== nextPrefs.inapp) channelChanged.push('inapp')
  if (previousPrefs.loginAlerts !== nextPrefs.loginAlerts) channelChanged.push('login_alerts')
  const groupsChanged =
    previousPrefs.groups.messages !== nextPrefs.groups.messages ||
    previousPrefs.groups.passport !== nextPrefs.groups.passport ||
    previousPrefs.groups.system !== nextPrefs.groups.system
  if (groupsChanged && !channelChanged.includes('inapp')) {
    channelChanged.push('inapp')
  }

  const updatedProfileData = { ...profileData, notification_prefs: nextPrefs }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
  })
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_NOTIFICATION_PREFERENCES_UPDATED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    previous_preferences_hash: previousHash,
    new_preferences_hash: newHash,
    channel_changed: channelChanged,
  })
  res.json({
    preferences: normalizeNotificationPrefs(parseJson(updated.profileData, {}).notification_prefs || nextPrefs),
  })
})

router.put('/:id/cookie-preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const nextPref = normalizeCookiePreference(req.body?.preference)
  const profileData = parseJson(customer.profileData, {})
  const previousPref = normalizeCookiePreference(profileData.cookie_preference)
  if (previousPref === nextPref) {
    return res.json({ preference: previousPref, unchanged: true })
  }
  const updatedAt = new Date()
  const updatedProfileData = {
    ...profileData,
    cookie_preference: nextPref,
    cookie_pref_updated_at: updatedAt.toISOString(),
  }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { user: true },
  })
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_COOKIE_PREFERENCES_UPDATED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    previous_cookie_pref: previousPref,
    new_cookie_pref: nextPref,
  })
  const timestamp = updatedAt.toLocaleString()
  let emailDelivery = 'disabled'
  try {
    const content = buildCookiePrefEmail(timestamp)
    const emailResult = await sendEmail({
      to: updated.user?.email || customer.user?.email,
      subject: 'Your cookie preferences were updated',
      text: content.text,
      html: content.html,
      replyTo: 'privacy@connsura.com',
    })
    emailDelivery = emailResult?.delivery || 'smtp'
    await logClientAudit(customerId, 'PRIVACY_EMAIL_SENT', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
      type: 'cookie_preferences_receipt',
      result: 'success',
      delivery: emailDelivery,
    })
  } catch (err) {
    console.error('cookie pref email error', err)
    await logClientAudit(customerId, 'PRIVACY_EMAIL_SENT', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
      type: 'cookie_preferences_receipt',
      result: 'failed',
      reason: 'email_send_failed',
    })
  }
  res.json({
    preference: normalizeCookiePreference(
      parseJson(updated.profileData, {}).cookie_preference || nextPref
    ),
  })
})

router.post('/:id/inapp-notice', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const noticeType = req.body?.type ? String(req.body.type) : ''
  await logClientAudit(customerId, 'INAPP_NOTICE_SHOWN', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
    type: noticeType,
  })
  res.json({ ok: true })
})

router.post('/:id/login-alerts/view', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  await logClientAudit(customerId, 'CLIENT_LOGIN_ALERTS_VIEWED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ ok: true })
})

router.get('/:id/login-activity', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const entries = await prisma.auditLog.findMany({
    where: {
      targetType: 'Client',
      targetId: String(customerId),
      action: 'CLIENT_LOGIN_SUCCESS',
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  await logClientAudit(customerId, 'CLIENT_LOGIN_ACTIVITY_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  const activity = entries.map((entry) => {
    const diff = parseAuditDiff(entry.diff)
    return {
      id: entry.id,
      ip: diff.ip || '',
      userAgent: diff.user_agent || '',
      timestamp: entry.createdAt,
    }
  })
  res.json({ activity })
})

router.get('/:id/active-sessions', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  await logClientAudit(customerId, 'CLIENT_ACTIVE_SESSIONS_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({
    sessions: [
      {
        id: req.query?.sessionId ? String(req.query.sessionId) : 'current',
        current: true,
        ip: getRequestIp(req),
        userAgent: String(req.headers['user-agent'] || ''),
        lastSeenAt: new Date().toISOString(),
      },
    ],
  })
})

router.get('/:id/shared-profile-activity', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const shares = await prisma.profileShare.findMany({
    where: { customerId },
    include: { agent: true },
    orderBy: { updatedAt: 'desc' },
  })
  await logClientAudit(customerId, 'CLIENT_SHARED_PROFILE_ACTIVITY_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  const activity = shares.map((share) => ({
    id: share.id,
    recipient: share.agent?.name || share.recipientName || 'Shared link',
    status: share.status,
    lastAccessedAt: share.lastAccessedAt,
  }))
  res.json({ activity })
})

router.get('/:id/consent-history', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const consents = await prisma.userConsent.findMany({
    where: { userId: customer.userId },
    orderBy: { consentedAt: 'desc' },
  })
  await logClientAudit(customerId, 'CLIENT_CONSENT_HISTORY_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({
    consents: consents.map((row) => ({
      id: row.id,
      documentType: row.documentType,
      version: row.version,
      role: row.role,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      consentedAt: row.consentedAt,
      consentItems: row.consentItems ? parseJson(row.consentItems, null) : null,
    })),
  })
})

router.post('/:id/delete-account/click', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_DELETE_ACCOUNT_CLICKED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
  })
  res.json({ ok: true })
})

router.post('/:id/2fa/disable-click', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_2FA_DISABLE_STARTED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    result: 'started',
  })
  res.json({ ok: true })
})

router.post('/:id/forms/additional/remove', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const formName = req.body?.formName || ''
  await logClientAudit(customerId, 'CLIENT_ADDITIONAL_FORM_REMOVED', {
    formName,
  })
  res.json({ ok: true })
})

router.get('/:id/saved-agents', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }

  const savedIds = getSavedAgentIds(customer)
  if (!savedIds.length) return res.json({ agents: [] })

  const agents = await prisma.agent.findMany({
    where: { id: { in: savedIds } },
    include: { user: true },
  })
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]))
  const ordered = savedIds.map((id) => agentMap.get(id)).filter(Boolean)
  res.json({ agents: ordered.map(formatSavedAgent) })
})

router.post('/:id/saved-agents', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const agentId = Number(req.body?.agentId)
  if (!customerId || !agentId) return res.status(400).json({ error: 'Customer id and agent id are required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }

  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) {
    await logClientAudit(customerId, 'CLIENT_AGENT_SAVED_FAILED', { agentId, reason: 'agent_not_found' })
    return res.status(404).json({ error: 'Agent not found' })
  }

  await logClientAudit(customerId, 'CLIENT_AGENT_SAVED', { agentId })

  const savedIds = getSavedAgentIds(customer)
  const alreadySaved = savedIds.includes(agentId)
  const nextSaved = alreadySaved ? savedIds : [...savedIds, agentId]
  const profileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...profileData, savedAgents: nextSaved }

  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: { profileData: JSON.stringify(updatedProfileData) },
    })
    await logClientAudit(customerId, 'CLIENT_AGENT_SAVED_SUCCESS', { agentId, alreadySaved })
    res.status(201).json({ savedAgents: nextSaved })
  } catch (error) {
    await logClientAudit(customerId, 'CLIENT_AGENT_SAVED_FAILED', {
      agentId,
      reason: 'update_failed',
      message: error?.message,
    })
    res.status(500).json({ error: 'Failed to save agent' })
  }
})

router.delete('/:id/saved-agents/:agentId', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const agentId = Number(req.params.agentId)
  if (!customerId || !agentId) return res.status(400).json({ error: 'Customer id and agent id are required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }

  const savedIds = getSavedAgentIds(customer)
  const nextSaved = savedIds.filter((id) => id !== agentId)
  const profileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...profileData, savedAgents: nextSaved }

  await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
  })

  res.json({ savedAgents: nextSaved })
})

module.exports = router
