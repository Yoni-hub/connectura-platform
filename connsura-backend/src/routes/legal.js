const express = require('express')
const fs = require('fs')
const prisma = require('../prisma')
const { authGuard, adminGuard } = require('../middleware/auth')
const {
  LEGAL_DOC_TYPES,
  getLatestDocuments,
  getConsentStatus,
  readLegalSource,
  applyPublishDate,
  hashContent,
  buildConsentItems,
  LEGAL_SOURCE_MAP,
  resolveLegalSourcePath,
  writeLegalSource,
} = require('../utils/legalDocuments')
const { notifyLegalUpdate } = require('../utils/notifications/dispatcher')

const router = express.Router()

const normalizeType = (value) => String(value || '').trim().toLowerCase()
const LEGAL_TYPE_SET = new Set(Object.values(LEGAL_DOC_TYPES))
const isValidType = (type) => LEGAL_TYPE_SET.has(type)
const LEGAL_LABELS = {
  [LEGAL_DOC_TYPES.TERMS]: 'Terms',
  [LEGAL_DOC_TYPES.PRIVACY]: 'Privacy Policy',
  [LEGAL_DOC_TYPES.DATA_SHARING]: 'Data Sharing Policy',
}

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const ip = raw || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || ''
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '')
}

const formatDoc = (doc) => (
  doc
    ? {
        id: doc.id,
        type: doc.type,
        version: doc.version,
        contentHash: doc.contentHash,
        content: doc.content,
        publishedAt: doc.publishedAt,
      }
    : null
)

router.get('/', async (req, res) => {
  const types = Object.values(LEGAL_DOC_TYPES)
  const latest = await getLatestDocuments(prisma, types)
  const sourceFiles = Object.fromEntries(
    Object.entries(LEGAL_SOURCE_MAP || {}).map(([key, value]) => [key, value])
  )
  res.json({
    documents: types
      .map((type) => latest[type])
      .filter(Boolean)
      .map((doc) => ({
        type: doc.type,
        version: doc.version,
        publishedAt: doc.publishedAt,
        contentHash: doc.contentHash,
      })),
    sourceFiles,
  })
})

router.get('/status/me', authGuard, async (req, res) => {
  const status = await getConsentStatus(prisma, req.user)
  res.json({
    required: status.required,
    missing: status.missing,
  })
})

router.post('/consent', authGuard, async (req, res) => {
  const type = normalizeType(req.body?.documentType)
  const version = String(req.body?.version || '').trim()
  if (!type || !isValidType(type)) {
    return res.status(400).json({ error: 'Document type is required' })
  }
  const latest = await prisma.legalDocument.findFirst({
    where: { type },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
  })
  if (!latest) return res.status(404).json({ error: 'Legal document not found' })
  if (version && version !== latest.version) {
    return res.status(400).json({ error: 'Version mismatch' })
  }
  const consentItems = buildConsentItems(req.body?.consentItems)
  const consent = await prisma.userConsent.create({
    data: {
      userId: req.user.id,
      role: req.user.role,
      documentType: latest.type,
      version: latest.version,
      ipAddress: getRequestIp(req),
      userAgent: String(req.headers['user-agent'] || ''),
      consentItems,
    },
  })
  res.status(201).json({ consent })
})

router.post('/consent/bulk', authGuard, async (req, res) => {
  const consents = Array.isArray(req.body?.consents) ? req.body.consents : []
  if (!consents.length) {
    return res.status(400).json({ error: 'Consents are required' })
  }
  const types = consents
    .map((entry) => normalizeType(entry?.documentType))
    .filter((type) => type && isValidType(type))
  if (!types.length) {
    return res.status(400).json({ error: 'Valid document types are required' })
  }
  const latestDocs = await getLatestDocuments(prisma, types)
  const ipAddress = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  const records = []
  for (const entry of consents) {
    const type = normalizeType(entry?.documentType)
    if (!type) continue
    const latest = latestDocs[type]
    if (!latest) continue
    if (entry?.version && String(entry.version) !== latest.version) continue
    records.push({
      userId: req.user.id,
      role: req.user.role,
      documentType: latest.type,
      version: latest.version,
      ipAddress,
      userAgent,
      consentItems: buildConsentItems(entry?.consentItems),
    })
  }
  if (!records.length) {
    return res.status(400).json({ error: 'No valid consent records' })
  }
  const created = await prisma.userConsent.createMany({ data: records })
  res.status(201).json({ created: created.count })
})

