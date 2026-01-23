const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')
const { logClientAudit } = require('../utils/auditLog')

const router = express.Router()

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
  res.json({ profile: formatCustomerProfile(updated), photo: photoPath })
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
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const savedIds = getSavedAgentIds(customer)
  const nextSaved = savedIds.includes(agentId) ? savedIds : [...savedIds, agentId]
  const profileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...profileData, savedAgents: nextSaved }

  await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
  })

  res.status(201).json({ savedAgents: nextSaved })
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
