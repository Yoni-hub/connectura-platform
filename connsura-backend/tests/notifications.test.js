const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.SES_DRY_RUN = 'true'

const { PrismaClient } = require('@prisma/client')
const { createApp } = require('../src/server')
const { generateToken } = require('../src/utils/token')
const { notifyProfileUpdated } = require('../src/utils/notifications/dispatcher')

const prisma = new PrismaClient()
const app = createApp()

const ensureLegalDoc = async (type) => {
  const existing = await prisma.legalDocument.findFirst({
    where: { type },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
  })
  if (existing) return existing
  return prisma.legalDocument.create({
    data: {
      type,
      version: '1.0',
      contentHash: `hash-${type}`,
      content: `${type} content`,
      publishedAt: new Date(),
    },
  })
}

const createCustomerUser = async () => {
  const email = `notif-${Date.now()}@connsura.test`
  const user = await prisma.user.create({
    data: {
      email,
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
    },
    include: { customer: true },
  })
  const terms = await ensureLegalDoc('terms')
  const privacy = await ensureLegalDoc('privacy')
  await prisma.userConsent.createMany({
    data: [
      {
        userId: user.id,
        role: user.role,
        documentType: terms.type,
        version: terms.version,
      },
      {
        userId: user.id,
        role: user.role,
        documentType: privacy.type,
        version: privacy.version,
      },
    ],
  })
  return user
}

test('notification preferences API and optional toggle behavior', async () => {
  const user = await createCustomerUser()
  const token = generateToken({ id: user.id, role: user.role })

  const getRes = await request(app)
    .get('/api/notifications/preferences')
    .set('Authorization', `Bearer ${token}`)
  assert.equal(getRes.statusCode, 200)
  assert.equal(getRes.body.preferences.email_profile_updates_enabled, false)
  assert.equal(getRes.body.preferences.email_feature_updates_enabled, true)
  assert.equal(getRes.body.preferences.email_marketing_enabled, false)

  const patchRes = await request(app)
    .patch('/api/notifications/preferences')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email_profile_updates_enabled: false,
      email_feature_updates_enabled: false,
      email_marketing_enabled: true,
    })
  assert.equal(patchRes.statusCode, 200)
  assert.equal(patchRes.body.preferences.email_profile_updates_enabled, false)
  assert.equal(patchRes.body.preferences.email_feature_updates_enabled, false)
  assert.equal(patchRes.body.preferences.email_marketing_enabled, true)

  await prisma.notificationPreferences.update({
    where: { userId: user.id },
    data: {
      emailProfileUpdatesEnabled: false,
      emailFeatureUpdatesEnabled: true,
      emailMarketingEnabled: false,
      preferencesVersion: 2,
      updatedByUserId: user.id,
    },
  })

  const result = await notifyProfileUpdated({ user })
  assert.equal(result?.skipped, 'disabled')

  await prisma.user.delete({ where: { id: user.id } })
  await prisma.$disconnect()
})
