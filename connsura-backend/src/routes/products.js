const express = require('express')
const prisma = require('../prisma')
const { ensureProductCatalog } = require('../utils/productCatalog')

const router = express.Router()

router.get('/', async (req, res) => {
  await ensureProductCatalog(prisma)
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  res.json({ products })
})

module.exports = router
