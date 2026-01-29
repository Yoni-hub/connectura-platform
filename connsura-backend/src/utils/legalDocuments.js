const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const LEGAL_DOC_TYPES = {
  TERMS: 'terms',
  PRIVACY: 'privacy',
  DATA_SHARING: 'data-sharing',
  AGENT_TERMS: 'agent-terms',
}

const REQUIRED_DOCS_BY_ROLE = {
  CUSTOMER: [LEGAL_DOC_TYPES.TERMS, LEGAL_DOC_TYPES.PRIVACY],
  AGENT: [LEGAL_DOC_TYPES.TERMS, LEGAL_DOC_TYPES.PRIVACY, LEGAL_DOC_TYPES.AGENT_TERMS],
}

const LEGAL_SOURCE_PATH = path.resolve(__dirname, '..', '..', '..', 'legal', 'tc.txt')
const LEGAL_SOURCE_MAP = {
  [LEGAL_DOC_TYPES.TERMS]: path.resolve(__dirname, '..', '..', '..', 'legal', 'terms.txt'),
  [LEGAL_DOC_TYPES.PRIVACY]: path.resolve(__dirname, '..', '..', '..', 'legal', 'privacy.txt'),
  [LEGAL_DOC_TYPES.DATA_SHARING]: path.resolve(__dirname, '..', '..', '..', 'legal', 'data-sharing.txt'),
  [LEGAL_DOC_TYPES.AGENT_TERMS]: path.resolve(__dirname, '..', '..', '..', 'legal', 'agent-terms.txt'),
}

const readLegalSource = (type) => {
  const candidate = type ? LEGAL_SOURCE_MAP[type] : null
  if (candidate && fs.existsSync(candidate)) {
    return fs.readFileSync(candidate, 'utf8')
  }
  return fs.readFileSync(LEGAL_SOURCE_PATH, 'utf8')
}

const formatPublishDate = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const applyPublishDate = (content, date = new Date()) => {
  const formatted = formatPublishDate(date)
  return String(content || '').replace(/\[Insert Date\]/g, formatted)
}

const hashContent = (content) => {
  return crypto.createHash('sha256').update(String(content || '')).digest('hex')
}

const getLatestDocuments = async (prisma, types) => {
  const results = await Promise.all(
    types.map(async (type) => {
      const doc = await prisma.legalDocument.findFirst({
        where: { type },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      })
      return [type, doc]
    })
  )
  return results.reduce((acc, [type, doc]) => {
    if (doc) acc[type] = doc
    return acc
  }, {})
}

const getRequiredDocTypes = (role) => {
  const key = String(role || '').toUpperCase()
  return REQUIRED_DOCS_BY_ROLE[key] || []
}

const getConsentStatus = async (prisma, user) => {
  if (!user) return { required: [], missing: [] }
  const requiredTypes = getRequiredDocTypes(user.role)
  if (!requiredTypes.length) return { required: [], missing: [] }
  const latestDocs = await getLatestDocuments(prisma, requiredTypes)
  const consents = await prisma.userConsent.findMany({
    where: {
      userId: user.id,
      documentType: { in: requiredTypes },
    },
    orderBy: { consentedAt: 'desc' },
  })
  const latestConsentByType = consents.reduce((acc, consent) => {
    if (!acc[consent.documentType]) {
      acc[consent.documentType] = consent
    }
    return acc
  }, {})

  const missing = requiredTypes
    .map((type) => {
      const latest = latestDocs[type]
      if (!latest) return null
      const consent = latestConsentByType[type]
      if (!consent || consent.version !== latest.version) {
        return {
          type,
          version: latest.version,
          publishedAt: latest.publishedAt,
        }
      }
      return null
    })
    .filter(Boolean)

  return {
    required: requiredTypes.map((type) => ({
      type,
      version: latestDocs[type]?.version || null,
      publishedAt: latestDocs[type]?.publishedAt || null,
    })),
    missing,
  }
}

const ensureLegalDocuments = async (prisma, options = {}) => {
  const types = Object.values(LEGAL_DOC_TYPES)
  const existing = await prisma.legalDocument.findMany({
    where: { type: { in: types } },
    select: { type: true },
  })
  const existingTypes = new Set(existing.map((entry) => entry.type))
  const missingTypes = types.filter((type) => !existingTypes.has(type))
  if (!missingTypes.length) return []

  const now = options.publishedAt ? new Date(options.publishedAt) : new Date()
  const created = []
  for (const type of missingTypes) {
    const source = readLegalSource(type)
    const publishedContent = applyPublishDate(source, now)
    const contentHash = hashContent(publishedContent)
    const version = options.version || '1.0'
    const entry = await prisma.legalDocument.create({
      data: {
        type,
        version,
        contentHash,
        content: publishedContent,
        publishedAt: now,
      },
    })
    created.push(entry)
  }
  return created
}

const buildConsentItems = (items = {}) => {
  if (!items || typeof items !== 'object') return null
  return JSON.stringify(items)
}

module.exports = {
  LEGAL_DOC_TYPES,
  REQUIRED_DOCS_BY_ROLE,
  readLegalSource,
  applyPublishDate,
  hashContent,
  getLatestDocuments,
  getRequiredDocTypes,
  getConsentStatus,
  ensureLegalDocuments,
  buildConsentItems,
  LEGAL_SOURCE_MAP,
}
