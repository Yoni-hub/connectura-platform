const prisma = require('../../prisma')
const {
  ensureNotificationPreferences,
  getDefaultPreferences,
} = require('./preferences')
const { sendNotificationEmail } = require('./send')
const {
  buildEmailChangedTemplate,
  buildFeatureUpdateTemplate,
  buildLegalUpdateTemplate,
  buildLoginAlertTemplate,
  buildMarketingTemplate,
  buildPasswordChangedTemplate,
  buildProfileAccessRevokedTemplate,
  buildProfileSharedTemplate,
  buildProfileUpdatedByRecipientTemplate,
  buildProfileUpdatedTemplate,
} = require('./templates')
const {
  buildPreferenceSnapshot,
  createNotificationLog,
  hashUserAgent,
} = require('./logging')

const normalizeBaseUrl = (value) => {
  if (!value) return ''
  return String(value).replace(/\/+$/, '')
}

const getFrontendBaseUrl = () =>
  normalizeBaseUrl(process.env.FRONTEND_URL || 'http://localhost:5173')

const getPasswordResetUrl = () => `${getFrontendBaseUrl()}/recover`

const resolveBrowser = (userAgent = '') => {
  const ua = String(userAgent || '').toLowerCase()
  if (!ua) return 'Unknown browser'
  if (ua.includes('edg/')) return 'Microsoft Edge'
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera'
  if (ua.includes('chrome') && !ua.includes('edg/') && !ua.includes('opr/')) return 'Chrome'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer'
  return 'Unknown browser'
}

const buildDeviceLabel = (userAgent = '') => {
  const browser = resolveBrowser(userAgent)
  if (!userAgent) return browser
  return `${browser} (${userAgent})`
}

const ensurePrefsForUser = async (userId, options = {}) => {
  let legacyPreferences = options.legacyPreferences
  if (!legacyPreferences) {
    const customer = await prisma.customer.findUnique({ where: { userId } })
    if (customer?.profileData) {
      try {
        const parsed = JSON.parse(customer.profileData)
        legacyPreferences = parsed?.notification_prefs || null
      } catch {
        legacyPreferences = null
      }
    }
  }
  return ensureNotificationPreferences(prisma, userId, { ...options, legacyPreferences })
}

const shouldSendOptional = (prefs, field) => {
  if (!prefs) return getDefaultPreferences()[field] !== false
  return prefs[field] !== false
}

const logSkippedEmail = async ({
  user,
  recipientEmail,
  eventType,
  severity = 'INFO',
  required = true,
  preferenceSnapshot = null,
  metadata = null,
  actorType = 'SYSTEM',
  actorUserId = null,
  failureReason = null,
} = {}) => {
  await createNotificationLog({
    channel: 'EMAIL',
    eventType,
    severity,
    userId: user?.id || null,
    recipientEmail: recipientEmail || user?.email || null,
    status: 'SKIPPED',
    required,
    preferenceSnapshot,
    metadata,
    actorType,
    actorUserId,
    failureReason,
  })
}

const notifyLoginAlert = async ({ user, ip, userAgent, location, wasNewDevice }) => {
  if (!user?.email) {
    await logSkippedEmail({
      user,
      eventType: 'LOGIN_ALERT',
      severity: 'SECURITY',
      required: true,
      metadata: { ip, ua: userAgent || null, approximate_location: location || null, was_new_device: Boolean(wasNewDevice) },
      actorType: 'USER',
      actorUserId: user?.id || null,
      failureReason: 'missing_email',
    })
    return { skipped: 'missing_email' }
  }
  const template = buildLoginAlertTemplate({
    time: new Date(),
    ip,
    location,
    device: buildDeviceLabel(userAgent),
    resetUrl: getPasswordResetUrl(),
  })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'security',
    log: {
      eventType: 'LOGIN_ALERT',
      severity: 'SECURITY',
      userId: user?.id || null,
      recipientUserAgentHash: hashUserAgent(userAgent),
      required: true,
      metadata: {
        ip,
        ua: userAgent || null,
        approximate_location: location || null,
        was_new_device: Boolean(wasNewDevice),
      },
      actorType: 'USER',
      actorUserId: user?.id || null,
    },
  })
}

const notifyPasswordChanged = async (user) => {
  if (!user?.email) {
    await logSkippedEmail({
      user,
      eventType: 'PASSWORD_CHANGED',
      severity: 'SECURITY',
      required: true,
      actorType: user?.id ? 'USER' : 'SYSTEM',
      actorUserId: user?.id || null,
      failureReason: 'missing_email',
    })
    return { skipped: 'missing_email' }
  }
  const template = buildPasswordChangedTemplate()
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'security',
    log: {
      eventType: 'PASSWORD_CHANGED',
      severity: 'SECURITY',
      userId: user?.id || null,
      required: true,
      actorType: user?.id ? 'USER' : 'SYSTEM',
      actorUserId: user?.id || null,
    },
  })
}

