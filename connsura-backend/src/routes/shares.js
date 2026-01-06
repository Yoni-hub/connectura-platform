const express = require('express')
const crypto = require('crypto')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')

const router = express.Router()

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex')

const generateCode = () => String(crypto.randomInt(0, 10000)).padStart(4, '0')

const generateToken = () => crypto.randomBytes(16).toString('hex')

const ACCESS_TIMEOUT_MS = 10 * 60 * 1000

const collapseSpaces = (value = '') => value.replace(/\s+/g, ' ').trim()

const normalizeRecipientName = (value = '') => collapseSpaces(value).toLowerCase()

const getLastAccessedAt = (share) => share.lastAccessedAt || share.createdAt

const isShareExpired = (share, now = new Date()) => {
  const lastAccessedAt = getLastAccessedAt(share)
  if (!lastAccessedAt) return false
  return now.getTime() - new Date(lastAccessedAt).getTime() > ACCESS_TIMEOUT_MS
}

const formatShare = (share) => ({
  token: share.token,
  sections: parseJson(share.sections, {}),
  snapshot: parseJson(share.snapshot, {}),
  customerId: share.customerId,
  agentId: share.agentId,
  editable: share.editable,
  status: share.status,
  pendingStatus: share.pendingStatus,
  pendingAt: share.pendingAt,
  recipientName: share.recipientName,
  createdAt: share.createdAt,
})

const filterEditsBySections = (edits, sections) => {
  const forms = edits?.forms || {}
  const filtered = {}
  if (sections.household && forms.household) {
    filtered.household = forms.household
  }
  if (sections.address && forms.address) {
    filtered.address = forms.address
  }
  if (sections.vehicle && forms.vehicle) {
    filtered.vehicle = forms.vehicle
  }
  if (sections.business && forms.business) {
    filtered.business = forms.business
  }
  if (sections.additional) {
    if (forms.additional) {
      filtered.additional = forms.additional
    }
  } else if (Array.isArray(sections.additionalIndexes) && forms.additional?.additionalForms) {
    filtered.additional = {
      additionalForms: sections.additionalIndexes
        .map((index) => forms.additional.additionalForms[index]),
    }
  }
  return { forms: filtered }
}

const mergeFormsBySections = (currentForms, edits, sections) => {
  const next = { ...(currentForms || {}) }
  const incoming = edits?.forms || {}
  if (sections.household && incoming.household) {
    next.household = incoming.household
  }
  if (sections.address && incoming.address) {
    next.address = incoming.address
  }
  if (sections.vehicle && incoming.vehicle) {
    next.vehicle = incoming.vehicle
  }
  if (sections.business && incoming.business) {
    next.business = incoming.business
  }
  if (sections.additional && incoming.additional) {
    next.additional = incoming.additional
  } else if (Array.isArray(sections.additionalIndexes) && incoming.additional?.additionalForms) {
    const currentAdditional = next.additional?.additionalForms || []
    const nextAdditional = [...currentAdditional]
    sections.additionalIndexes.forEach((index, position) => {
      if (incoming.additional.additionalForms[position] !== undefined) {
        nextAdditional[index] = incoming.additional.additionalForms[position]
      }
    })
    next.additional = { ...(next.additional || {}), additionalForms: nextAdditional }
  }
  return next
}

router.post('/', authGuard, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can share profiles' })
  }
  if (!req.user.emailVerified) {
    return res.status(403).json({ error: 'Email not verified' })
  }
  const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' })
  }
  const sections = req.body?.sections || {}
  const snapshot = req.body?.snapshot || {}
  const agentId = req.body?.agentId ? Number(req.body.agentId) : null
  const editable = Boolean(req.body?.editable)
  const rawRecipientName = typeof req.body?.recipientName === 'string' ? req.body.recipientName : ''
  const recipientName = collapseSpaces(rawRecipientName)
  const recipientNameNormalized = normalizeRecipientName(rawRecipientName)
  if (agentId && Number.isNaN(agentId)) {
    return res.status(400).json({ error: 'Invalid agent id' })
  }
  if (!agentId && !recipientNameNormalized) {
    return res.status(400).json({ error: 'Recipient name is required' })
  }
  if (agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }
  }

  const token = generateToken()
  const code = generateCode()

  const share = await prisma.profileShare.create({
    data: {
      token,
      codeHash: hashCode(code),
      sections: JSON.stringify(sections || {}),
      snapshot: JSON.stringify(snapshot || {}),
      customerId: customer.id,
      agentId: agentId || null,
      editable,
      recipientName: agentId ? null : recipientName,
      recipientNameNormalized: agentId ? null : recipientNameNormalized,
      lastAccessedAt: new Date(),
    },
  })

  res.status(201).json({ share: formatShare(share), code })
})

