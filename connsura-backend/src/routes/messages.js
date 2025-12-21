const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')

const router = express.Router()

// In-memory message store to keep chat non-persistent.
const messageStore = {
  nextId: 1,
  conversations: new Map(),
}

const conversationKey = (agentId, customerId) => `${agentId}:${customerId}`

const getConversation = (agentId, customerId) =>
  messageStore.conversations.get(conversationKey(agentId, customerId)) || null

const ensureConversation = (agentId, customerId) => {
  const key = conversationKey(agentId, customerId)
  if (!messageStore.conversations.has(key)) {
    messageStore.conversations.set(key, [])
  }
  return messageStore.conversations.get(key)
}

const addMessage = (agentId, customerId, body, senderRole) => {
  const message = {
    id: messageStore.nextId++,
    agentId,
    customerId,
    body,
    senderRole,
    createdAt: new Date(),
  }
  const conversation = ensureConversation(agentId, customerId)
  conversation.push(message)
  return message
}

const listThreadsForAgent = (agentId) => {
  const threads = []
  messageStore.conversations.forEach((messages, key) => {
    if (!messages.length) return
    const [keyAgentId, keyCustomerId] = key.split(':').map(Number)
    if (keyAgentId !== agentId) return
    const lastMessage = messages[messages.length - 1]
    threads.push({ agentId: keyAgentId, customerId: keyCustomerId, lastMessage })
  })
  return threads.sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt)
}

const listThreadsForCustomer = (customerId) => {
  const threads = []
  messageStore.conversations.forEach((messages, key) => {
    if (!messages.length) return
    const [keyAgentId, keyCustomerId] = key.split(':').map(Number)
    if (keyCustomerId !== customerId) return
    const lastMessage = messages[messages.length - 1]
    threads.push({ agentId: keyAgentId, customerId: keyCustomerId, lastMessage })
  })
  return threads.sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt)
}

const listMessagesForAgent = (agentId) => {
  const messages = []
  messageStore.conversations.forEach((conversation, key) => {
    const [keyAgentId] = key.split(':').map(Number)
    if (keyAgentId !== agentId) return
    messages.push(...conversation)
  })
  return messages.sort((a, b) => b.createdAt - a.createdAt)
}

const listMessagesForThread = (agentId, customerId) => {
  const conversation = getConversation(agentId, customerId)
  if (!conversation) return []
  return [...conversation].sort((a, b) => a.createdAt - b.createdAt)
}

const hydrateMessages = async (messages) => {
  if (!messages.length) return []
  const agentIds = [...new Set(messages.map((message) => message.agentId))]
  const customerIds = [...new Set(messages.map((message) => message.customerId))]
  const [agents, customers] = await Promise.all([
    prisma.agent.findMany({ where: { id: { in: agentIds } }, include: { user: true } }),
    prisma.customer.findMany({ where: { id: { in: customerIds } }, include: { user: true } }),
  ])
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]))
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]))
  return messages.map((message) => ({
    ...message,
    agent: agentMap.get(message.agentId) || null,
    customer: customerMap.get(message.customerId) || null,
  }))
}

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
      const customer = await prisma.customer.findUnique({
        where: { userId: req.user.id },
        include: { user: true },
      })
      if (!customer) return res.status(404).json({ error: 'Customer not found' })

      const agent = await prisma.agent.findUnique({
        where: { id: Number(agentId) },
        include: { user: true },
      })
      if (!agent) return res.status(404).json({ error: 'Agent not found' })

      const message = addMessage(Number(agentId), customer.id, trimmed, 'CUSTOMER')
      return res.status(201).json({ message: formatMessage({ ...message, customer, agent }) })
    }

    if (req.user.role === 'AGENT') {
      if (!customerId) {
        return res.status(400).json({ error: 'Customer is required' })
      }
      const agent = await prisma.agent.findUnique({
        where: { userId: req.user.id },
        include: { user: true },
      })
      if (!agent) return res.status(404).json({ error: 'Agent not found' })

      const customer = await prisma.customer.findUnique({
        where: { id: Number(customerId) },
        include: { user: true },
      })
      if (!customer) return res.status(404).json({ error: 'Customer not found' })

      const existing = getConversation(agent.id, customer.id)
      if (!existing || existing.length === 0) {
        return res.status(400).json({ error: 'Conversation not found' })
      }

      const message = addMessage(agent.id, customer.id, trimmed, 'AGENT')
      return res.status(201).json({ message: formatMessage({ ...message, customer, agent }) })
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
    const threads = listThreadsForAgent(agentId)
    const hydrated = await hydrateMessages(threads.map((thread) => thread.lastMessage))
    res.json({ threads: buildCustomerThreads(hydrated) })
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
    const messages = listMessagesForThread(agentId, customerId)
    const hydrated = await hydrateMessages(messages)
    res.json({ messages: hydrated.map(formatMessage) })
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
    const messages = listMessagesForAgent(agentId)
    const hydrated = await hydrateMessages(messages)
    res.json({ messages: hydrated.map(formatMessage) })
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
    const threads = listThreadsForCustomer(customerId)
    const hydrated = await hydrateMessages(threads.map((thread) => thread.lastMessage))
    res.json({ threads: buildAgentThreads(hydrated) })
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
    const messages = listMessagesForThread(agentId, customerId)
    const hydrated = await hydrateMessages(messages)
    res.json({ messages: hydrated.map(formatMessage) })
  } catch (err) {
    console.error('message thread error', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

module.exports = router
