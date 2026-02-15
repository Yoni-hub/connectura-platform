const { sendEmail } = require('../emailClient')

const CATEGORY_REPLY_TO = {
  security: 'security@connsura.com',
  legal: 'legal@connsura.com',
  privacy: 'privacy@connsura.com',
  product: 'support@connsura.com',
  marketing: 'info@connsura.com',
}

const DEFAULT_FROM =
  process.env.NOTIFICATION_FROM || 'Connsura (contact@connsura.com) <noreply@connsura.com>'

const sendNotificationEmail = async ({ to, subject, text, html, category, replyTo }) => {
  const resolvedReplyTo = replyTo || CATEGORY_REPLY_TO[category] || undefined
  return sendEmail({
    to,
    subject,
    text,
    html,
    from: DEFAULT_FROM,
    replyTo: resolvedReplyTo,
    category,
  })
}

module.exports = {
  CATEGORY_REPLY_TO,
  sendNotificationEmail,
}