router.post('/:token/verify', async (req, res) => {
  const token = String(req.params.token || '').trim()
  const code = String(req.body?.code || '').trim()
  const rawName = String(req.body?.name || '')
  const normalizedName = normalizeRecipientName(rawName)
  const shouldTouch = req.body?.touch !== false
  if (!token) return res.status(400).json({ error: 'Share token is required' })
  if (!code) return res.status(400).json({ error: 'Verification code is required' })
  let share = await prisma.profileShare.findUnique({
    where: { token },
    include: { customer: true },
  })
  if (!share) return res.status(404).json({ error: 'Share not found' })
  if (share.status !== 'active') {
    return res.status(410).json({ error: 'Share session expired' })
  }
  if (isShareExpired(share)) {
    await prisma.profileShare.update({
      where: { token },
      data: { status: 'expired' },
    })
    return res.status(410).json({ error: 'Share session expired' })
  }
  if (hashCode(code) !== share.codeHash) {
    return res.status(400).json({ error: 'Invalid code' })
  }
  if (share.recipientNameNormalized) {
    if (!normalizedName) {
      return res.status(400).json({ error: 'Recipient name is required' })
    }
    if (normalizedName !== share.recipientNameNormalized) {
      return res.status(400).json({ error: 'Recipient name does not match' })
    }
  }
  if (shouldTouch) {
    share = await prisma.profileShare.update({
      where: { token },
      data: { lastAccessedAt: new Date() },
      include: { customer: true },
    })
  }
  res.json({
    share: {
      ...formatShare(share),
      customer: { name: share.customer?.name || '' },
    },
  })
})

router.post('/:token/edits', async (req, res) => {
  const token = String(req.params.token || '').trim()
  const code = String(req.body?.code || '').trim()
  const rawName = String(req.body?.name || '')
  const normalizedName = normalizeRecipientName(rawName)
  if (!token) return res.status(400).json({ error: 'Share token is required' })
  if (!code) return res.status(400).json({ error: 'Verification code is required' })
  const share = await prisma.profileShare.findUnique({ where: { token } })
  if (!share) return res.status(404).json({ error: 'Share not found' })
  if (share.status !== 'active') {
    return res.status(410).json({ error: 'Share session expired' })
  }
  if (isShareExpired(share)) {
    await prisma.profileShare.update({
      where: { token },
      data: { status: 'expired' },
    })
    return res.status(410).json({ error: 'Share session expired' })
  }
  if (!share.editable) {
    return res.status(403).json({ error: 'Editing not enabled for this share' })
  }
  if (hashCode(code) !== share.codeHash) {
    return res.status(400).json({ error: 'Invalid code' })
  }
  if (share.recipientNameNormalized) {
    if (!normalizedName) {
      return res.status(400).json({ error: 'Recipient name is required' })
    }
    if (normalizedName !== share.recipientNameNormalized) {
      return res.status(400).json({ error: 'Recipient name does not match' })
    }
  }
  const sections = parseJson(share.sections, {})
  const edits = req.body?.edits || {}
  const filteredEdits = filterEditsBySections(edits, sections)
  const updated = await prisma.profileShare.update({
    where: { token },
    data: {
      pendingEdits: JSON.stringify(filteredEdits),
      pendingStatus: 'pending',
      pendingAt: new Date(),
      lastAccessedAt: new Date(),
    },
  })
  res.json({ share: formatShare(updated) })
})

router.get('/pending', authGuard, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can review edits' })
  }
  const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' })
  }
  const shares = await prisma.profileShare.findMany({
    where: { customerId: customer.id, pendingStatus: 'pending' },
    include: { agent: true },
    orderBy: { pendingAt: 'desc' },
  })
  res.json({
    shares: shares.map((share) => ({
      ...formatShare(share),
      pendingEdits: parseJson(share.pendingEdits, {}),
      agent: share.agent ? { id: share.agent.id, name: share.agent.name } : null,
      customer: { name: customer.name },
    })),
  })
})

