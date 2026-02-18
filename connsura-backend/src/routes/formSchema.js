const express = require('express')
const prisma = require('../prisma')

const router = express.Router()

const formatSchema = (entry) => ({
  slug: entry.slug,
  schema: JSON.parse(entry.schema),
  updatedBy: entry.updatedBy,
  updatedAt: entry.updatedAt,
})

router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim()
  if (!slug) return res.status(400).json({ error: 'Slug is required' })
  if (slug === 'create-profile') {
    return res.status(410).json({
      error: 'Legacy create-profile schema endpoint is deprecated',
      code: 'LEGACY_FORM_FLOW_DEPRECATED',
      replacement: '/passport/schema/products',
    })
  }

  const entry = await prisma.formSchema.findUnique({ where: { slug } })
  if (entry) {
    return res.json({ schema: formatSchema(entry) })
  }
  return res.status(404).json({ error: 'Schema not found' })
})

module.exports = router
