require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const bcrypt = require('bcrypt')

const authRoutes = require('../login_signup_system/auth')
const agentRoutes = require('./routes/agents')
const customerRoutes = require('./routes/customers')
const searchRoutes = require('./routes/search')
const quoteRoutes = require('./routes/quotes')
const contactRoutes = require('./routes/contact')
const adminRoutes = require('./routes/admin')
const messageRoutes = require('./routes/messages')
const prisma = require('./prisma')

const app = express()
const PORT = process.env.PORT || 8000
const HOST = process.env.HOST || '127.0.0.1'

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))
app.use('/forms', express.static(path.join(__dirname, '..', 'forms')))

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Connsura API' })
})

app.use('/auth', authRoutes)
app.use('/agents', agentRoutes)
app.use('/customers', customerRoutes)
app.use('/search', searchRoutes)
app.use('/', quoteRoutes)
app.use('/contact', contactRoutes)
app.use('/admin', adminRoutes)
app.use('/messages', messageRoutes)

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, req, res, next) => {
  console.error('API error', err)
  res.status(500).json({ error: 'Internal server error', detail: err.message })
})

async function ensureAdminSeed() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin seed.')
    return
  }
  const existing = await prisma.adminUser.findUnique({ where: { email } })
  if (existing) return
  const hashed = await bcrypt.hash(password, 10)
  await prisma.adminUser.create({
    data: {
      email,
      password: hashed,
      role: 'ADMIN',
    },
  })
  console.log(`Seeded admin user at ${email} (please change default password).`)
}

ensureAdminSeed()
  .catch((err) => console.error('Admin seed error', err))
  .finally(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Connsura API running on http://${HOST}:${PORT}`)
    })
  })
