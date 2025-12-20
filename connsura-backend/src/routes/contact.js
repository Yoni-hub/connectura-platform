const express = require('express')

const router = express.Router()

router.post('/', (req, res) => {
  const { email, message } = req.body
  if (!email || !message) {
    return res.status(400).json({ error: 'Email and message are required' })
  }
  console.log('Contact message received', { email, message })
  return res.status(201).json({ status: 'received' })
})

module.exports = router
