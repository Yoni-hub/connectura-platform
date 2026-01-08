const express = require('express')
const prisma = require('../prisma')
const { buildQuestionRecords, normalizeQuestion } = require('../utils/questionBank')
const { authGuard } = require('../middleware/auth')
const { verifyToken } = require('../utils/token')

const router = express.Router()

const resolveCustomerId = async (req) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  try {
    const token = header.replace('Bearer ', '')
    const decoded = verifyToken(token)
    const customer = await prisma.customer.findUnique({ where: { userId: decoded.id } })
    return customer?.id || null
  } catch (error) {
    return null
  }
}

router.get('/product', async (req, res) => {
  try {
    const productId = req.query.productId ? Number(req.query.productId) : null
    if (!productId) {
      return res.json({ questions: [] })
    }
    const customerId = await resolveCustomerId(req)
    const where = customerId
      ? { productId, OR: [{ source: 'SYSTEM' }, { customerId }] }
      : { productId, source: 'SYSTEM' }
    const questions = await prisma.questionBank.findMany({
      where,
      orderBy: [{ source: 'desc' }, { text: 'asc' }],
    })
    return res.json({
      questions: questions.map((row) => ({ id: row.id, text: row.text, source: row.source })),
    })
  } catch (error) {
    console.error('Question bank load error', error)
    return res.status(500).json({ error: 'Load failed' })
  }
})

router.get('/search', async (req, res) => {
  try {
    const query = (req.query.query || '').toString().trim()
    const productId = req.query.productId ? Number(req.query.productId) : null
    if (!query) {
      return res.json({ results: [] })
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 25)
    const normalized = normalizeQuestion(query)
    if (!normalized) {
      return res.json({ results: [] })
    }
    const customerId = await resolveCustomerId(req)
    const results = await prisma.questionBank.findMany({
      where: {
        normalized: {
          contains: normalized,
        },
        ...(productId ? { productId } : {}),
        ...(customerId ? { OR: [{ source: 'SYSTEM' }, { customerId }] } : { source: 'SYSTEM' }),
      },
      orderBy: [
        { source: 'desc' },
        { text: 'asc' },
      ],
      take: limit,
    })
    return res.json({
      results: results.map((row) => ({
        id: row.id,
        text: row.text,
        source: row.source,
      })),
    })
  } catch (error) {
    console.error('Question search error', error)
    return res.status(500).json({ error: 'Search failed' })
  }
})

router.post('/customer', authGuard, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    const payload = Array.isArray(req.body?.questions) ? req.body.questions : []
    const productId = req.body?.productId ? Number(req.body.productId) : null
    const records = buildQuestionRecords(payload, 'CUSTOMER', productId || null, customer.id)
    if (!records.length) {
      return res.json({ created: 0 })
    }
    const result = await prisma.questionBank.createMany({
      data: records,
      skipDuplicates: true,
    })
    return res.json({ created: result.count })
  } catch (error) {
    console.error('Question create error', error)
    return res.status(500).json({ error: 'Create failed' })
  }
})

module.exports = router
