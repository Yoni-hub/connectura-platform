const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')
const { lookupAgentOnScc } = require('../utils/sccLookup')

const router = express.Router()

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

router.put('/:id', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (req.user.role !== 'AGENT') return res.status(403).json({ error: 'Forbidden' })
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
  if (!agent || agent.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this agent' })
  }
  const { name, email, phone, bio, languages, states, specialty, availability, producerNumber, address, zip, products } =
    req.body

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

module.exports = router
