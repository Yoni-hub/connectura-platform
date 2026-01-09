const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')
const { lookupAgentOnScc } = require('../utils/sccLookup')
const { getAgentRecordByNpn } = require('../utils/sccPlaywright')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const router = express.Router()

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'agents')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    const agentId = req.params.id || 'agent'
    cb(null, `agent-${agentId}-${Date.now()}${ext}`)
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

const formatAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  bio: agent.bio,
  photo: agent.photo,
  email: agent.user?.email,
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

router.get('/', async (req, res) => {
  const { language, state, name, location } = req.query
  const agents = await prisma.agent.findMany()
  const filtered = agents.filter((agent) => {
    const langs = parseJson(agent.languages, [])
    const statesList = parseJson(agent.states, [])
    const matchLang = language ? langs.some((l) => l.toLowerCase() === language.toLowerCase()) : true
    const matchState = state ? statesList.some((s) => s.toLowerCase() === state.toLowerCase()) : true
    const matchName = name ? agent.name.toLowerCase().includes(name.toLowerCase()) : true
    const matchLocation = location
      ? (agent.address && agent.address.toLowerCase().includes(location.toLowerCase())) ||
        (agent.zip && agent.zip.toLowerCase().includes(location.toLowerCase()))
      : true
    return matchLang && matchState && matchName && matchLocation
  })
  res.json({ agents: filtered.map(formatAgent) })
})

router.get('/:id', async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: Number(req.params.id) }, include: { user: true } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  res.json({ agent: formatAgent(agent) })
})

router.post('/:id/reviews', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (!agentId) return res.status(400).json({ error: 'Invalid agent id' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Only customers can rate agents' })

  const ratingValue = Number(req.body?.rating)
  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' })
  }

  const comment = String(req.body?.comment || '').trim()
  const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
  if (!customer) return res.status(404).json({ error: 'Customer profile not found' })

  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })

  const existing = parseJson(agent.reviews, [])
  const reviews = Array.isArray(existing) ? existing : []
  const reviewEntry = {
    id: crypto.randomUUID(),
    rating: ratingValue,
    comment,
    author: customer.name || req.user.email,
    customerId: customer.id,
    createdAt: new Date().toISOString(),
  }
  const updatedReviews = [reviewEntry, ...reviews].slice(0, 50)
  const average =
    updatedReviews.length === 0
      ? 0
      : Math.round((updatedReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / updatedReviews.length) * 10) /
        10

  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: {
      reviews: JSON.stringify(updatedReviews),
      rating: average,
    },
    include: { user: true },
  })

  res.json({ agent: formatAgent(updated) })
})

router.post('/:id/photo', authGuard, handlePhotoUpload, async (req, res) => {
  const agentId = Number(req.params.id)
  if (req.user.role !== 'AGENT') return res.status(403).json({ error: 'Forbidden' })
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
  if (!agent || agent.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this agent' })
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' })
  }
  const photoPath = `/uploads/agents/${req.file.filename}`
  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: { photo: photoPath },
    include: { user: true },
  })
  res.json({ agent: formatAgent(updated), photo: photoPath })
})

router.put('/:id', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (req.user.role !== 'AGENT') return res.status(403).json({ error: 'Forbidden' })
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
  if (!agent || agent.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this agent' })
  }
  const {
    name,
    email,
    phone,
    bio,
    languages,
    states,
    specialty,
    availability,
    producerNumber,
    address,
    zip,
    products,
    appointedCarriers,
  } = req.body

  try {
    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: {
        name: name ?? agent.name,
        phone: phone ?? agent.phone,
        bio: bio ?? agent.bio,
        languages: languages ? JSON.stringify(languages) : agent.languages,
        states: states ? JSON.stringify(states) : agent.states,
        specialty: specialty ?? agent.specialty,
        availability: availability ?? agent.availability,
        producerNumber: producerNumber ?? agent.producerNumber,
        address: address ?? agent.address,
        zip: zip ?? agent.zip,
        products: products ? JSON.stringify(products) : agent.products,
        appointedCarriers: appointedCarriers ? JSON.stringify(appointedCarriers) : agent.appointedCarriers,
      },
      include: { user: true },
    })

    if (email && email !== agent.user?.email) {
      await prisma.user.update({ where: { id: agent.userId }, data: { email } })
      updated.user.email = email
    }

    res.json({ agent: formatAgent(updated) })
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Email already in use' })
    console.error('agent update error', err)
    res.status(500).json({ error: 'Failed to update agent' })
  }
})

