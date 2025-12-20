const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')

const router = express.Router()

const formatCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  email: customer.user?.email,
})

const formatAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  email: agent.user?.email,
  photo: agent.photo,
})

const formatMessage = (message) => ({
  id: message.id,
  body: message.body,
  senderRole: message.senderRole,
  createdAt: message.createdAt,
  customer: message.customer ? formatCustomer(message.customer) : null,
  agent: message.agent ? formatAgent(message.agent) : null,
})

const buildCustomerThreads = (messages) => {
  const seen = new Set()
  const threads = []
  messages.forEach((message) => {
    const customer = message.customer
    if (!customer || seen.has(customer.id)) return
    seen.add(customer.id)
    threads.push({
      customer: formatCustomer(customer),
      lastMessage: formatMessage(message),
    })
  })
  return threads
}

const buildAgentThreads = (messages) => {
  const seen = new Set()
  const threads = []
  messages.forEach((message) => {
    const agent = message.agent
    if (!agent || seen.has(agent.id)) return
    seen.add(agent.id)
    threads.push({
      agent: formatAgent(agent),
      lastMessage: formatMessage(message),
    })
  })
  return threads
}

router.post('/', authGuard, async (req, res) => {
  try {
    const { agentId, customerId, body } = req.body || {}
    const trimmed = String(body || '').trim()
    if (!trimmed) {
      return res.status(400).json({ error: 'Message is required' })
    }

    if (req.user.role === 'CUSTOMER') {
      if (!agentId) {
        return res.status(400).json({ error: 'Agent is required' })
      }
      const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
      if (!customer) return res.status(404).json({ error: 'Customer not found' })

      const agent = await prisma.agent.findUnique({ where: { id: Number(agentId) } })
      if (!agent) return res.status(404).json({ error: 'Agent not found' })

      const message = await prisma.message.create({
        data: {
          agentId: Number(agentId),
          customerId: customer.id,
          body: trimmed,
          senderRole: 'CUSTOMER',
        },
        include: {
          customer: { include: { user: true } },
          agent: { include: { user: true } },
        },
      })

      return res.status(201).json({ message: formatMessage(message) })
    }

    if (req.user.role === 'AGENT') {
      if (!customerId) {
        return res.status(400).json({ error: 'Customer is required' })
      }
      const agent = await prisma.agent.findUnique({ where: { userId: req.user.id } })
      if (!agent) return res.status(404).json({ error: 'Agent not found' })

      const customer = await prisma.customer.findUnique({
        where: { id: Number(customerId) },
        include: { user: true },
      })
      if (!customer) return res.status(404).json({ error: 'Customer not found' })

      const existing = await prisma.message.findFirst({
        where: { agentId: agent.id, customerId: customer.id },
      })
      if (!existing) {
        return res.status(400).json({ error: 'Conversation not found' })
      }

      const message = await prisma.message.create({
        data: {
          agentId: agent.id,
          customerId: customer.id,
          body: trimmed,
          senderRole: 'AGENT',
        },
        include: {
          customer: { include: { user: true } },
          agent: { include: { user: true } },
        },
      })

      return res.status(201).json({ message: formatMessage(message) })
    }

    return res.status(403).json({ error: 'Only customers or agents can send messages' })
  } catch (err) {
    console.error('message send error', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

router.get('/agent/:id/threads', authGuard, async (req, res) => {
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
      include: { customer: { include: { user: true } }, agent: { include: { user: true } } },
    })
    res.json({ threads: buildCustomerThreads(messages) })
  } catch (err) {
    console.error('message threads error', err)
    res.status(500).json({ error: 'Failed to load message threads' })
  }
})

router.get('/agent/:id/thread/:customerId', authGuard, async (req, res) => {
  const agentId = Number(req.params.id)
  const customerId = Number(req.params.customerId)
  if (!agentId || !customerId) return res.status(400).json({ error: 'Agent and customer required' })
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
      where: { agentId, customerId },
      orderBy: { createdAt: 'asc' },
      include: { customer: { include: { user: true } }, agent: { include: { user: true } } },
    })
    res.json({ messages: messages.map(formatMessage) })
  } catch (err) {
    console.error('message thread error', err)
    res.status(500).json({ error: 'Failed to load messages' })
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
      include: { customer: { include: { user: true } }, agent: { include: { user: true } } },
    })
    res.json({ messages: messages.map(formatMessage) })
  } catch (err) {
    console.error('message fetch error', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

router.get('/customer/:id/threads', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    if (customer.id !== customerId) {
      return res.status(403).json({ error: 'Cannot access messages for this customer' })
    }
    const messages = await prisma.message.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { customer: { include: { user: true } }, agent: { include: { user: true } } },
    })
    res.json({ threads: buildAgentThreads(messages) })
  } catch (err) {
    console.error('message threads error', err)
    res.status(500).json({ error: 'Failed to load message threads' })
  }
})

router.get('/customer/:id/thread/:agentId', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const agentId = Number(req.params.agentId)
  if (!customerId || !agentId) return res.status(400).json({ error: 'Customer and agent required' })
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    if (customer.id !== customerId) {
      return res.status(403).json({ error: 'Cannot access messages for this customer' })
    }
    const messages = await prisma.message.findMany({
      where: { customerId, agentId },
      orderBy: { createdAt: 'asc' },
      include: { customer: { include: { user: true } }, agent: { include: { user: true } } },
    })
    res.json({ messages: messages.map(formatMessage) })
  } catch (err) {
    console.error('message thread error', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

module.exports = router
