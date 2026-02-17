const express = require('express')
const crypto = require('crypto')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')
const { sendEmail } = require('../utils/emailClient')
const { LEGAL_DOC_TYPES, getLatestDocuments } = require('../utils/legalDocuments')
const {
  notifyProfileAccessRevoked,
  notifyProfileShared,
  notifyProfileUpdatedByRecipient,
} = require('../utils/notifications/dispatcher')
const { getShareBundle } = require('../my-insurance-passport/passportService')

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
  editable: share.editable,
  status: share.status,
  pendingStatus: share.pendingStatus,
  pendingAt: share.pendingAt,
  recipientName: share.recipientName,
  createdAt: share.createdAt,
})

const buildShareScope = (sections = {}) => {
  if (!sections || typeof sections !== 'object') return []
  return Object.keys(sections)
    .filter((key) => key !== 'additionalIndexes')
    .filter((key) => Boolean(sections[key]))
}

const normalizeBaseUrl = (value) => {
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

const buildShareUrl = (token) => {
  const base = normalizeBaseUrl(process.env.FRONTEND_URL || 'http://localhost:5173')
  return `${base}/share/${token}`
}

const requireLatestConsent = async (userId, documentType) => {
  const latestDocs = await getLatestDocuments(prisma, [documentType])
  const latest = latestDocs[documentType]
  if (!latest) return { ok: true, latest: null }
  const consent = await prisma.userConsent.findFirst({
    where: { userId, documentType, version: latest.version },
    orderBy: { consentedAt: 'desc' },
  })
  return { ok: Boolean(consent), latest }
}

const sendShareEmail = async ({ to, recipientName, customerName, shareUrl, code, editable }) => {
  const recipientLabel = recipientName ? ` for ${recipientName}` : ''
  const customerLabel = customerName ? ` from ${customerName}` : ''
  const accessMode = editable ? 'Editable' : 'Read-only'
  const subject = `Your Connsura share link${recipientLabel}`
  const intro = `Here is your Connsura share link${recipientLabel}${customerLabel}.`
  const text = [
    intro,
    '',
    `Access mode: ${accessMode}`,
    `Share link: ${shareUrl}`,
    `Access code: ${code}`,
    '',
    'This code expires if the share is inactive for too long. If you did not request this, you can ignore this email.',
  ].join('\n')

  await sendEmail({ to, subject, text, replyTo: 'privacy@connsura.com' })
}

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
  const consentCheck = await requireLatestConsent(req.user.id, LEGAL_DOC_TYPES.DATA_SHARING)
  if (!consentCheck.ok) {
    return res.status(403).json({
      error: 'Consent required',
      code: 'CONSENT_REQUIRED',
      documentType: LEGAL_DOC_TYPES.DATA_SHARING,
      version: consentCheck.latest?.version || null,
    })
  }
  const customer = await prisma.customer.findUnique({
    where: { userId: req.user.id },
    include: { user: true },
  })
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' })
  }
  const sections = req.body?.sections || {}
  const snapshot = req.body?.snapshot || {}
  const editable = Boolean(req.body?.editable)
  const rawRecipientName = typeof req.body?.recipientName === 'string' ? req.body.recipientName : ''
  const recipientName = collapseSpaces(rawRecipientName)
  const recipientNameNormalized = normalizeRecipientName(rawRecipientName)
  if (!recipientNameNormalized) {
    return res.status(400).json({ error: 'Recipient name is required' })
  }

  const passportProducts = await getShareBundle(req.user.id).catch(() => [])
  const snapshotWithPassport = {
    ...(snapshot || {}),
    passportV2: {
      version: 2,
      products: passportProducts,
    },
  }

  const token = generateToken()
  const code = generateCode()

  const share = await prisma.profileShare.create({
    data: {
      token,
      codeHash: hashCode(code),
      sections: JSON.stringify(sections || {}),
      snapshot: JSON.stringify(snapshotWithPassport),
      customerId: customer.id,
      editable,
      recipientName,
      recipientNameNormalized,
      lastAccessedAt: new Date(),
    },
  })

  const shareUrl = buildShareUrl(token)
  const shareScope = buildShareScope(sections || {})
  const emailTarget = customer.user?.email
  if (emailTarget) {
    try {
      await sendShareEmail({
        to: emailTarget,
        recipientName,
        customerName: customer.name,
        shareUrl,
        code,
        editable,
      })
    } catch (err) {
      console.error('share email send error', { error: err.message })
    }
  }
  if (customer.user) {
    notifyProfileShared({
      user: customer.user,
      recipientName,
      shareId: share.id,
      shareScope,
    }).catch((err) => console.error('share activity notification error', err))
  }

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
  if (share.customerId) {
    const owner = await prisma.customer
      .findUnique({ where: { id: share.customerId }, include: { user: true } })
      .catch(() => null)
    if (owner?.user) {
      notifyProfileUpdatedByRecipient({
        user: owner.user,
        recipientName: share.recipientName,
        shareId: share.id,
      }).catch((err) => console.error('profile edits notification error', err))
    }
  }
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
    orderBy: { pendingAt: 'desc' },
  })
  res.json({
    shares: shares.map((share) => ({
      ...formatShare(share),
      pendingEdits: parseJson(share.pendingEdits, {}),
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
    orderBy: { createdAt: 'desc' },
  })
  res.json({
    shares: shares.map((share) => ({
      ...formatShare(share),
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
    include: { customer: { include: { user: true } } },
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
    include: { customer: { include: { user: true } } },
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
  if (share.customer?.user) {
    notifyProfileAccessRevoked({
      user: share.customer.user,
      recipientName: share.recipientName,
      shareId: share.id,
    }).catch((err) => console.error('share declined notification error', err))
  }
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
  if (share.customer?.user) {
    notifyProfileAccessRevoked({
      user: share.customer.user,
      recipientName: share.recipientName,
      shareId: share.id,
    }).catch((err) => console.error('share revoked notification error', err))
  }
  res.json({ ok: true })
})

router.post('/:token/close', async (req, res) => {
  const token = String(req.params.token || '').trim()
  const code = String(req.body?.code || '').trim()
  const rawName = String(req.body?.name || '')
  const normalizedName = normalizeRecipientName(rawName)
  if (!token) return res.status(400).json({ error: 'Share token is required' })
  if (!code) return res.status(400).json({ error: 'Verification code is required' })
  const share = await prisma.profileShare.findUnique({
    where: { token },
    include: { customer: { include: { user: true } } },
  })
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
  if (share.customer?.user) {
    notifyProfileAccessRevoked({
      user: share.customer.user,
      recipientName: share.recipientName,
      shareId: share.id,
    }).catch((err) => console.error('share closed notification error', err))
  }
  res.json({ ok: true })
})

module.exports = router
