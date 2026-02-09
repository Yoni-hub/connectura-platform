const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')

const router = express.Router()

const MAX_BODY_LENGTH = 4000
const RATE_WINDOW_MS = 10_000
const RATE_MAX = 10

const rateState = new Map()

const nowUtc = () => new Date()

const enforceRateLimit = (userId) => {
  const now = Date.now()
  const entry = rateState.get(userId) || { count: 0, resetAt: now + RATE_WINDOW_MS }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + RATE_WINDOW_MS
  }
  entry.count += 1
  rateState.set(userId, entry)
  if (entry.count > RATE_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }
  return { ok: true }
}

const getUserContext = async (user) => {
  if (user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: user.id },
      include: { user: true },
    })
    if (!agent) return null
    return { role: 'AGENT', agent, client: null, participantId: agent.id }
  }
  if (user?.role === 'CUSTOMER') {
    const client = await prisma.customer.findUnique({
      where: { userId: user.id },
      include: { user: true },
    })
    if (!client) return null
    return { role: 'CUSTOMER', agent: null, client, participantId: client.id }
  }
  return null
}

const requireShare = String(process.env.MESSAGING_REQUIRE_SHARE || 'true').toLowerCase() !== 'false'

const ensureRelationship = async (clientId, agentId) => {
  if (!requireShare) return true
  const share = await prisma.profileShare.findFirst({
    where: { customerId: clientId, agentId, status: 'active' },
    select: { id: true },
  })
  return Boolean(share)
}

const resolveOtherParty = (conversation, role) => {
  if (role === 'AGENT') {
    const client = conversation.client
    return {
      id: client?.id,
      name: client?.name || client?.user?.email || 'Client',
      role: 'Client',
      email: client?.user?.email || '',
    }
  }
  const agent = conversation.agent
  return {
    id: agent?.id,
    name: agent?.name || agent?.user?.email || 'Agent',
    role: 'Agent',
    email: agent?.user?.email || '',
    photo: agent?.photo || '',
  }
}

const formatMessage = (message, conversation) => {
  const senderRole = message.senderId === conversation.agentId ? 'AGENT' : 'CUSTOMER'
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderRole,
    body: message.body,
    createdAt: message.createdAt,
  }
}

const parseCursor = (cursorRaw) => {
  if (!cursorRaw) return null
  const asNumber = Number(cursorRaw)
  if (Number.isFinite(asNumber) && String(asNumber) === String(cursorRaw)) {
    return { type: 'id', value: asNumber }
  }
  const date = new Date(cursorRaw)
  if (!Number.isNaN(date.getTime())) {
    return { type: 'date', value: date }
  }
  return null
}

router.get('/conversations', authGuard, async (req, res) => {
  try {
    const context = await getUserContext(req.user)
    if (!context) return res.status(404).json({ error: 'Profile not found' })

    const where =
      context.role === 'AGENT'
        ? { agentId: context.agent.id }
        : { clientId: context.client.id }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        client: { include: { user: true } },
        agent: { include: { user: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        readStates: { where: { userId: req.user.id } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const otherParty = resolveOtherParty(conversation, context.role)
        const lastMessage = conversation.messages[0]
        const lastReadAt = conversation.readStates[0]?.lastReadAt || null
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: context.participantId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        })

        return {
          conversationId: conversation.id,
          otherPartyName: otherParty.name,
          otherPartyRole: otherParty.role,
          otherPartyId: otherParty.id,
          otherPartyEmail: otherParty.email,
          otherPartyPhoto: otherParty.photo || '',
          lastMessageSnippet: lastMessage?.body?.slice(0, 120) || '',
          lastMessageAt: lastMessage?.createdAt || conversation.updatedAt,
          unreadCount,
        }
      })
    )

    res.json({ conversations: items })
  } catch (err) {
    console.error('messages conversations error', err)
    res.status(500).json({ error: 'Failed to load conversations' })
  }
})

router.post('/conversations', authGuard, async (req, res) => {
  try {
    const context = await getUserContext(req.user)
    if (!context) return res.status(404).json({ error: 'Profile not found' })

    const otherUserId = req.body?.otherUserId
    const agentIdInput = req.body?.agentId
    const clientIdInput = req.body?.clientId ?? req.body?.customerId

    let agentId = null
    let clientId = null

    if (context.role === 'CUSTOMER') {
      agentId = Number(agentIdInput ?? otherUserId)
      if (!agentId || Number.isNaN(agentId)) {
        return res.status(400).json({ error: 'Agent id is required' })
      }
      clientId = context.client.id
    } else if (context.role === 'AGENT') {
      clientId = Number(clientIdInput ?? otherUserId)
      if (!clientId || Number.isNaN(clientId)) {
        return res.status(400).json({ error: 'Client id is required' })
      }
      agentId = context.agent.id
    } else {
      return res.status(403).json({ error: 'Only customers or agents can create conversations' })
    }

    const relationshipOk = await ensureRelationship(clientId, agentId)
    if (!relationshipOk) {
      return res.status(403).json({ error: 'Messaging is only available for connected clients and agents' })
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        clientId_agentId: {
          clientId,
          agentId,
        },
      },
      update: {},
      create: {
        clientId,
        agentId,
      },
    })

    res.status(201).json({ conversationId: conversation.id })
  } catch (err) {
    console.error('messages create conversation error', err)
    res.status(500).json({ error: 'Failed to create conversation' })
  }
})

