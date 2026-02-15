const nodemailer = require('nodemailer')
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

let cachedTransporter = null
let cachedSesClient = null

const getSesRegion = () =>
  process.env.SES_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || ''

const getSesClient = () => {
  if (cachedSesClient) return cachedSesClient
  const region = getSesRegion()
  if (!region) return null
  cachedSesClient = new SESClient({ region })
  return cachedSesClient
}

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

const DEFAULT_FROM =
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  'Connsura (contact@connsura.com) <noreply@connsura.com>'

const getDefaultFrom = () => DEFAULT_FROM

const getDefaultReplyTo = () => process.env.EMAIL_REPLY_TO || process.env.SMTP_REPLY_TO || undefined

const isDryRun = () =>
  String(process.env.SES_DRY_RUN || '').toLowerCase() === 'true' ||
  process.env.NODE_ENV === 'test'

const normalizeList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return [value]
}

const sendSesEmail = async ({ to, subject, text, html, from, replyTo }) => {
  const client = getSesClient()
  if (!client) return null
  const toAddresses = normalizeList(to)
  if (!toAddresses.length) return null

  const command = new SendEmailCommand({
    Source: from || getDefaultFrom(),
    Destination: { ToAddresses: toAddresses },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Message: {
      Subject: { Data: subject || '', Charset: 'UTF-8' },
      Body: {
        Text: text ? { Data: text, Charset: 'UTF-8' } : undefined,
        Html: html ? { Data: html, Charset: 'UTF-8' } : undefined,
      },
    },
  })

  await client.send(command)
  return { delivery: 'ses' }
}

const sendEmail = async ({ to, subject, text, html, from, replyTo, category }) => {
  const payload = {
    to,
    subject,
    text,
    html,
    from: from || getDefaultFrom(),
    replyTo: replyTo || getDefaultReplyTo(),
    category: category || undefined,
  }

  if (isDryRun()) {
    console.log('[ses-dry-run] email payload', {
      to: payload.to,
      subject: payload.subject,
      from: payload.from,
      replyTo: payload.replyTo,
      category: payload.category,
    })
    return { delivery: 'dry-run' }
  }

  const sesResult = await sendSesEmail(payload)
  if (sesResult) return sesResult

  const transport = getTransporter()
  if (!transport) {
    return { delivery: 'disabled' }
  }

  const { category: _category, ...mailPayload } = payload
  await transport.sendMail(mailPayload)
  return { delivery: 'smtp' }
}

module.exports = {
  getTransporter,
  getSesClient,
  sendEmail,
}
