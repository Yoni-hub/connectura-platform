const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const createSeedUser = async () => {
  const email = `notif-seed-${Date.now()}@connsura.test`
  const user = await prisma.user.create({
    data: {
      email,
      password: 'hashed',
      role: 'CUSTOMER',
      emailVerified: true,
      customer: {
        create: {
          name: 'Notification Seed',
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
  })
  return user
}

async function main() {
  const requestedUserId = process.env.NOTIFICATION_SEED_USER_ID
  let user = null
  if (requestedUserId) {
    const id = Number(requestedUserId)
    if (Number.isFinite(id) && id > 0) {
      user = await prisma.user.findUnique({ where: { id } })
    }
  }
  if (!user) {
    user = await createSeedUser()
  }

  const now = new Date()
  const records = [
    {
      channel: 'EMAIL',
      eventType: 'LOGIN_ALERT',
      severity: 'SECURITY',
      userId: user.id,
      recipientEmail: user.email,
      subject: 'New sign-in detected',
      provider: 'dry-run',
      status: 'SENT',
      required: true,
      metadata: { ip: '203.0.113.42', approximate_location: 'US-VA' },
      createdAt: new Date(now.getTime() - 1000 * 60 * 60),
    },
    {
      channel: 'EMAIL',
      eventType: 'PROFILE_UPDATED',
      severity: 'INFO',
      userId: user.id,
      recipientEmail: user.email,
      subject: 'Your insurance profile was updated',
      provider: 'dry-run',
      status: 'SKIPPED',
      required: false,
      preferenceSnapshot: {
        email_profile_updates_enabled: false,
        email_feature_updates_enabled: true,
        email_marketing_enabled: false,
      },
      createdAt: new Date(now.getTime() - 1000 * 60 * 30),
    },
    {
      channel: 'EMAIL',
      eventType: 'LEGAL_POLICY_UPDATE',
      severity: 'LEGAL',
      userId: user.id,
      recipientEmail: user.email,
      subject: 'Connsura policy update',
      provider: 'dry-run',
      status: 'SENT',
      required: true,
      metadata: { doc: 'privacy', version: '2026-02-15' },
      createdAt: new Date(now.getTime() - 1000 * 60 * 10),
    },
    {
      channel: 'IN_APP',
      eventType: 'IN_APP_NOTICE',
      severity: 'INFO',
      userId: user.id,
      status: 'SENT',
      required: true,
      metadata: { type: 'welcome' },
      createdAt: new Date(now.getTime() - 1000 * 60 * 5),
    },
  ]

  const result = await prisma.notificationLog.createMany({ data: records })
  console.log(`Created ${result.count} notification logs for user #${user.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
