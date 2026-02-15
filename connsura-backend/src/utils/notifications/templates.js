const normalizeBaseUrl = (value) => {
  if (!value) return ''
  return String(value).replace(/\/+$/, '')
}

const getFrontendBaseUrl = () =>
  normalizeBaseUrl(process.env.FRONTEND_URL || 'http://localhost:5173')

const getSettingsUrl = () => `${getFrontendBaseUrl()}/client/dashboard?tab=settings&settings=notifications`

const formatDateTime = (value) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const buildFooterText = ({ includeSettings = true, includeContact = true, extraLine } = {}) => {
  const lines = []
  if (includeContact) {
    lines.push('Contact: contact@connsura.com')
  }
  if (includeSettings) {
    lines.push(`Settings: ${getSettingsUrl()}`)
  }
  if (extraLine) {
    lines.push(extraLine)
  }
  return lines.length ? `\n\n${lines.join('\n')}` : ''
}

const buildFooterHtml = ({ includeSettings = true, includeContact = true, extraLine } = {}) => {
  const lines = []
  if (includeContact) {
    lines.push('<div>Contact: <a href="mailto:contact@connsura.com">contact@connsura.com</a></div>')
  }
  if (includeSettings) {
    lines.push(`<div>Settings: <a href="${getSettingsUrl()}">${getSettingsUrl()}</a></div>`)
  }
  if (extraLine) {
    lines.push(`<div>${extraLine}</div>`)
  }
  if (!lines.length) return ''
  return `
    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
      ${lines.join('')}
    </div>
  `
}

const wrapHtml = (title, bodyHtml, footerHtml = '') => `
  <div style="font-family: Arial, sans-serif; color: #111827;">
    <h2 style="margin: 0 0 12px 0; font-size: 20px;">${title}</h2>
    <div style="font-size: 14px; line-height: 1.5;">
      ${bodyHtml}
    </div>
    ${footerHtml}
  </div>
`

const buildLoginAlertTemplate = ({ time, ip, location, device, resetUrl }) => {
  const subject = 'New sign-in detected'
  const formattedTime = formatDateTime(time) || 'Unknown time'
  const lines = [
    'We detected a new sign-in to your Connsura account.',
    '',
    `Time: ${formattedTime}`,
    `IP address: ${ip || 'Unknown'}`,
    `Location: ${location || 'Location unavailable'}`,
    `Device/Browser: ${device || 'Unknown device'}`,
    '',
    `If this wasn't you, reset your password: ${resetUrl}`,
  ]

  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">We detected a new sign-in to your Connsura account.</p>
    <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
    <p style="margin: 0 0 8px 0;"><strong>IP address:</strong> ${ip || 'Unknown'}</p>
    <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${location || 'Location unavailable'}</p>
    <p style="margin: 0 0 12px 0;"><strong>Device/Browser:</strong> ${device || 'Unknown device'}</p>
    <p style="margin: 0;"><a href="${resetUrl}">Reset your password</a> if this wasn't you.</p>
  `

  const footerHtml = buildFooterHtml({ includeSettings: false, includeContact: true })
  return {
    subject,
    text: `${lines.join('\n')}${buildFooterText({ includeSettings: false, includeContact: true })}`,
    html: wrapHtml('New sign-in detected', bodyHtml, footerHtml),
  }
}

const buildPasswordChangedTemplate = () => {
  const subject = 'Your Connsura password was changed'
  const text =
    'Your password was successfully changed.\n\nIf this was not you, reset your password immediately.'
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Your password was successfully changed.</p>
    <p style="margin: 0;">If this was not you, reset your password immediately.</p>
  `
  const footerHtml = buildFooterHtml({ includeSettings: false, includeContact: true })
  return {
    subject,
    text: `${text}${buildFooterText({ includeSettings: false, includeContact: true })}`,
    html: wrapHtml('Password changed', bodyHtml, footerHtml),
  }
}

