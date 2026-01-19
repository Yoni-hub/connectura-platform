const express = require('express')
const { sendEmail } = require('../utils/emailClient')

const router = express.Router()

router.post('/', (req, res) => {
  const { email, message, topic } = req.body
  if (!email || !message) {
    return res.status(400).json({ error: 'Email and message are required' })
  }
  const topicKey = String(topic || 'support').toLowerCase()
  const inboxes = {
    support: process.env.EMAIL_SUPPORT_INBOX || process.env.SUPPORT_EMAIL || 'support@connsura.com',
    agents: process.env.EMAIL_AGENTS_INBOX || 'agents@connsura.com',
    billing: process.env.EMAIL_BILLING_INBOX || 'billing@connsura.com',
    legal: process.env.EMAIL_LEGAL_INBOX || 'legal@connsura.com',
    privacy: process.env.EMAIL_PRIVACY_INBOX || 'privacy@connsura.com',
    security: process.env.EMAIL_SECURITY_INBOX || 'security@connsura.com',
    info: process.env.EMAIL_INFO_INBOX || 'info@connsura.com',
  }
  const labels = {
    support: 'Support',
    agents: 'Agents',
    billing: 'Billing',
    legal: 'Legal',
    privacy: 'Privacy',
    security: 'Security',
    info: 'Info',
  }
  const topicLabel = labels[topicKey] || labels.support
  const supportInbox = inboxes[topicKey] || inboxes.support

  sendEmail({
    to: supportInbox,
    subject: `New Connsura ${topicLabel} message`,
    text: `Topic: ${topicLabel}\nFrom: ${email}\n\n${message}`,
    replyTo: email,
  })
    .then((result) => res.status(201).json({ status: 'received', delivery: result.delivery }))
    .catch((err) => {
      console.error('contact email send error', { error: err.message })
      res.status(202).json({ status: 'received', delivery: 'failed' })
    })
})

module.exports = router
