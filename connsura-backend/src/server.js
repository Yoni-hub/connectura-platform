require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const bcrypt = require('bcrypt')
const http = require('http')

const authRoutes = require('../login_signup_system/auth')
const customerRoutes = require('./routes/customers')
const contactRoutes = require('./routes/contact')
const adminRoutes = require('./routes/admin')
const questionRoutes = require('./routes/questions')
const shareRoutes = require('./routes/shares')
const siteContentRoutes = require('./routes/siteContent')
const formSchemaRoutes = require('./routes/formSchema')
const productRoutes = require('./routes/products')
const legalRoutes = require('./routes/legal')
const errorRoutes = require('./routes/errors')
const prisma = require('./prisma')
const { questionBank, buildQuestionRecords } = require('./utils/questionBank')
const { ensureLegalDocuments } = require('./utils/legalDocuments')

const PORT = process.env.PORT || 8000
const HOST = process.env.HOST || '127.0.0.1'
const createApp = () => {
  const app = express()
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    })
  )
  app.use(express.json({ limit: '2mb' }))
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Connsura API' })
  })

  app.use('/auth', authRoutes)
  app.use('/customers', customerRoutes)
  app.use('/contact', contactRoutes)
  app.use('/admin', adminRoutes)
  app.use('/questions', questionRoutes)
  app.use('/shares', shareRoutes)
  app.use('/legal', legalRoutes)
  app.use('/site-content', siteContentRoutes)
  app.use('/form-schema', formSchemaRoutes)
  app.use('/products', productRoutes)
  app.use('/errors', errorRoutes)

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' })
  })

  app.use((err, req, res, next) => {
    console.error('API error', err)
    res.status(500).json({ error: 'Internal server error', detail: err.message })
  })

  return app
}

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

async function ensureQuestionBank() {
  const count = await prisma.questionBank.count({ where: { source: 'SYSTEM' } })
  if (count) return
  const records = buildQuestionRecords(questionBank, 'SYSTEM').map((record, index) => ({
    ...record,
    sortOrder: index + 1,
  }))
  if (!records.length) return
  await prisma.questionBank.createMany({ data: records, skipDuplicates: true })
  console.log(`Seeded ${records.length} system questions.`)
}

const createServer = () => {
  const app = createApp()
  const server = http.createServer(app)
  return { app, server }
}

if (require.main === module) {
  const { server } = createServer()
  Promise.all([ensureAdminSeed(), ensureQuestionBank(), ensureLegalDocuments(prisma)])
    .catch((err) => console.error('Startup seed error', err))
    .finally(() => {
      server.listen(PORT, HOST, () => {
        console.log(`Connsura API running on http://${HOST}:${PORT}`)
      })
    })
}

module.exports = { createApp, createServer }
