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

const notifyLoginAlert = async ({ user, ip, userAgent, location }) => {
  if (!user?.email) return { skipped: 'missing_email' }
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
  })
}

const notifyPasswordChanged = async (user) => {
  if (!user?.email) return { skipped: 'missing_email' }
  const template = buildPasswordChangedTemplate()
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'security',
  })
}

const notifyEmailChanged = async ({ user, previousEmail }) => {
  if (!user?.email) return { skipped: 'missing_email' }
  const template = buildEmailChangedTemplate({ previousEmail })
  const deliveries = []
  deliveries.push(
    sendNotificationEmail({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      category: 'security',
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
      })
    )
  }
  const results = await Promise.allSettled(deliveries)
  return { delivery: results }
}

const notifyLegalUpdate = async ({ docLabel, publishedAt, users }) => {
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
      })
    )
  }
  const settled = await Promise.allSettled(results)
  return { delivery: settled }
}

const notifyProfileShared = async ({ user, recipientName }) => {
  if (!user?.email) return { skipped: 'missing_email' }
  const template = buildProfileSharedTemplate({ recipientName })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'privacy',
  })
}

const notifyProfileAccessRevoked = async ({ user, recipientName }) => {
  if (!user?.email) return { skipped: 'missing_email' }
  const template = buildProfileAccessRevokedTemplate({ recipientName })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'privacy',
  })
}

const notifyProfileUpdatedByRecipient = async ({ user, recipientName }) => {
  if (!user?.email) return { skipped: 'missing_email' }
  const template = buildProfileUpdatedByRecipientTemplate({ recipientName })
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'privacy',
  })
}

const notifyProfileUpdated = async ({ user }) => {
  if (!user?.email || !user?.id) return { skipped: 'missing_user' }
  const prefs = await ensurePrefsForUser(user.id, { updatedByUserId: user.id })
  if (!shouldSendOptional(prefs, 'emailProfileUpdatesEnabled')) {
    return { skipped: 'disabled' }
  }
  const template = buildProfileUpdatedTemplate()
  return sendNotificationEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: 'product',
  })
}

const notifyFeatureUpdateBroadcast = async ({ users, title, summary }) => {
  const template = buildFeatureUpdateTemplate({ title, summary })
  const results = []
  for (const user of users || []) {
    if (!user?.email || !user?.id) continue
    const prefs = await ensurePrefsForUser(user.id, { updatedByUserId: user.id })
    if (!shouldSendOptional(prefs, 'emailFeatureUpdatesEnabled')) {
      continue
    }
    results.push(
      sendNotificationEmail({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        category: 'product',
      })
    )
  }
  const settled = await Promise.allSettled(results)
  return { delivery: settled }
}

const notifyMarketingBroadcast = async ({ users, title, summary }) => {
  const template = buildMarketingTemplate({ title, summary })
  const results = []
  for (const user of users || []) {
    if (!user?.email || !user?.id) continue
    const prefs = await ensurePrefsForUser(user.id, { updatedByUserId: user.id })
    if (!shouldSendOptional(prefs, 'emailMarketingEnabled')) {
      continue
    }
    results.push(
      sendNotificationEmail({
        to: user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        category: 'marketing',
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
