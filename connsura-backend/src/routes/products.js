const express = require('express')
const prisma = require('../prisma')

const router = express.Router()

router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  res.json({ products })
})

module.exports = router
