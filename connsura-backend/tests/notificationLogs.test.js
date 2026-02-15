const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.SES_DRY_RUN = 'true'
process.env.NODE_ENV = 'test'

const { PrismaClient } = require('@prisma/client')
const { createApp } = require('../src/server')
const { generateToken } = require('../src/utils/token')
const { notifyProfileUpdated } = require('../src/utils/notifications/dispatcher')

const prisma = new PrismaClient()
const app = createApp()

const createAdmin = async () => {
  return prisma.adminUser.create({
    data: {
      email: `admin-${Date.now()}@connsura.test`,
      password: 'hashed',
      role: 'ADMIN',
    },
  })
}

const createCustomerUser = async () => {
  return prisma.user.create({
    data: {
      email: `notif-${Date.now()}@connsura.test`,
      password: 'hashed',
      role: 'CUSTOMER',
      emailVerified: true,
      customer: {
        create: {
          name: 'Notification Tester',
          preferredLangs: JSON.stringify(['English']),
          priorInsurance: JSON.stringify([]),
          coverages: JSON.stringify([]),
        },
      },
      notificationPreferences: {
        create: {
          emailProfileUpdatesEnabled: false,
          emailFeatureUpdatesEnabled: true,
          emailMarketingEnabled: false,
          preferencesVersion: 1,
        },
      },
    },
    include: { customer: true },
  })
}

test('admin notification log filters and export', async () => {
  const admin = await createAdmin()
  const user = await createCustomerUser()
  const token = generateToken({ adminId: admin.id, role: admin.role, type: 'ADMIN' })

  const now = new Date()
  await prisma.notificationLog.createMany({
    data: [
      {
        channel: 'EMAIL',
        eventType: 'PROFILE_UPDATED',
        severity: 'INFO',
        userId: user.id,
        recipientEmail: user.email,
        subject: 'Profile updated',
        provider: 'dry-run',
        status: 'SKIPPED',
        required: false,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        channel: 'EMAIL',
        eventType: 'LEGAL_POLICY_UPDATE',
        severity: 'LEGAL',
        userId: user.id,
        recipientEmail: user.email,
        subject: 'Policy update',
        provider: 'dry-run',
        status: 'SENT',
        required: true,
        createdAt: now,
      },
    ],
  })

  const res = await request(app)
    .get('/admin/notification-logs')
    .set('Authorization', `Bearer ${token}`)
    .query({ channel: 'EMAIL', status: 'SKIPPED', event_type: 'PROFILE_UPDATED', limit: 10 })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.logs.length, 1)
  assert.equal(res.body.logs[0].eventType, 'PROFILE_UPDATED')

  const exportRes = await request(app)
    .get('/admin/notification-logs/export')
    .set('Authorization', `Bearer ${token}`)
  assert.equal(exportRes.statusCode, 200)
  assert.match(exportRes.headers['content-type'], /text\/csv/)
  const headerLine = exportRes.text.split('\n')[0]
  assert.ok(headerLine.includes('created_at'))
  assert.ok(headerLine.includes('event_type'))

  await prisma.notificationLog.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
  await prisma.adminUser.delete({ where: { id: admin.id } })
})

test('opt-out creates skipped notification log', async () => {
  const user = await createCustomerUser()
  const result = await notifyProfileUpdated({ user })
  assert.equal(result?.skipped, 'disabled')

  const log = await prisma.notificationLog.findFirst({
    where: {
      userId: user.id,
      eventType: 'PROFILE_UPDATED',
      status: 'SKIPPED',
    },
    orderBy: { createdAt: 'desc' },
  })
  assert.ok(log)

  await prisma.notificationLog.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
})

test.after(async () => {
  await prisma.$disconnect()
})
