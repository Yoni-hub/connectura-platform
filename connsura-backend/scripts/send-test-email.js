const { sendEmail } = require('../src/utils/emailClient')

const to = process.argv[2]
if (!to) {
  console.error('Usage: node scripts/send-test-email.js <recipient-email>')
  process.exit(1)
}

sendEmail({
  to,
  subject: 'Connsura email test',
  text: 'This is a test email from Connsura.',
})
  .then(() => {
    console.log('Test email sent.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Failed to send test email:', err.message)
    process.exit(1)
  })
