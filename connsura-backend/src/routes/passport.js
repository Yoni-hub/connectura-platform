const express = require('express')
const { authGuard } = require('../middleware/auth')
const {
  listInstances,
  createAdminInstance,
  createCustomInstance,
  replaceCustomQuestions,
  deleteInstance,
  getSchemaProducts,
  getSchemaQuestions,
  getProductForm,
  saveSectionValues,
  loadSectionValues,
} = require('../my-insurance-passport/passportService')

const router = express.Router()

router.use(authGuard)

router.get('/schema/products', async (req, res) => {
  const products = await getSchemaProducts()
  res.json({ products })
})

router.get('/schema/questions', async (req, res) => {
  const questions = await getSchemaQuestions()
  res.json({ questions })
})

router.get('/products', async (req, res) => {
  const products = await listInstances(req.user.id)
  res.json({ products })
})

router.post('/products/admin', async (req, res) => {
  const adminProductId = Number(req.body?.adminProductId)
  if (!adminProductId) {
    return res.status(400).json({ error: 'adminProductId is required' })
  }
  const result = await createAdminInstance(req.user.id, adminProductId)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.status(201).json({ product: result.instance })
})

router.post('/products/custom', async (req, res) => {
  const result = await createCustomInstance(req.user.id, req.body?.productName)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.status(201).json({ product: result.instance })
})

router.put('/products/:productInstanceId/custom-questions', async (req, res) => {
  const productInstanceId = String(req.params.productInstanceId || '').trim()
  if (!productInstanceId) return res.status(400).json({ error: 'productInstanceId is required' })
  const questions = Array.isArray(req.body?.questions) ? req.body.questions : null
  if (!questions) return res.status(400).json({ error: 'questions array is required' })
  const result = await replaceCustomQuestions(req.user.id, productInstanceId, questions)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json({ ok: true })
})

router.delete('/products/:productInstanceId', async (req, res) => {
  const productInstanceId = String(req.params.productInstanceId || '').trim()
  if (!productInstanceId) return res.status(400).json({ error: 'productInstanceId is required' })
  const result = await deleteInstance(req.user.id, productInstanceId)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json({ ok: true })
})

router.get('/products/:productInstanceId/form', async (req, res) => {
  const productInstanceId = String(req.params.productInstanceId || '').trim()
  if (!productInstanceId) return res.status(400).json({ error: 'productInstanceId is required' })
  const result = await getProductForm(req.user.id, productInstanceId)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json(result)
})

router.post('/products/:productInstanceId/section-save', async (req, res) => {
  const productInstanceId = String(req.params.productInstanceId || '').trim()
  if (!productInstanceId) return res.status(400).json({ error: 'productInstanceId is required' })
  const sectionKey = req.body?.sectionKey
  const values = req.body?.values
  const result = await saveSectionValues(req.user.id, productInstanceId, sectionKey, values)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json(result)
})

router.post('/products/:productInstanceId/section-load', async (req, res) => {
  const productInstanceId = String(req.params.productInstanceId || '').trim()
  if (!productInstanceId) return res.status(400).json({ error: 'productInstanceId is required' })
  const sectionKey = req.body?.sectionKey
  const result = await loadSectionValues(req.user.id, productInstanceId, sectionKey)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json(result)
})

module.exports = router
