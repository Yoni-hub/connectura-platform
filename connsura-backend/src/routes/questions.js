const express = require('express')
const prisma = require('../prisma')
const { buildCustomerQuestionRecords, normalizeQuestion } = require('../utils/questionBank')
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
    const systemQuestions = await prisma.questionBank.findMany({
      where: { productId, source: 'SYSTEM' },
      orderBy: { id: 'asc' },
    })
    const customerQuestions = customerId
      ? await prisma.customerQuestion.findMany({
          where: { productId, customerId },
          orderBy: { id: 'asc' },
        })
      : []
    return res.json({
      questions: [
        ...systemQuestions.map((row) => ({ id: row.id, text: row.text, source: 'SYSTEM' })),
        ...customerQuestions.map((row) => ({ id: row.id, text: row.text, source: 'CUSTOMER' })),
      ],
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
    const systemResults = await prisma.questionBank.findMany({
      where: {
        normalized: {
          contains: normalized,
        },
        ...(productId ? { productId } : {}),
        source: 'SYSTEM',
      },
      orderBy: [{ text: 'asc' }],
      take: limit,
    })
    const customerResults = customerId
      ? await prisma.customerQuestion.findMany({
          where: {
            normalized: {
              contains: normalized,
            },
            ...(productId ? { productId } : {}),
            customerId,
          },
          orderBy: [{ text: 'asc' }],
          take: limit,
        })
      : []
    const deduped = new Map()
    systemResults.forEach((row) => {
      deduped.set(row.normalized, { id: row.id, text: row.text, source: 'SYSTEM' })
    })
    customerResults.forEach((row) => {
      if (!deduped.has(row.normalized)) {
        deduped.set(row.normalized, { id: row.id, text: row.text, source: 'CUSTOMER' })
      }
    })
    const results = Array.from(deduped.values()).slice(0, limit)
    return res.json({
      results,
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
    const formName = String(req.body?.formName || '').trim()
    if (!productId && !formName) {
      return res.status(400).json({ error: 'Form name is required for custom questions' })
    }
    let resolvedFormName = formName
    if (!resolvedFormName && productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } })
      resolvedFormName = product?.name || ''
    }
    if (!resolvedFormName) {
      return res.status(400).json({ error: 'Form name is required' })
    }
    const records = buildCustomerQuestionRecords(payload, productId || null, customer.id, resolvedFormName)
    if (!records.length) {
      return res.json({ created: 0 })
    }
    const result = await prisma.customerQuestion.createMany({
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
