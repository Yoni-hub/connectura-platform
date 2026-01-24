const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { logClientAudit } = require('../utils/auditLog')

const router = express.Router()

const buildConversationId = (agentId, customerId) => `${agentId}:${customerId}`

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

const includeProfiles = {
  agent: { include: { user: true } },
  customer: { include: { user: true } },
}

const buildUnreadMapForAgent = (messages) => {
  const unreadMap = new Map()
  messages.forEach((message) => {
    if (message.senderRole !== 'CUSTOMER') return
    if (message.readByAgentAt) return
    unreadMap.set(message.customerId, (unreadMap.get(message.customerId) || 0) + 1)
  })
  return unreadMap
}

const buildUnreadMapForCustomer = (messages) => {
  const unreadMap = new Map()
  messages.forEach((message) => {
    if (message.senderRole !== 'AGENT') return
    if (message.readByCustomerAt) return
    unreadMap.set(message.agentId, (unreadMap.get(message.agentId) || 0) + 1)
  })
  return unreadMap
}

const buildCustomerThreads = (messages, unreadMap = new Map()) => {
  const seen = new Set()
  const threads = []
  messages.forEach((message) => {
    const customer = message.customer
    if (!customer || seen.has(customer.id)) return
    seen.add(customer.id)
    threads.push({
      customer: formatCustomer(customer),
      lastMessage: formatMessage(message),
      unreadCount: unreadMap.get(customer.id) || 0,
    })
  })
  return threads
}

const buildAgentThreads = (messages, unreadMap = new Map()) => {
  const seen = new Set()
  const threads = []
  messages.forEach((message) => {
    const agent = message.agent
    if (!agent || seen.has(agent.id)) return
    seen.add(agent.id)
    threads.push({
      agent: formatAgent(agent),
      lastMessage: formatMessage(message),
      unreadCount: unreadMap.get(agent.id) || 0,
    })
  })
  return threads
}

const markThreadReadForAgent = async (agentId, customerId) => {
  const now = new Date()
  await prisma.message.updateMany({
    where: {
      agentId,
      customerId,
      senderRole: 'CUSTOMER',
      readByAgentAt: null,
      deletedForAgentAt: null,
    },
    data: { readByAgentAt: now },
  })
}

const markThreadReadForCustomer = async (agentId, customerId) => {
  const now = new Date()
  await prisma.message.updateMany({
    where: {
      agentId,
      customerId,
      senderRole: 'AGENT',
      readByCustomerAt: null,
      deletedForCustomerAt: null,
    },
    data: { readByCustomerAt: now },
  })
}

const countUnreadForCustomerThread = (agentId, customerId) =>
  prisma.message.count({
    where: {
      agentId,
      customerId,
      senderRole: 'AGENT',
      readByCustomerAt: null,
      deletedForCustomerAt: null,
    },
  })

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

      const existingCount = await prisma.message.count({
        where: { agentId: agent.id, customerId: customer.id },
      })
      const now = new Date()
      const message = await prisma.message.create({
        data: {
          agentId: agent.id,
          customerId: customer.id,
          body: trimmed,
          senderRole: 'CUSTOMER',
          createdAt: now,
          readByCustomerAt: now,
          readByAgentAt: null,
          deletedForAgentAt: null,
          deletedForCustomerAt: null,
        },
        include: includeProfiles,
      })

      const conversationId = buildConversationId(agent.id, customer.id)
      if (existingCount === 0) {
        await logClientAudit(customer.id, 'CLIENT_CONVERSATION_CREATED', {
          conversation_id: conversationId,
        })
      }
      await logClientAudit(customer.id, 'CLIENT_MESSAGE_SENT', {
        conversation_id: conversationId,
        message_id: message.id,
      })

      return res.status(201).json({ message: formatMessage(message) })
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

      const existingCount = await prisma.message.count({
        where: { agentId: agent.id, customerId: customer.id },
      })
      if (existingCount === 0) {
        return res.status(400).json({ error: 'Conversation not found' })
      }

      const now = new Date()
      const message = await prisma.message.create({
        data: {
          agentId: agent.id,
          customerId: customer.id,
          body: trimmed,
          senderRole: 'AGENT',
          createdAt: now,
          readByAgentAt: now,
          readByCustomerAt: null,
          deletedForAgentAt: null,
          deletedForCustomerAt: null,
        },
        include: includeProfiles,
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
      where: { agentId, deletedForAgentAt: null },
      orderBy: { createdAt: 'desc' },
      include: includeProfiles,
    })
    const unreadMap = buildUnreadMapForAgent(messages)
    res.json({ threads: buildCustomerThreads(messages, unreadMap) })
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
    await markThreadReadForAgent(agentId, customerId)
    const messages = await prisma.message.findMany({
      where: { agentId, customerId, deletedForAgentAt: null },
      orderBy: { createdAt: 'asc' },
      include: includeProfiles,
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
      where: { agentId, deletedForAgentAt: null },
      orderBy: { createdAt: 'desc' },
      include: includeProfiles,
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
      where: { customerId, deletedForCustomerAt: null },
      orderBy: { createdAt: 'desc' },
      include: includeProfiles,
    })
    const unreadMap = buildUnreadMapForCustomer(messages)
    res.json({ threads: buildAgentThreads(messages, unreadMap) })
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
    const conversationId = buildConversationId(agentId, customerId)
    const unreadBefore = await countUnreadForCustomerThread(agentId, customerId)
    await markThreadReadForCustomer(agentId, customerId)
    const unreadAfter = await countUnreadForCustomerThread(agentId, customerId)
    await logClientAudit(customer.id, 'CLIENT_CONVERSATION_OPENED', {
      conversation_id: conversationId,
      unread_count_before: unreadBefore,
      unread_count_after: unreadAfter,
    })
    await logClientAudit(customer.id, 'CLIENT_MESSAGE_THREAD_OPENED', {
      conversation_id: conversationId,
    })
    if (unreadBefore > 0) {
      await logClientAudit(customer.id, 'CLIENT_MESSAGES_MARKED_READ', {
        conversation_id: conversationId,
        unread_count_before: unreadBefore,
        unread_count_after: unreadAfter,
      })
    }
    const messages = await prisma.message.findMany({
      where: { agentId, customerId, deletedForCustomerAt: null },
      orderBy: { createdAt: 'asc' },
      include: includeProfiles,
    })
    res.json({ messages: messages.map(formatMessage) })
  } catch (err) {
    console.error('message thread error', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

router.delete('/agent/:id/thread/:customerId', authGuard, async (req, res) => {
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
    const now = new Date()
    await prisma.message.updateMany({
      where: { agentId, customerId, deletedForAgentAt: null },
      data: { deletedForAgentAt: now },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('message thread delete error', err)
    res.status(500).json({ error: 'Failed to delete messages' })
  }
})

router.delete('/customer/:id/thread/:agentId', authGuard, async (req, res) => {
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
    const now = new Date()
    await prisma.message.updateMany({
      where: { agentId, customerId, deletedForCustomerAt: null },
      data: { deletedForCustomerAt: now },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('message thread delete error', err)
    res.status(500).json({ error: 'Failed to delete messages' })
  }
})

module.exports = router