router.get('/conversations/:id/messages', authGuard, async (req, res) => {
  try {
    const conversationId = Number(req.params.id)
    if (!conversationId || Number.isNaN(conversationId)) {
      return res.status(400).json({ error: 'Conversation id is required' })
    }

    const context = await getUserContext(req.user)
    if (!context) return res.status(404).json({ error: 'Profile not found' })

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        client: { include: { user: true } },
        agent: { include: { user: true } },
      },
    })
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

    const isParticipant =
      (context.role === 'AGENT' && conversation.agentId === context.agent.id) ||
      (context.role === 'CUSTOMER' && conversation.clientId === context.client.id)
    if (!isParticipant) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const limit = Math.min(Math.max(Number(req.query?.limit) || 30, 1), 100)
    const cursor = parseCursor(req.query?.cursor)
    const where = { conversationId }
    if (cursor?.type === 'id') {
      where.id = { lt: cursor.value }
    } else if (cursor?.type === 'date') {
      where.createdAt = { lt: cursor.value }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const otherParty = resolveOtherParty(conversation, context.role)
    const payload = messages.map((message) => formatMessage(message, conversation))
    const nextCursor = messages.length ? messages[messages.length - 1].createdAt.toISOString() : null

    res.json({
      conversation: {
        id: conversation.id,
        otherPartyName: otherParty.name,
        otherPartyRole: otherParty.role,
        otherPartyId: otherParty.id,
      },
      messages: payload,
      nextCursor,
      order: 'desc',
    })
  } catch (err) {
    console.error('messages thread error', err)
    res.status(500).json({ error: 'Failed to load messages' })
  }
})

router.post('/conversations/:id/messages', authGuard, async (req, res) => {
  try {
    const conversationId = Number(req.params.id)
    if (!conversationId || Number.isNaN(conversationId)) {
      return res.status(400).json({ error: 'Conversation id is required' })
    }

    const context = await getUserContext(req.user)
    if (!context) return res.status(404).json({ error: 'Profile not found' })

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agent: { select: { userId: true } },
        client: { select: { userId: true } },
      },
    })
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

    const isParticipant =
      (context.role === 'AGENT' && conversation.agentId === context.agent.id) ||
      (context.role === 'CUSTOMER' && conversation.clientId === context.client.id)
    if (!isParticipant) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const relationshipOk = await ensureRelationship(conversation.clientId, conversation.agentId)
    if (!relationshipOk) {
      return res.status(403).json({ error: 'Messaging is only available for connected clients and agents' })
    }

    const trimmed = String(req.body?.body || '').trim()
    if (!trimmed) {
      return res.status(400).json({ error: 'Message body is required' })
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return res.status(400).json({ error: `Message must be under ${MAX_BODY_LENGTH} characters` })
    }

    const rate = enforceRateLimit(req.user.id)
    if (!rate.ok) {
      res.set('Retry-After', String(rate.retryAfter))
      return res.status(429).json({ error: 'Too many messages, slow down.' })
    }

    const sentAt = nowUtc()
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: context.participantId,
          body: trimmed,
          createdAt: sentAt,
        },
      })
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: sentAt },
      })
      await tx.readState.upsert({
        where: {
          conversationId_userId: {
            conversationId,
            userId: req.user.id,
          },
        },
        update: { lastReadAt: sentAt },
        create: { conversationId, userId: req.user.id, lastReadAt: sentAt },
      })
      return created
    })

    const io = req.app.get('io')
    if (io) {
      const formatted = formatMessage(message, conversation)
      const agentUserId = conversation.agent?.userId
      const clientUserId = conversation.client?.userId
      io.to(`conversation:${conversationId}`).emit('message:new', {
        conversationId,
        message: formatted,
      })
      if (agentUserId) {
        io.to(`user:${agentUserId}`).emit('message:new', {
          conversationId,
          message: formatted,
        })
      }
      if (clientUserId) {
        io.to(`user:${clientUserId}`).emit('message:new', {
          conversationId,
          message: formatted,
        })
      }
      io.to(`conversation:${conversationId}`).emit('conversation:updated', {
        conversationId,
        lastMessageAt: message.createdAt,
      })
    }

    res.status(201).json({ message: formatMessage(message, conversation) })
  } catch (err) {
    console.error('messages send error', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

router.post('/conversations/:id/read', authGuard, async (req, res) => {
  try {
    const conversationId = Number(req.params.id)
    if (!conversationId || Number.isNaN(conversationId)) {
      return res.status(400).json({ error: 'Conversation id is required' })
    }

    const context = await getUserContext(req.user)
    if (!context) return res.status(404).json({ error: 'Profile not found' })

    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

    const isParticipant =
      (context.role === 'AGENT' && conversation.agentId === context.agent.id) ||
      (context.role === 'CUSTOMER' && conversation.clientId === context.client.id)
    if (!isParticipant) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const lastReadAt = nowUtc()
    await prisma.readState.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user.id,
        },
      },
      update: { lastReadAt },
      create: { conversationId, userId: req.user.id, lastReadAt },
    })

    res.json({ ok: true, lastReadAt })
  } catch (err) {
    console.error('messages read error', err)
    res.status(500).json({ error: 'Failed to mark conversation read' })
  }
})

module.exports = router