const buildEmailChangedTemplate = ({ previousEmail }) => {
  const subject = 'Your Connsura email was changed'
  const textLines = [
    'Your account email was updated.',
  ]
  if (previousEmail) {
    textLines.push(`Previous email: ${previousEmail}`)
  }
  textLines.push('If this was not you, reset your password immediately.')
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Your account email was updated.</p>
    ${previousEmail ? `<p style="margin: 0 0 12px 0;"><strong>Previous email:</strong> ${previousEmail}</p>` : ''}
    <p style="margin: 0;">If this was not you, reset your password immediately.</p>
  `
  const footerHtml = buildFooterHtml({ includeSettings: false, includeContact: true })
  return {
    subject,
    text: `${textLines.join('\n')}${buildFooterText({ includeSettings: false, includeContact: true })}`,
    html: wrapHtml('Email changed', bodyHtml, footerHtml),
  }
}

const buildLegalUpdateTemplate = ({ docLabel, publishedAt }) => {
  const subject = 'Connsura policy update'
  const formatted = formatDateTime(publishedAt) || 'just now'
  const text = `We've updated our ${docLabel} on ${formatted}. Please review the latest version in your account.`
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">We've updated our ${docLabel}.</p>
    <p style="margin: 0 0 12px 0;"><strong>Published:</strong> ${formatted}</p>
    <p style="margin: 0;">Please review the latest version in your account.</p>
  `
  return {
    subject,
    text: `${text}${buildFooterText({ includeSettings: true, includeContact: true })}`,
    html: wrapHtml('Policy update', bodyHtml, buildFooterHtml({ includeSettings: true, includeContact: true })),
  }
}

const buildProfileSharedTemplate = ({ recipientName }) => {
  const subject = 'Your profile was shared'
  const textLines = ['Your insurance profile was shared.']
  if (recipientName) {
    textLines.push(`Recipient: ${recipientName}`)
  }
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Your insurance profile was shared.</p>
    ${recipientName ? `<p style="margin: 0;"><strong>Recipient:</strong> ${recipientName}</p>` : ''}
  `
  return {
    subject,
    text: `${textLines.join('\n')}${buildFooterText({ includeSettings: true, includeContact: true })}`,
    html: wrapHtml('Profile shared', bodyHtml, buildFooterHtml({ includeSettings: true, includeContact: true })),
  }
}

const buildProfileAccessRevokedTemplate = ({ recipientName }) => {
  const subject = 'Profile access revoked'
  const textLines = ['Access to your shared profile was revoked.']
  if (recipientName) {
    textLines.push(`Recipient: ${recipientName}`)
  }
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Access to your shared profile was revoked.</p>
    ${recipientName ? `<p style="margin: 0;"><strong>Recipient:</strong> ${recipientName}</p>` : ''}
  `
  return {
    subject,
    text: `${textLines.join('\n')}${buildFooterText({ includeSettings: true, includeContact: true })}`,
    html: wrapHtml('Access revoked', bodyHtml, buildFooterHtml({ includeSettings: true, includeContact: true })),
  }
}

const buildProfileUpdatedByRecipientTemplate = ({ recipientName }) => {
  const subject = 'Profile updated by recipient'
  const textLines = ['A recipient submitted updates to your shared profile.']
  if (recipientName) {
    textLines.push(`Recipient: ${recipientName}`)
  }
  textLines.push('Review the changes in your dashboard.')
  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">A recipient submitted updates to your shared profile.</p>
    ${recipientName ? `<p style="margin: 0 0 12px 0;"><strong>Recipient:</strong> ${recipientName}</p>` : ''}
    <p style="margin: 0;">Review the changes in your dashboard.</p>
  `
  return {
    subject,
    text: `${textLines.join('\n')}${buildFooterText({ includeSettings: true, includeContact: true })}`,
    html: wrapHtml('Profile updates received', bodyHtml, buildFooterHtml({ includeSettings: true, includeContact: true })),
  }
}

const buildProfileUpdatedTemplate = () => {
  const subject = 'Your insurance profile was updated'
  const text = 'We saved updates to your insurance profile.'
  const bodyHtml = `<p style="margin: 0;">We saved updates to your insurance profile.</p>`
  return {
    subject,
    text: `${text}${buildFooterText({ includeSettings: true, includeContact: true })}`,
    html: wrapHtml('Profile updated', bodyHtml, buildFooterHtml({ includeSettings: true, includeContact: true })),
  }
}

const buildFeatureUpdateTemplate = ({ title, summary }) => {
  const subject = title || 'New Connsura features and improvements'
  const text = summary || 'We have new features and important improvements to share.'
  const bodyHtml = `
    <p style="margin: 0;">${summary || 'We have new features and important improvements to share.'}</p>
  `
  return {
    subject,
    text: `${text}${buildFooterText({ includeSettings: true, includeContact: true })}`,
    html: wrapHtml('Product update', bodyHtml, buildFooterHtml({ includeSettings: true, includeContact: true })),
  }
}

const buildMarketingTemplate = ({ title, summary }) => {
  const subject = title || 'Connsura tips, announcements & offers'
  const text = summary || 'Occasional helpful updates and platform news.'
  const extraLine = 'You can turn off marketing emails in Settings -> Notifications.'
  const bodyHtml = `
    <p style="margin: 0;">${summary || 'Occasional helpful updates and platform news.'}</p>
  `
  return {
    subject,
    text: `${text}${buildFooterText({ includeSettings: true, includeContact: true, extraLine })}`,
    html: wrapHtml(
      'Tips & offers',
      bodyHtml,
      buildFooterHtml({ includeSettings: true, includeContact: true, extraLine })
    ),
  }
}

module.exports = {
  getSettingsUrl,
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
}
