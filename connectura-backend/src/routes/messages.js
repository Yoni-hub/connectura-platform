const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')

const router = express.Router()

const formatMessage = (message) => ({
  id: message.id,
  body: message.body,
  senderRole: message.senderRole,
  createdAt: message.createdAt,
  customer: message.customer
    ? {
        id: message.customer.id,
        name: message.customer.name,
        email: message.customer.user?.email,
      }
    : null,
})

router.post('/', authGuard, async (req, res) => {
  const { agentId, body } = req.body || {}
  if (!agentId || !String(body || '').trim()) {
    return res.status(400).json({ error: 'Agent and message are required' })
  }
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can send messages' })
  }
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const agent = await prisma.agent.findUnique({ where: { id: Number(agentId) } })
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    const message = await prisma.message.create({
      data: {
        agentId: Number(agentId),
        customerId: customer.id,
        body: String(body).trim(),
        senderRole: 'CUSTOMER',
      },
      include: { customer: { include: { user: true } } },
    })

    res.status(201).json({ message: formatMessage(message) })
  } catch (err) {
    console.error('message send error', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

router.get('/agent/:id', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  if (!agentId) return res.status(400).json({ error: 'Agent id required' })
  if (req.user.role !== 'AGENT') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const agent = await prisma.agent.findUnique({ where: { userId: req.user.id } })
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    if (agent.id !== agentId) {
      return res.status(403).json({ error: 'Cannot access messages for this agent' })
    }
    const messages = await prisma.message.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { include: { user: true } } },
    })
    res.json({ messages: messages.map(formatMessage) })
  } catch (err) {
    console.error('message fetch error', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

module.exports = router