router.post('/admin/publish', adminGuard, async (req, res) => {
  const type = normalizeType(req.body?.type)
  const version = String(req.body?.version || '').trim()
  if (!type || !version || !isValidType(type)) {
    return res.status(400).json({ error: 'Type and version are required' })
  }
  const content = String(req.body?.content || '').trim()
  if (!content) return res.status(400).json({ error: 'Content is required' })
  const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date()
  if (Number.isNaN(publishedAt.getTime())) {
    return res.status(400).json({ error: 'Invalid publish date' })
  }
  const publishedContent = applyPublishDate(content, publishedAt)
  const contentHash = hashContent(publishedContent)

  const entry = await prisma.legalDocument.create({
    data: {
      type,
      version,
      content: publishedContent,
      contentHash,
      publishedAt,
    },
  })
  prisma.user
    .findMany({
      where: { role: 'CUSTOMER', email: { not: null }, emailVerified: true },
      select: { id: true, email: true },
    })
    .then((users) =>
      notifyLegalUpdate({
        docLabel: LEGAL_LABELS[type] || 'policy',
        docType: type,
        version,
        publishedAt,
        users,
        actor: { type: 'ADMIN', id: req.admin?.id || null },
      })
    )
    .catch((err) => console.error('legal update notification error', err))
  res.status(201).json({ document: formatDoc(entry) })
})

router.post('/admin/publish-from-source', adminGuard, async (req, res) => {
  const type = normalizeType(req.body?.type)
  const version = String(req.body?.version || '').trim()
  if (!type || !version || !isValidType(type)) {
    return res.status(400).json({ error: 'Type and version are required' })
  }
  const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date()
  if (Number.isNaN(publishedAt.getTime())) {
    return res.status(400).json({ error: 'Invalid publish date' })
  }
  const source = readLegalSource(type)
  const publishedContent = applyPublishDate(source, publishedAt)
  const contentHash = hashContent(publishedContent)

  const entry = await prisma.legalDocument.create({
    data: {
      type,
      version,
      content: publishedContent,
      contentHash,
      publishedAt,
    },
  })
  prisma.user
    .findMany({
      where: { role: 'CUSTOMER', email: { not: null }, emailVerified: true },
      select: { id: true, email: true },
    })
    .then((users) =>
      notifyLegalUpdate({
        docLabel: LEGAL_LABELS[type] || 'policy',
        docType: type,
        version,
        publishedAt,
        users,
        actor: { type: 'ADMIN', id: req.admin?.id || null },
      })
    )
    .catch((err) => console.error('legal update notification error', err))
  res.status(201).json({ document: formatDoc(entry) })
})

router.get('/admin/source', adminGuard, async (req, res) => {
  const type = normalizeType(req.query?.type)
  if (!type || !isValidType(type)) {
    return res.status(400).json({ error: 'Document type is required' })
  }
  const resolved = resolveLegalSourcePath(type)
  if (!resolved?.path || !fs.existsSync(resolved.path)) {
    return res.status(404).json({ error: 'Source file not found' })
  }
  const content = fs.readFileSync(resolved.path, 'utf8')
  const stat = fs.statSync(resolved.path)
  res.json({
    type,
    source: resolved.source,
    updatedAt: stat.mtime,
    content,
  })
})

router.put('/admin/source', adminGuard, async (req, res) => {
  const type = normalizeType(req.body?.type)
  if (!type || !isValidType(type)) {
    return res.status(400).json({ error: 'Document type is required' })
  }
  const content = String(req.body?.content || '')
  if (!content.trim()) {
    return res.status(400).json({ error: 'Content is required' })
  }
  if (content.length > 400000) {
    return res.status(400).json({ error: 'Content is too large' })
  }
  const target = writeLegalSource(type, content)
  res.json({ ok: true, path: target })
})

