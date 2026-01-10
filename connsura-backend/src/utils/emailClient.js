const nodemailer = require('nodemailer')

let cachedTransporter = null

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter

  const smtpUrl = process.env.SMTP_URL
  if (smtpUrl) {
    cachedTransporter = nodemailer.createTransport(smtpUrl)
    return cachedTransporter
  }

  const host = process.env.SMTP_HOST || process.env.SES_SMTP_HOST
  if (!host) return null

  const port = Number(process.env.SMTP_PORT || process.env.SES_SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  const user = process.env.SMTP_USER || process.env.SES_SMTP_USER
  const pass = process.env.SMTP_PASS || process.env.SES_SMTP_PASS

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })

  return cachedTransporter
}

const getDefaultFrom = () => process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@connsura.com'

const getDefaultReplyTo = () => process.env.EMAIL_REPLY_TO || process.env.SMTP_REPLY_TO || undefined

const sendEmail = async ({ to, subject, text, html, from, replyTo }) => {
  const transport = getTransporter()
  if (!transport) {
    return { delivery: 'disabled' }
  }

  await transport.sendMail({
    from: from || getDefaultFrom(),
    to,
    subject,
    text,
    html,
    replyTo: replyTo || getDefaultReplyTo(),
  })

  return { delivery: 'smtp' }
}

module.exports = {
  getTransporter,
  sendEmail,
}
