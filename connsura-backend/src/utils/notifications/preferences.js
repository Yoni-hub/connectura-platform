const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailProfileUpdatesEnabled: false,
  emailFeatureUpdatesEnabled: true,
  emailMarketingEnabled: false,
}

const normalizeLegacyEmailSetting = (value) => {
  const normalized = String(value || '').toLowerCase()
  if (['all', 'important', 'none'].includes(normalized)) return normalized
  return 'all'
}

const deriveFromLegacyPreferences = (legacy = {}) => {
  const emailSetting = normalizeLegacyEmailSetting(legacy?.email)
  if (emailSetting === 'none') {
    return {
      emailProfileUpdatesEnabled: false,
      emailFeatureUpdatesEnabled: false,
      emailMarketingEnabled: false,
    }
  }
  if (emailSetting === 'important') {
    return {
      emailProfileUpdatesEnabled: true,
      emailFeatureUpdatesEnabled: false,
      emailMarketingEnabled: false,
    }
  }
  return {
    emailProfileUpdatesEnabled: true,
    emailFeatureUpdatesEnabled: true,
    emailMarketingEnabled: false,
  }
}

const mapPreferencesToLegacy = (prefs = {}) => {
  const profileEnabled = prefs.emailProfileUpdatesEnabled !== false
  const featureEnabled = prefs.emailFeatureUpdatesEnabled !== false
  let email = 'all'
  if (!profileEnabled && !featureEnabled) {
    email = 'none'
  } else if (profileEnabled && !featureEnabled) {
    email = 'important'
  }
  return {
    email,
    inapp: true,
    loginAlerts: true,
    groups: {
      system: true,
      passport: true,
    },
  }
}

const getDefaultPreferences = () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES })

const buildRequiredNotificationItems = () => ({
  email: {
    security_account_protection: {
      login_alerts: true,
      password_email_changes: true,
      legal_policy_updates: true,
    },
    profile_sharing_activity: true,
  },
  in_app: {
    system_notifications: true,
  },
})

const toApiPreferences = (prefs) => ({
  email_profile_updates_enabled: Boolean(prefs?.emailProfileUpdatesEnabled),
  email_feature_updates_enabled: Boolean(prefs?.emailFeatureUpdatesEnabled),
  email_marketing_enabled: Boolean(prefs?.emailMarketingEnabled),
  updated_at: prefs?.updatedAt || null,
  updated_by_user_id: prefs?.updatedByUserId || null,
  preferences_version: prefs?.preferencesVersion ?? null,
})

const readBoolean = (value) => (typeof value === 'boolean' ? value : null)

const parsePreferenceUpdates = (payload = {}) => {
  const mapping = {
    email_profile_updates_enabled: 'emailProfileUpdatesEnabled',
    email_feature_updates_enabled: 'emailFeatureUpdatesEnabled',
    email_marketing_enabled: 'emailMarketingEnabled',
  }

  const updates = {}
  const errors = []

  Object.entries(mapping).forEach(([apiKey, field]) => {
    const value = Object.prototype.hasOwnProperty.call(payload, apiKey)
      ? payload[apiKey]
      : payload[field]
    if (value === undefined) return
    const normalized = readBoolean(value)
    if (normalized === null) {
      errors.push(`${apiKey} must be a boolean`)
      return
    }
    updates[field] = normalized
  })

  return { updates, errors }
}

const ensureNotificationPreferences = async (prisma, userId, options = {}) => {
  const existing = await prisma.notificationPreferences.findUnique({ where: { userId } })
  if (existing) return existing

  let derived = getDefaultPreferences()
  if (options.legacyPreferences) {
    derived = deriveFromLegacyPreferences(options.legacyPreferences)
  }

  const created = await prisma.notificationPreferences.create({
    data: {
      userId,
      emailProfileUpdatesEnabled: derived.emailProfileUpdatesEnabled,
      emailFeatureUpdatesEnabled: derived.emailFeatureUpdatesEnabled,
      emailMarketingEnabled: derived.emailMarketingEnabled,
      preferencesVersion: 1,
      updatedByUserId: options.updatedByUserId || userId,
    },
  })
  return created
}

module.exports = {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildRequiredNotificationItems,
  deriveFromLegacyPreferences,
  ensureNotificationPreferences,
  getDefaultPreferences,
  mapPreferencesToLegacy,
  parsePreferenceUpdates,
  toApiPreferences,
}