const notifyEmailChanged = async ({ user, previousEmail }) => {
  if (!user?.email) {
    await logSkippedEmail({
      user,
      eventType: 'EMAIL_CHANGED',
      severity: 'SECURITY',
      required: true,
      metadata: { previous_email: previousEmail || null },
      actorType: user?.id ? 'USER' : 'SYSTEM',
      actorUserId: user?.id || null,
      failureReason: 'missing_email',
    })
    return { skipped: 'missing_email' }
  }
  const template = buildEmailChangedTemplate({ previousEmail })
  const deliveries = []
  deliveries.push(
    sendNotificationEmail({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      category: 'security',
      log: {
        eventType: 'EMAIL_CHANGED',
        severity: 'SECURITY',
        userId: user?.id || null,
        required: true,
        metadata: { previous_email: previousEmail || null },
        actorType: user?.id ? 'USER' : 'SYSTEM',
        actorUserId: user?.id || null,
      },
    })
  )
  if (previousEmail && previousEmail !== user.email) {
    deliveries.push(
      sendNotificationEmail({
        to: previousEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        category: 'security',
        log: {
          eventType: 'EMAIL_CHANGED',
          severity: 'SECURITY',
          userId: user?.id || null,
          required: true,
          metadata: { previous_email: previousEmail || null },
          actorType: user?.id ? 'USER' : 'SYSTEM',
          actorUserId: user?.id || null,
        },
      })
    )
  }
  const results = await Promise.allSettled(deliveries)
  return { delivery: results }
}

const notifyLegalUpdate = async ({ docLabel, docType, version, publishedAt, users, actor }) => {
  const template = buildLegalUpdateTemplate({ docLabel, publishedAt })
  const targets = users || []
  const results = []
  for (const user of targets) {
    if (!user?.email) continue
    results.push(
      sendNotificationEmail({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        category: 'legal',
        log: {
          eventType: 'LEGAL_POLICY_UPDATE',
          severity: 'LEGAL',
          userId: user?.id || null,
          required: true,
          metadata: {
            doc: docType || docLabel,
            doc_label: docLabel,
            version: version || null,
            published_at: publishedAt?.toISOString?.() || null,
          },
          actorType: actor?.type || 'ADMIN',
          actorUserId: actor?.id || null,
        },
      })
    )
  }
  const settled = await Promise.allSettled(results)
  return { delivery: settled }
}

const notifyProfileShared = async ({ user, recipientName, shareId, shareScope }) => {
  if (!user?.email) {
    await logSkippedEmail({
      user,
      eventType: 'PROFILE_SHARED',
      severity: 'INFO',
      required: true,
      metadata: {
        recipient_type: 'share_link',
        recipient_name: recipientName || null,
        share_id: shareId || null,
        share_scope: shareScope || null,
      },
      actorType: 'USER',
      actorUserId: user?.id || null,
      failureReason: 'missing_email',
    })
    return { skipped: 'missing_email' }
  }
  const template = buildProfileSharedTemplate({ recipientName })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'privacy',
    log: {
      eventType: 'PROFILE_SHARED',
      severity: 'INFO',
      userId: user?.id || null,
      required: true,
      metadata: {
        recipient_type: 'share_link',
        recipient_name: recipientName || null,
        share_id: shareId || null,
        share_scope: shareScope || null,
      },
      actorType: 'USER',
      actorUserId: user?.id || null,
    },
  })
}

const notifyProfileAccessRevoked = async ({ user, recipientName, shareId }) => {
  if (!user?.email) {
    await logSkippedEmail({
      user,
      eventType: 'ACCESS_REVOKED',
      severity: 'INFO',
      required: true,
      metadata: { recipient_name: recipientName || null, share_id: shareId || null },
      actorType: 'USER',
      actorUserId: user?.id || null,
      failureReason: 'missing_email',
    })
    return { skipped: 'missing_email' }
  }
  const template = buildProfileAccessRevokedTemplate({ recipientName })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'privacy',
    log: {
      eventType: 'ACCESS_REVOKED',
      severity: 'INFO',
      userId: user?.id || null,
      required: true,
      metadata: { recipient_name: recipientName || null, share_id: shareId || null },
      actorType: 'USER',
      actorUserId: user?.id || null,
    },
  })
}

