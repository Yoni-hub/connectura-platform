const express = require('express')
const prisma = require('../prisma')
const { buildQuestionRecords, normalizeQuestion } = require('../utils/questionBank')

const router = express.Router()

router.get('/search', async (req, res) => {
  try {
    const query = (req.query.query || '').toString().trim()
    if (!query) {
      return res.json({ results: [] })
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 25)
    const normalized = normalizeQuestion(query)
    if (!normalized) {
      return res.json({ results: [] })
    }
    const results = await prisma.questionBank.findMany({
      where: {
        normalized: {
          contains: normalized,
        },
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

router.post('/customer', async (req, res) => {
  try {
    const payload = Array.isArray(req.body?.questions) ? req.body.questions : []
    const records = buildQuestionRecords(payload, 'CUSTOMER')
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
