const express = require('express')
const router = express.Router()

router.get('/', async (req, res) => {
  return res.status(410).json({
    error: 'Legacy products endpoint is deprecated',
    code: 'LEGACY_FORM_FLOW_DEPRECATED',
    replacement: '/passport/schema/products',
  })
})

module.exports = router