router.get('/active', authGuard, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can view active shares' })
  }
  const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } })
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' })
  }
  const shares = await prisma.profileShare.findMany({
    where: { customerId: customer.id, status: 'active' },
    include: { agent: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({
    shares: shares.map((share) => ({
      ...formatShare(share),
      agent: share.agent ? { id: share.agent.id, name: share.agent.name } : null,
    })),
  })
})

router.post('/:token/approve', authGuard, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can approve edits' })
  }
  const token = String(req.params.token || '').trim()
  const share = await prisma.profileShare.findUnique({
    where: { token },
    include: { customer: true },
  })
  if (!share) return res.status(404).json({ error: 'Share not found' })
  if (share.customer?.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (share.pendingStatus !== 'pending') {
    return res.status(400).json({ error: 'No pending edits to approve' })
  }
  const currentProfileData = parseJson(share.customer.profileData, {})
  const currentForms = currentProfileData.forms || {}
  const pendingEdits = parseJson(share.pendingEdits, {})
  const sections = parseJson(share.sections, {})
  const updatedForms = mergeFormsBySections(currentForms, pendingEdits, sections)
  const updatedProfileData = { ...currentProfileData, forms: updatedForms }
  await prisma.customer.update({
    where: { id: share.customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
  })
  const snapshot = parseJson(share.snapshot, {})
  const nextSnapshot = { ...snapshot, forms: updatedForms }
  await prisma.profileShare.update({
    where: { token },
    data: {
      pendingStatus: 'accepted',
      pendingEdits: JSON.stringify({}),
      pendingAt: null,
      snapshot: JSON.stringify(nextSnapshot),
    },
  })
  res.json({ ok: true })
})

router.post('/:token/decline', authGuard, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can decline edits' })
  }
  const token = String(req.params.token || '').trim()
  const share = await prisma.profileShare.findUnique({
    where: { token },
    include: { customer: true },
  })
  if (!share) return res.status(404).json({ error: 'Share not found' })
  if (share.customer?.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  await prisma.profileShare.update({
    where: { token },
    data: {
      pendingStatus: 'declined',
      status: 'revoked',
      pendingEdits: JSON.stringify({}),
      pendingAt: null,
    },
  })
  res.json({ ok: true })
})

router.post('/:token/revoke', authGuard, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Only customers can stop sharing' })
  }
  const token = String(req.params.token || '').trim()
  const share = await prisma.profileShare.findUnique({
    where: { token },
    include: { customer: true },
  })
  if (!share) return res.status(404).json({ error: 'Share not found' })
  if (share.customer?.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  await prisma.profileShare.update({
    where: { token },
    data: {
      status: 'revoked',
      pendingStatus: 'declined',
      pendingEdits: JSON.stringify({}),
      pendingAt: null,
    },
  })
  res.json({ ok: true })
})

router.post('/:token/close', async (req, res) => {
  const token = String(req.params.token || '').trim()
  const code = String(req.body?.code || '').trim()
  const rawName = String(req.body?.name || '')
  const normalizedName = normalizeRecipientName(rawName)
  if (!token) return res.status(400).json({ error: 'Share token is required' })
  if (!code) return res.status(400).json({ error: 'Verification code is required' })
  const share = await prisma.profileShare.findUnique({ where: { token } })
  if (!share) return res.status(404).json({ error: 'Share not found' })
  if (hashCode(code) !== share.codeHash) {
    return res.status(400).json({ error: 'Invalid code' })
  }
  if (share.recipientNameNormalized) {
    if (!normalizedName) {
      return res.status(400).json({ error: 'Recipient name is required' })
    }
    if (normalizedName !== share.recipientNameNormalized) {
      return res.status(400).json({ error: 'Recipient name does not match' })
    }
  }
  const nextPendingAt = share.pendingStatus === 'pending' ? share.pendingAt : null
  await prisma.profileShare.update({
    where: { token },
    data: {
      status: 'revoked',
      pendingAt: nextPendingAt,
    },
  })
  res.json({ ok: true })
})

module.exports = router
