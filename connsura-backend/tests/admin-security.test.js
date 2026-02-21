const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const bcrypt = require('bcrypt')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.NODE_ENV = 'test'

const { PrismaClient } = require('@prisma/client')
const { createApp } = require('../src/server')
const { generateToken } = require('../src/utils/token')

const prisma = new PrismaClient()
const app = createApp()

test('admin client responses never expose password hash and blank password updates are ignored', async () => {
  const admin = await prisma.adminUser.create({
    data: {
      email: `admin-sec-${Date.now()}@connsura.test`,
      password: 'hashed-admin',
      role: 'ADMIN',
    },
  })
  const initialHash = await bcrypt.hash('OldPass123!', 10)
  const customerUser = await prisma.user.create({
    data: {
      email: `client-sec-${Date.now()}@connsura.test`,
      password: initialHash,
      role: 'CUSTOMER',
      emailVerified: true,
      customer: {
        create: {
          name: 'Security Client',
          preferredLangs: JSON.stringify(['English']),
          priorInsurance: JSON.stringify([]),
          coverages: JSON.stringify([]),
        },
      },
    },
    include: { customer: true },
  })
  const token = generateToken({ adminId: admin.id, role: admin.role, type: 'ADMIN' })

  const getRes = await request(app)
    .get(`/admin/clients/${customerUser.customer.id}`)
    .set('Authorization', `Bearer ${token}`)
  assert.equal(getRes.statusCode, 200)
  assert.equal(getRes.body.client.userPassword, undefined)
  assert.equal(Object.hasOwn(getRes.body.client, 'userPassword'), false)

  const updateRes = await request(app)
    .put(`/admin/clients/${customerUser.customer.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Security Client Updated', password: '' })
  assert.equal(updateRes.statusCode, 200)
  assert.equal(updateRes.body.client.userPassword, undefined)
  assert.equal(Object.hasOwn(updateRes.body.client, 'userPassword'), false)

  const reloaded = await prisma.user.findUnique({ where: { id: customerUser.id } })
  assert.equal(reloaded.password, initialHash)

  await prisma.user.delete({ where: { id: customerUser.id } })
  await prisma.adminUser.delete({ where: { id: admin.id } })
})

test.after(async () => {
  await prisma.$disconnect()
})
