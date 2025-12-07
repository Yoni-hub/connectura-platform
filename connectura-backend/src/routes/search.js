const express = require('express')
const prisma = require('../prisma')
const { parseJson } = require('../utils/transform')

const router = express.Router()

const formatAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  bio: agent.bio,
  languages: parseJson(agent.languages, []),
  states: parseJson(agent.states, []),
  specialty: agent.specialty,
  availability: agent.availability,
  rating: agent.rating,
  reviews: parseJson(agent.reviews, []),
  photo: agent.photo,
})

router.get('/agents', async (req, res) => {
  const { state, language, name } = req.query
  const agents = await prisma.agent.findMany()
  const filtered = agents.filter((agent) => {
    const langs = parseJson(agent.languages, [])
    const statesList = parseJson(agent.states, [])
    const matchState = state ? statesList.some((s) => s.toLowerCase().includes(state.toLowerCase())) : true
    const matchLang = language ? langs.some((l) => l.toLowerCase().includes(language.toLowerCase())) : true
    const matchName = name ? agent.name.toLowerCase().includes(name.toLowerCase()) : true
    return matchState && matchLang && matchName
  })
  res.json({ agents: filtered.map(formatAgent) })
})

module.exports = router