const notifyProfileUpdatedByRecipient = async ({ user, recipientName, shareId }) => {
  if (!user?.email) {
    await logSkippedEmail({
      user,
      eventType: 'PROFILE_UPDATED_BY_RECIPIENT',
      severity: 'INFO',
      required: true,
      metadata: { recipient_name: recipientName || null, share_id: shareId || null },
      actorType: 'USER',
      actorUserId: user?.id || null,
      failureReason: 'missing_email',
    })
    return { skipped: 'missing_email' }
  }
  const template = buildProfileUpdatedByRecipientTemplate({ recipientName })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'privacy',
    log: {
      eventType: 'PROFILE_UPDATED_BY_RECIPIENT',
      severity: 'INFO',
      userId: user?.id || null,
      required: true,
      metadata: { recipient_name: recipientName || null, share_id: shareId || null },
      actorType: 'USER',
      actorUserId: user?.id || null,
    },
  })
}

const notifyProfileUpdated = async ({ user }) => {
  if (!user?.email || !user?.id) {
    await logSkippedEmail({
      user,
      eventType: 'PROFILE_UPDATED',
      severity: 'INFO',
      required: false,
      failureReason: 'missing_user',
      actorType: 'USER',
      actorUserId: user?.id || null,
    })
    return { skipped: 'missing_user' }
  }
  const prefs = await ensurePrefsForUser(user.id, { updatedByUserId: user.id })
  const preferenceSnapshot = buildPreferenceSnapshot(prefs)
  if (!shouldSendOptional(prefs, 'emailProfileUpdatesEnabled')) {
    await logSkippedEmail({
      user,
      eventType: 'PROFILE_UPDATED',
      severity: 'INFO',
      required: false,
      preferenceSnapshot,
      failureReason: 'preference_opt_out',
      actorType: 'USER',
      actorUserId: user.id,
    })
    return { skipped: 'disabled' }
  }
  const template = buildProfileUpdatedTemplate()
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'product',
    log: {
      eventType: 'PROFILE_UPDATED',
      severity: 'INFO',
      userId: user.id,
      required: false,
      preferenceSnapshot,
      actorType: 'USER',
      actorUserId: user.id,
    },
  })
}

const notifyFeatureUpdateBroadcast = async ({ users, title, summary, actor }) => {
  const template = buildFeatureUpdateTemplate({ title, summary })
  const results = []
  for (const user of users || []) {
    if (!user?.email || !user?.id) continue
    const prefs = await ensurePrefsForUser(user.id, { updatedByUserId: user.id })
    const preferenceSnapshot = buildPreferenceSnapshot(prefs)
    if (!shouldSendOptional(prefs, 'emailFeatureUpdatesEnabled')) {
      await logSkippedEmail({
        user,
        eventType: 'FEATURE_UPDATE',
        severity: 'INFO',
        required: false,
        preferenceSnapshot,
        metadata: { title: title || null },
        actorType: actor?.type || 'ADMIN',
        actorUserId: actor?.id || null,
        failureReason: 'preference_opt_out',
      })
      continue
    }
    results.push(
      sendNotificationEmail({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        category: 'product',
        log: {
          eventType: 'FEATURE_UPDATE',
          severity: 'INFO',
          userId: user.id,
          required: false,
          preferenceSnapshot,
          metadata: { title: title || null },
          actorType: actor?.type || 'ADMIN',
          actorUserId: actor?.id || null,
        },
      })
    )
  }
  const settled = await Promise.allSettled(results)
  return { delivery: settled }
}

const notifyMarketingBroadcast = async ({ users, title, summary, actor }) => {
  const template = buildMarketingTemplate({ title, summary })
  const results = []
  for (const user of users || []) {
    if (!user?.email || !user?.id) continue
    const prefs = await ensurePrefsForUser(user.id, { updatedByUserId: user.id })
    const preferenceSnapshot = buildPreferenceSnapshot(prefs)
    if (!shouldSendOptional(prefs, 'emailMarketingEnabled')) {
      await logSkippedEmail({
        user,
        eventType: 'MARKETING',
        severity: 'INFO',
        required: false,
        preferenceSnapshot,
        metadata: { title: title || null },
        actorType: actor?.type || 'ADMIN',
        actorUserId: actor?.id || null,
        failureReason: 'preference_opt_out',
      })
      continue
    }
    results.push(
      sendNotificationEmail({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        category: 'marketing',
        log: {
          eventType: 'MARKETING',
          severity: 'INFO',
          userId: user.id,
          required: false,
          preferenceSnapshot,
          metadata: { title: title || null },
          actorType: actor?.type || 'ADMIN',
          actorUserId: actor?.id || null,
        },
      })
    )
  }
  const settled = await Promise.allSettled(results)
  return { delivery: settled }
}

module.exports = {
  notifyLoginAlert,
  notifyPasswordChanged,
  notifyEmailChanged,
  notifyLegalUpdate,
  notifyProfileShared,
  notifyProfileAccessRevoked,
  notifyProfileUpdatedByRecipient,
  notifyProfileUpdated,
  notifyFeatureUpdateBroadcast,
  notifyMarketingBroadcast,
}