router.post('/:id/license-lookup', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (req.user.role !== 'AGENT') return res.status(403).json({ error: 'Forbidden' })
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
  if (!agent || agent.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot lookup for this agent' })
  }

  const { firstName, lastName, zip, state, npn, licenseNumber } = req.body || {}
  if (!npn && !licenseNumber) return res.status(400).json({ error: 'NPN is required for lookup' })

  try {
    const licenseValue = licenseNumber || npn || agent.producerNumber || ''
    const npnValue = npn || licenseValue
    const lookup = await lookupAgentOnScc({
      firstName: firstName || '',
      lastName: lastName || '',
      zip: zip || '',
      state: state || '',
      npn: npnValue,
      licenseNumber: licenseValue,
    })
    res.json({ results: lookup.results, detail: lookup.detail })
  } catch (err) {
    console.error('license lookup error', err)
    res.status(500).json({ error: 'License lookup failed' })
  }
})

router.post('/:id/license-decision', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (req.user.role !== 'AGENT') return res.status(403).json({ error: 'Forbidden' })
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
  if (!agent || agent.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot update this agent' })
  }
  const { decision } = req.body || {}
  if (!['approve', 'review'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' })

  const data =
    decision === 'approve'
      ? { status: 'approved', underReview: false, isSuspended: false }
      : { status: 'pending', underReview: true }

  const updated = await prisma.agent.update({
    where: { id: agentId },
    data,
    include: { user: true },
  })

  res.json({ agent: formatAgent(updated) })
})

router.post('/scc-search', async (req, res) => {
  try {
    const {
      firstName = '',
      lastName = '',
      lastNameMode = 'starts',
      zip = '',
      state = '',
      npn = '',
      licenseNumber = '',
      activeOnly = true,
      city = '',
      insuranceType = '',
      licenseType = '',
    } = req.body || {}

    const lookup = await lookupAgentOnScc({
      firstName,
      lastName,
      lastNameMode,
      zip,
      state,
      npn,
      licenseNumber,
      activeOnly,
      city,
      insuranceType,
      licenseType,
    })
    res.json({ results: lookup.results, detail: lookup.detail })
  } catch (err) {
    console.error('scc search error', err)
    res.status(500).json({ error: 'SCC search failed' })
  }
})

router.post('/scc-npn', async (req, res) => {
  try {
    const npn = String(req.body?.npn || '').trim()
    if (!npn) return res.status(400).json({ error: 'NPN is required' })
    const result = await getAgentRecordByNpn(npn)
    if (result.needs_human_verification) {
      return res.status(503).json({ error: 'Needs human verification', needs_human_verification: true })
    }
    if (!result.found) {
      return res.status(404).json({ error: 'No results found for NPN', result })
    }
    res.json(result)
  } catch (err) {
    console.error('scc npn search error', err)
    res.status(500).json({ error: 'SCC NPN search failed' })
  }
})

router.post('/request', async (req, res) => {
  const { email, firstName, lastName, npn } = req.body || {}
  if (!email || !firstName || !lastName || !npn) {
    return res.status(400).json({ error: 'Email, first name, last name, and NPN are required.' })
  }
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return res.status(400).json({ error: 'Email already in use.' })

    const existingAgent = await prisma.agent.findFirst({ where: { producerNumber: npn } })
    if (existingAgent) return res.status(400).json({ error: 'An agent request already exists for this NPN.' })

    const password = crypto.randomBytes(12).toString('hex')
    const hashed = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: 'AGENT',
      },
    })

    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: `${firstName} ${lastName}`.trim(),
        bio: 'Pending approval.',
        photo: '',
        languages: '[]',
        states: '[]',
        specialty: '',
        producerNumber: npn,
        address: '',
        zip: '',
        phone: '',
        products: '[]',
        status: 'pending',
        isSuspended: false,
        underReview: true,
        availability: 'offline',
        rating: 0,
        reviews: '[]',
      },
      include: { user: true },
    })

    console.log('New agent request received', { email, npn, agentId: agent.id })

    res.status(201).json({
      message: 'Request received. We will notify you when approved.',
      agent: {
        id: agent.id,
        email,
        name: agent.name,
        status: agent.status,
        underReview: agent.underReview,
      },
    })
  } catch (err) {
    console.error('agent request error', err)
    res.status(500).json({ error: 'Could not submit request.' })
  }
})

router.post('/request-status', async (req, res) => {
  const { npn } = req.body || {}
  if (!npn) return res.status(400).json({ error: 'NPN is required' })
  try {
    const agent = await prisma.agent.findFirst({ where: { producerNumber: npn } })
    if (!agent) return res.status(404).json({ error: 'No request found for this NPN', found: false })
    const approved = agent.status === 'approved' && !agent.isSuspended
    res.json({
      found: true,
      status: agent.status,
      underReview: agent.underReview,
      isSuspended: agent.isSuspended,
      approved,
    })
  } catch (err) {
    console.error('agent status check error', err)
    res.status(500).json({ error: 'Status lookup failed' })
  }
})

module.exports = router
