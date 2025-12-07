const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')

const router = express.Router()

const formatAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  bio: agent.bio,
  photo: agent.photo,
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
})

router.get('/', async (req, res) => {
  const { language, state, name } = req.query
  const agents = await prisma.agent.findMany()
  const filtered = agents.filter((agent) => {
    const langs = parseJson(agent.languages, [])
    const statesList = parseJson(agent.states, [])
    const matchLang = language ? langs.some((l) => l.toLowerCase() === language.toLowerCase()) : true
    const matchState = state ? statesList.some((s) => s.toLowerCase() === state.toLowerCase()) : true
    const matchName = name ? agent.name.toLowerCase().includes(name.toLowerCase()) : true
    return matchLang && matchState && matchName
  })
  res.json({ agents: filtered.map(formatAgent) })
})

router.get('/:id', async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: Number(req.params.id) } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  res.json({ agent: formatAgent(agent) })
})

router.put('/:id', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (req.user.role !== 'AGENT') return res.status(403).json({ error: 'Forbidden' })
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent || agent.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this agent' })
  }
  const { bio, languages, states, specialty, availability, producerNumber, address, zip, products } = req.body
  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: {
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
  })
  res.json({ agent: formatAgent(updated) })
})

module.exports = router
