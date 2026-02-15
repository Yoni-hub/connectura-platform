const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { LEGAL_DOC_TYPES, readLegalSource, applyPublishDate, hashContent } = require('../src/utils/legalDocuments')

const prisma = new PrismaClient()

const now = new Date()
const versions = {
  [LEGAL_DOC_TYPES.TERMS]: '1.1',
  [LEGAL_DOC_TYPES.PRIVACY]: '1.1',
  [LEGAL_DOC_TYPES.DATA_SHARING]: '1.1',
}

const run = async () => {
  const types = Object.values(LEGAL_DOC_TYPES)
  const updated = []
  for (const type of types) {
    const version = versions[type]
    if (!version) continue
    const source = readLegalSource(type)
    const content = applyPublishDate(source, now)
    const contentHash = hashContent(content)
    const existing = await prisma.legalDocument.findFirst({
      where: { type, version, contentHash },
    })
    if (existing) {
      updated.push({ type, version, skipped: true })
      continue
    }
    const entry = await prisma.legalDocument.create({
      data: { type, version, content, contentHash, publishedAt: now },
    })
    updated.push({ type, version, id: entry.id })
  }
  console.log(updated)
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
