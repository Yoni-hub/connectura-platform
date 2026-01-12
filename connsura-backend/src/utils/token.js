const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required')
}
const JWT_EXPIRY = '7d'

function generateToken(payload, options = {}) {
  const expiresIn = options.expiresIn || JWT_EXPIRY
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

module.exports = { generateToken, verifyToken }
