const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { io } = require('socket.io-client')
const prisma = require('../src/prisma')
const { generateToken } = require('../src/utils/token')
const { createApp, createServer } = require('../src/server')

const uniqueEmail = (label) => `${label}-${Date.now()}@test.local`

const createAgent = async (userId) =>
  prisma.agent.create({
    data: {
      userId,
      name: 'Agent Test',
      bio: 'Agent bio',
      photo: '',
      languages: JSON.stringify(['en']),
      states: JSON.stringify(['NY']),
      specialty: 'Auto',
      availability: 'online',
      rating: 5,
      reviews: JSON.stringify([]),
      products: JSON.stringify([]),
      appointedCarriers: JSON.stringify([]),
    },
  })

const createCustomer = async (userId) =>
  prisma.customer.create({
    data: {
      userId,
      name: 'Client Test',
      preferredLangs: JSON.stringify(['en']),
      priorInsurance: JSON.stringify([]),
      coverages: JSON.stringify([]),
      profileData: JSON.stringify({}),
    },
  })

let agentUser
let agent
let customerUser
let customer
let outsiderUser
let outsiderAgent
let conversation
let agentToken
let customerToken
let outsiderToken

test.before(async () => {
  agentUser = await prisma.user.create({
    data: { email: uniqueEmail('agent'), password: 'test', role: 'AGENT' },
  })
  customerUser = await prisma.user.create({
    data: { email: uniqueEmail('client'), password: 'test', role: 'CUSTOMER' },
  })
  outsiderUser = await prisma.user.create({
    data: { email: uniqueEmail('outsider'), password: 'test', role: 'AGENT' },
  })

  agent = await createAgent(agentUser.id)
  customer = await createCustomer(customerUser.id)
  outsiderAgent = await createAgent(outsiderUser.id)

  await prisma.profileShare.create({
    data: {
      token: `share-${Date.now()}`,
      codeHash: 'hash',
      sections: JSON.stringify({}),
      snapshot: JSON.stringify({}),
      customerId: customer.id,
      agentId: agent.id,
      status: 'active',
      pendingEdits: JSON.stringify({}),
      pendingStatus: 'none',
    },
  })

  conversation = await prisma.conversation.create({
    data: {
      clientId: customer.id,
      agentId: agent.id,
    },
  })

  agentToken = generateToken({ id: agentUser.id, role: agentUser.role })
  customerToken = generateToken({ id: customerUser.id, role: customerUser.role })
  outsiderToken = generateToken({ id: outsiderUser.id, role: outsiderUser.role })
})

test.after(async () => {
  await prisma.readState.deleteMany()
  await prisma.message.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.profileShare.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@test.local' } },
  })
})

test('non-participant cannot read or send messages', async () => {
  const app = createApp()
  const readRes = await request(app)
    .get(`/api/messages/conversations/${conversation.id}/messages`)
    .set('Authorization', `Bearer ${outsiderToken}`)
  assert.equal(readRes.status, 403)

  const sendRes = await request(app)
    .post(`/api/messages/conversations/${conversation.id}/messages`)
    .set('Authorization', `Bearer ${outsiderToken}`)
    .send({ body: 'Hello' })
  assert.equal(sendRes.status, 403)
})

test('sending a message emits realtime update to recipient', async () => {
  const { app, server } = createServer()
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port

  const socket = io(`http://localhost:${port}`, {
    auth: { token: agentToken },
    transports: ['websocket'],
  })

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve)
    socket.on('connect_error', reject)
  })

  const payloadPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No realtime message received')), 5000)
    socket.on('message:new', (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

  const sendRes = await request(app)
    .post(`/api/messages/conversations/${conversation.id}/messages`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ body: 'Hello agent' })
  assert.equal(sendRes.status, 201)

  const payload = await payloadPromise
  assert.equal(payload.conversationId, conversation.id)
  assert.equal(payload.message.body, 'Hello agent')

  socket.disconnect()
  await new Promise((resolve) => server.close(resolve))
})