router.post('/admin/force-reconsent', adminGuard, async (req, res) => {
  const type = normalizeType(req.body?.type)
  const targetTypes = type ? [type] : Object.values(LEGAL_DOC_TYPES)
  if (type && !isValidType(type)) {
    return res.status(400).json({ error: 'Invalid document type' })
  }
  const latestDocs = await getLatestDocuments(prisma, targetTypes)
  const publishedAt = new Date()

  const created = []
  for (const docType of targetTypes) {
    const latest = latestDocs[docType]
    if (!latest) continue
    const parts = String(latest.version || '1.0').split('.')
    const major = Number.parseInt(parts[0], 10)
    const minor = Number.parseInt(parts[1] || '0', 10)
    const nextVersion = `${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor + 1 : 1}`
    const publishedContent = applyPublishDate(latest.content, publishedAt)
    const contentHash = hashContent(publishedContent)
    const entry = await prisma.legalDocument.create({
      data: {
        type: docType,
        version: nextVersion,
        content: publishedContent,
        contentHash,
        publishedAt,
      },
    })
    created.push(entry)
  }
  prisma.user
    .findMany({
      where: { role: 'CUSTOMER', email: { not: null }, emailVerified: true },
      select: { id: true, email: true },
    })
    .then((users) =>
      notifyLegalUpdate({
        docLabel: 'policy updates',
        publishedAt,
        users,
        actor: { type: 'ADMIN', id: req.admin?.id || null },
      })
    )
    .catch((err) => console.error('legal update notification error', err))
  res.status(201).json({ created: created.map(formatDoc) })
})

router.get('/admin/consents', adminGuard, async (req, res) => {
  const documentType = normalizeType(req.query?.documentType)
  const role = String(req.query?.role || '').toUpperCase()
  const userId = req.query?.userId ? Number(req.query.userId) : null
  const limit = Math.min(Number.parseInt(String(req.query?.limit || '50'), 10) || 50, 200)
  const page = Math.max(Number.parseInt(String(req.query?.page || '1'), 10) || 1, 1)
  const skip = (page - 1) * limit

  const where = {}
  if (documentType) where.documentType = documentType
  if (role) where.role = role
  if (userId) where.userId = userId

  const [total, rows] = await Promise.all([
    prisma.userConsent.count({ where }),
    prisma.userConsent.findMany({
      where,
      orderBy: { consentedAt: 'desc' },
      skip,
      take: limit,
      include: { user: true },
    }),
  ])

  res.json({
    total,
    page,
    limit,
    consents: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      email: row.user?.email || null,
      role: row.role,
      documentType: row.documentType,
      version: row.version,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      consentedAt: row.consentedAt,
      consentItems: row.consentItems ? JSON.parse(row.consentItems) : null,
    })),
  })
})

router.get('/admin/consents/export', adminGuard, async (req, res) => {
  const documentType = normalizeType(req.query?.documentType)
  const role = String(req.query?.role || '').toUpperCase()
  const where = {}
  if (documentType) where.documentType = documentType
  if (role) where.role = role

  const rows = await prisma.userConsent.findMany({
    where,
    orderBy: { consentedAt: 'desc' },
    include: { user: true },
  })

  const header = [
    'consent_id',
    'user_id',
    'email',
    'role',
    'document_type',
    'version',
    'ip_address',
    'user_agent',
    'consented_at',
    'consent_items',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    const values = [
      row.id,
      row.userId,
      row.user?.email || '',
      row.role,
      row.documentType,
      row.version,
      row.ipAddress || '',
      (row.userAgent || '').replace(/\n|\r/g, ' '),
      row.consentedAt.toISOString(),
      row.consentItems ? row.consentItems.replace(/\n|\r/g, ' ') : '',
    ]
    lines.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
  }

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="consents.csv"')
  res.send(lines.join('\n'))
})

router.get('/:type', async (req, res) => {
  const type = normalizeType(req.params.type)
  if (!type || !isValidType(type)) {
    return res.status(400).json({ error: 'Document type is required' })
  }
  const doc = await prisma.legalDocument.findFirst({
    where: { type },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
  })
  if (!doc) return res.status(404).json({ error: 'Legal document not found' })
  res.json({ document: formatDoc(doc) })
})

module.exports = router

