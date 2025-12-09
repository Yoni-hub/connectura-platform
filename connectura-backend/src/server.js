require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const authRoutes = require('../login_signup_system/auth')
const agentRoutes = require('./routes/agents')
const customerRoutes = require('./routes/customers')
const searchRoutes = require('./routes/search')
const quoteRoutes = require('./routes/quotes')
const contactRoutes = require('./routes/contact')

const app = express()
const PORT = process.env.PORT || 8000

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Connectura API' })
})

app.use('/auth', authRoutes)
app.use('/agents', agentRoutes)
app.use('/customers', customerRoutes)
app.use('/search', searchRoutes)
app.use('/', quoteRoutes)
app.use('/contact', contactRoutes)

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, req, res, next) => {
  console.error('API error', err)
  res.status(500).json({ error: 'Internal server error', detail: err.message })
})

app.listen(PORT, () => {
  console.log(`Connectura API running on http://localhost:${PORT}`)
})
