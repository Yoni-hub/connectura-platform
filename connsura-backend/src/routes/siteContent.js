const express = require('express')
const prisma = require('../prisma')
const { getDefaultContent } = require('../utils/siteContent')

const router = express.Router()

const formatContent = (entry) => ({
  slug: entry.slug,
  title: entry.title,
  content: entry.content,
  lastUpdated: entry.lastUpdated,
  updatedBy: entry.updatedBy,
})

router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ error: 'Slug is required' })
  const entry = await prisma.siteContent.findUnique({ where: { slug } })
  if (entry) {
    return res.json({ content: formatContent(entry) })
  }
  const fallback = getDefaultContent(slug)
  if (!fallback) {
    return res.status(404).json({ error: 'Content not found' })
  }
  try {
    const created = await prisma.siteContent.create({
      data: {
        slug: fallback.slug,
        title: fallback.title,
        content: fallback.content,
        updatedBy: 'system',
      },
    })
    return res.json({ content: formatContent(created) })
  } catch (err) {
    return res.json({
      content: {
        slug: fallback.slug,
        title: fallback.title,
        content: fallback.content,
        lastUpdated: null,
        updatedBy: 'system',
      },
    })
  }
})

module.exports = router
