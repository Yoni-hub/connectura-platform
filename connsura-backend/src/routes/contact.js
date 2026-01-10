const express = require('express')
const { sendEmail } = require('../utils/emailClient')

const router = express.Router()

router.post('/', (req, res) => {
  const { email, message } = req.body
  if (!email || !message) {
    return res.status(400).json({ error: 'Email and message are required' })
  }
  const supportInbox = process.env.EMAIL_SUPPORT_INBOX || process.env.SUPPORT_EMAIL || 'support@connsura.com'

  sendEmail({
    to: supportInbox,
    subject: 'New Connsura contact message',
    text: `From: ${email}\n\n${message}`,
    replyTo: email,
  })
    .then((result) => res.status(201).json({ status: 'received', delivery: result.delivery }))
    .catch((err) => {
      console.error('contact email send error', { error: err.message })
      res.status(202).json({ status: 'received', delivery: 'failed' })
    })
})

module.exports = router
