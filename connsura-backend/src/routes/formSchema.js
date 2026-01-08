const express = require('express')
const prisma = require('../prisma')
const { DEFAULT_CREATE_PROFILE_SCHEMA } = require('../utils/formSchema')

const router = express.Router()

const fallbackSchema = (slug) => {
  if (slug === 'create-profile') return DEFAULT_CREATE_PROFILE_SCHEMA
  return null
}

const formatSchema = (entry) => ({
  slug: entry.slug,
  schema: JSON.parse(entry.schema),
  updatedBy: entry.updatedBy,
  updatedAt: entry.updatedAt,
})

router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ error: 'Slug is required' })

  const entry = await prisma.formSchema.findUnique({ where: { slug } })
  if (entry) {
    return res.json({ schema: formatSchema(entry) })
  }

  const fallback = fallbackSchema(slug)
  if (!fallback) {
    return res.status(404).json({ error: 'Schema not found' })
  }

  try {
    const created = await prisma.formSchema.create({
      data: {
        slug,
        schema: JSON.stringify(fallback),
        updatedBy: 'system',
      },
    })
    return res.json({ schema: formatSchema(created) })
  } catch (err) {
    return res.json({
      schema: {
        slug,
        schema: fallback,
        updatedBy: 'system',
        updatedAt: null,
      },
    })
  }
})

module.exports = router
