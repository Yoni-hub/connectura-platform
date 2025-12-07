const express = require('express')
const bcrypt = require('bcrypt')
const prisma = require('../prisma')
const { generateToken } = require('../utils/token')
const { authGuard } = require('../middleware/auth')

const router = express.Router()

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  agentId: user.agent?.id,
  customerId: user.customer?.id,
})

router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      role = 'CUSTOMER',
      name,
      languages = [],
      states = [],
      specialty = 'Auto',
      producerNumber = '',
      address = '',
      zip = '',
      products = [],
    } = req.body
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' })
    }
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role,
        agent:
          role === 'AGENT'
            ? {
                create: {
                  name,
                  bio: 'New agent on Connectura.',
                  languages: JSON.stringify(languages),
                  states: JSON.stringify(states),
                  specialty: specialty || (products[0] || 'Auto'),
                  producerNumber,
                  address,
                  zip,
                  products: JSON.stringify(products),
                  availability: 'online',
                  rating: 4.5,
                  reviews: JSON.stringify([]),
                  photo: '/uploads/agents/agent1.svg',
                },
              }
            : undefined,
        customer:
          role === 'CUSTOMER'
            ? {
                create: {
                  name,
                  preferredLangs: JSON.stringify(languages),
                  priorInsurance: JSON.stringify([]),
                  coverages: JSON.stringify([]),
                  sharedWithAgent: false,
                },
              }
            : undefined,
      },
      include: { agent: true, customer: true },
    })
    const token = generateToken({ id: user.id, role: user.role })
    return res.status(201).json({ token, user: sanitizeUser(user) })
  } catch (err) {
    console.error('register error', err)
    res.status(500).json({ error: 'Failed to register' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { agent: true, customer: true },
    })
    if (!user) return res.status(400).json({ error: 'Invalid credentials' })
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(400).json({ error: 'Invalid credentials' })
    const token = generateToken({ id: user.id, role: user.role })
    res.json({ token, user: sanitizeUser(user) })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ error: 'Failed to login' })
  }
})

router.get('/me', authGuard, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { agent: true, customer: true },
  })
  res.json({ user: sanitizeUser(user) })
})

module.exports = router
