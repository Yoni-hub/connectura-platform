const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const {
  buildRequiredNotificationItems,
  ensureNotificationPreferences,
  parsePreferenceUpdates,
  toApiPreferences,
} = require('../utils/notifications/preferences')

const router = express.Router()

router.get('/preferences', authGuard, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
  let legacyPreferences = null
  if (customer?.profileData) {
    try {
      const parsed = JSON.parse(customer.profileData)
      legacyPreferences = parsed?.notification_prefs || null
    } catch {
      legacyPreferences = null
    }
  }
  const prefs = await ensureNotificationPreferences(prisma, req.user.id, {
    updatedByUserId: req.user.id,
    legacyPreferences,
  })
  res.json({
    preferences: toApiPreferences(prefs),
    required: buildRequiredNotificationItems(),
  })
})

router.patch('/preferences', authGuard, async (req, res) => {
  const { updates, errors } = parsePreferenceUpdates(req.body || {})
  if (errors.length) {
    return res.status(400).json({ error: errors[0], errors })
  }
  const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
  let legacyPreferences = null
  if (customer?.profileData) {
    try {
      const parsed = JSON.parse(customer.profileData)
      legacyPreferences = parsed?.notification_prefs || null
    } catch {
      legacyPreferences = null
    }
  }
  const existing = await ensureNotificationPreferences(prisma, req.user.id, {
    updatedByUserId: req.user.id,
    legacyPreferences,
  })
  if (!Object.keys(updates).length) {
    return res.json({
      preferences: toApiPreferences(existing),
      required: buildRequiredNotificationItems(),
    })
  }
  const nextVersion = (existing.preferencesVersion || 0) + 1
  const updated = await prisma.notificationPreferences.update({
    where: { userId: req.user.id },
    data: {
      ...updates,
      preferencesVersion: nextVersion,
      updatedByUserId: req.user.id,
    },
  })
  res.json({
    preferences: toApiPreferences(updated),
    required: buildRequiredNotificationItems(),
  })
})

module.exports = router
