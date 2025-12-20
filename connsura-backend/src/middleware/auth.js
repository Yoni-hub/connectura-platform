const prisma = require('../prisma')
const { verifyToken } = require('../utils/token')

async function authGuard(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' })
  }

  const token = header.replace('Bearer ', '')
  try {
    const decoded = verifyToken(token)
    const user = await prisma.user.findUnique({ where: { id: decoded.id } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

async function adminGuard(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' })
  }
  const token = header.replace('Bearer ', '')
  try {
    const decoded = verifyToken(token)
    if (!(decoded.type === 'ADMIN' || decoded.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const adminId = decoded.adminId || decoded.id
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })
    if (!admin) return res.status(401).json({ error: 'Invalid token' })
    req.admin = admin
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

module.exports = { authGuard, adminGuard }
