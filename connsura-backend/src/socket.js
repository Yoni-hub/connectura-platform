const { Server } = require('socket.io')
const prisma = require('./prisma')
const { verifyToken } = require('./utils/token')
const { getConsentStatus } = require('./utils/legalDocuments')

const USER_AUTH_COOKIE = process.env.SESSION_COOKIE_NAME || 'connsura_session'

const getCookieValue = (header, name) => {
  if (!header) return null
  const parts = header.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    if (key !== name) continue
    const value = trimmed.slice(eqIndex + 1)
    return decodeURIComponent(value)
  }
  return null
}

const getSocketAuthToken = (socket) => {
  const authToken = socket.handshake?.auth?.token
  if (authToken) return authToken
  const header = socket.handshake?.headers?.authorization
  if (header && header.startsWith('Bearer ')) {
    return header.replace('Bearer ', '')
  }
  const cookieHeader = socket.handshake?.headers?.cookie
  return getCookieValue(cookieHeader, USER_AUTH_COOKIE)
}

const getUserFromToken = async (token) => {
  const decoded = verifyToken(token)
  const user = await prisma.user.findUnique({ where: { id: decoded.id } })
  if (!user) return null
  if (user.passwordChangedAt && decoded.iat) {
    const issuedAt = new Date(decoded.iat * 1000)
    if (issuedAt < user.passwordChangedAt) return null
  }
  if (user.sessionsRevokedAt && decoded.iat) {
    const issuedAt = new Date(decoded.iat * 1000)
    if (issuedAt < user.sessionsRevokedAt) return null
  }
  return user
}

const resolveParticipant = async (user) => {
  if (user.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({ where: { userId: user.id } })
    if (!agent) return null
    return { role: 'AGENT', participantId: agent.id }
  }
  if (user.role === 'CUSTOMER') {
    const client = await prisma.customer.findUnique({ where: { userId: user.id } })
    if (!client) return null
    return { role: 'CUSTOMER', participantId: client.id }
  }
  return null
}

const getConversationIdsForUser = async (context) => {
  if (!context) return []
  const where = context.role === 'AGENT' ? { agentId: context.participantId } : { clientId: context.participantId }
  const conversations = await prisma.conversation.findMany({
    where,
    select: { id: true },
  })
  return conversations.map((conversation) => conversation.id)
}

const canJoinConversation = async (context, conversationId) => {
  if (!context) return false
  const where =
    context.role === 'AGENT'
      ? { id: conversationId, agentId: context.participantId }
      : { id: conversationId, clientId: context.participantId }
  const conversation = await prisma.conversation.findFirst({ where, select: { id: true } })
  return Boolean(conversation)
}

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = getSocketAuthToken(socket)
      if (!token) return next(new Error('Unauthorized'))
      const user = await getUserFromToken(token)
      if (!user) return next(new Error('Unauthorized'))
      const consentStatus = await getConsentStatus(prisma, user)
      if (consentStatus?.missing?.length) {
        return next(new Error('Consent required'))
      }
      socket.user = user
      next()
    } catch (err) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', async (socket) => {
    const user = socket.user
    const context = await resolveParticipant(user)
    if (!context) return

    socket.join(`user:${user.id}`)

    const conversationIds = await getConversationIdsForUser(context)
    conversationIds.forEach((id) => socket.join(`conversation:${id}`))

    socket.on('conversation:join', async ({ conversationId }) => {
      const numericId = Number(conversationId)
      if (!numericId || Number.isNaN(numericId)) return
      const allowed = await canJoinConversation(context, numericId)
      if (!allowed) return
      socket.join(`conversation:${numericId}`)
    })
  })

  return io
}

module.exports = { initSocket }
