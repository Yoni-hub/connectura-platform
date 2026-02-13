const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')

const router = express.Router()
const enableAgentFeatures = false

router.post('/agents/:id/quote', authGuard, async (req, res) => {
  if (!enableAgentFeatures) {
    return res.status(404).json({ error: 'Not found' })
  }
  const agentId = Number(req.params.id)
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  const payload = {
    price: req.body.price || '$120/mo',
    coverages: req.body.coverages || ['Liability 100/300', 'Comp/Coll 500/500'],
    notes: req.body.notes || 'Quote generated via placeholder flow.',
  }
  res.json({ quote: payload, agent: { id: agent.id, name: agent.name } })
})

router.get('/agents/:id/summary', async (req, res) => {
  if (!enableAgentFeatures) {
    return res.status(404).json({ error: 'Not found' })
  }
  const agentId = Number(req.params.id)
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) return res.status(404).json({ error: 'Agent not found' })
  res.json({
    summary: {
      carrier: 'Progressive',
      liability: '100/300',
      deductibles: '500/500',
      premium: '$132/month',
      billingDate: '15th of each month',
      notes: 'Placeholder post-sale summary payload.',
    },
    agent: { id: agent.id, name: agent.name },
  })
})

module.exports = router
