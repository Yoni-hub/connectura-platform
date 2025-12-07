const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'connectura_dev_secret'
const JWT_EXPIRY = '7d'

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

module.exports = { generateToken, verifyToken }
