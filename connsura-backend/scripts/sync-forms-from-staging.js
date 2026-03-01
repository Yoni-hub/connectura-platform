require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '../automation/.env' })

const { PrismaClient } = require('@prisma/client')
const { normalizeQuestion } = require('../src/utils/questionBank')

const prisma = new PrismaClient()

const STAGING_API_URL = String(process.env.STAGING_API_URL || 'https://staging.connsura.com/api').replace(/\/+$/, '')
const STAGING_ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL || process.env.ADMIN_EMAIL
const STAGING_ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
const SHARED_SECTION_LIBRARY_SLUG = 'shared-sections-library'

const VALID_INPUT_TYPES = new Set(['general', 'select', 'yes/no', 'number', 'date', 'text'])

const normalizeInputType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (VALID_INPUT_TYPES.has(normalized)) return normalized
  if (normalized === 'yesno' || normalized === 'yes-no' || normalized === 'yes_no') return 'yes/no'
  return 'general'
}

const normalizeSelectOptions = (value) => {
  if (!value) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return Array.from(
    new Set(
      list
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    )
  )
}

const normalizeSectionKey = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const safeJson = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const apiPost = async (url, body, token) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${url} failed (${res.status}): ${text}`)
  }
  return res.json()
}

const apiGet = async (url, token) => {
  const res = await fetch(url, {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${url} failed (${res.status}): ${text}`)
  }
  return res.json()
}

const loadStagingSnapshot = async () => {
  let token = String(process.env.STAGING_ADMIN_TOKEN || '').trim()
  if (!token) {
    if (!STAGING_ADMIN_EMAIL || !STAGING_ADMIN_PASSWORD) {
      throw new Error(
        'Missing staging admin credentials. Set STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD, or STAGING_ADMIN_TOKEN.'
      )
    }
    const login = await apiPost(`${STAGING_API_URL}/admin/login`, {
      email: STAGING_ADMIN_EMAIL,
      password: STAGING_ADMIN_PASSWORD,
    })
    token = login?.token
    if (!token) throw new Error('Staging admin login did not return a token.')
  }

  const [productsRes, questionsRes, sectionsRes] = await Promise.all([
    apiGet(`${STAGING_API_URL}/admin/forms/products`, token),
    apiGet(`${STAGING_API_URL}/admin/forms/questions`, token),
    apiGet(`${STAGING_API_URL}/admin/forms/sections`, token),
  ])

  return {
    products: Array.isArray(productsRes?.products) ? productsRes.products : [],
    questions: Array.isArray(questionsRes?.questions) ? questionsRes.questions : [],
    sharedSchema: sectionsRes?.schema && typeof sectionsRes.schema === 'object' ? sectionsRes.schema : { sections: [] },
  }
}

const upsertProducts = async (stagingProducts) => {
  const byStagingId = new Map()
  let created = 0
  let updated = 0

  for (const source of stagingProducts) {
    const sourceId = Number(source?.id)
    const sourceName = String(source?.name || '').trim()
    const sourceSlug = normalizeSectionKey(source?.slug || sourceName)
    if (!Number.isInteger(sourceId) || sourceId <= 0 || !sourceName || !sourceSlug) continue

    const existing =
      (await prisma.product.findUnique({ where: { slug: sourceSlug } })) ||
      (await prisma.product.findUnique({ where: { name: sourceName } }))

    if (!existing) {
      const createdProduct = await prisma.product.create({
        data: {
          name: sourceName,
          slug: sourceSlug,
          formSchema: JSON.stringify({ sections: [] }),
        },
      })
      byStagingId.set(sourceId, createdProduct)
      created += 1
      continue
    }

    const needsUpdate = existing.name !== sourceName || existing.slug !== sourceSlug
    const next = needsUpdate
      ? await prisma.product.update({
          where: { id: existing.id },
          data: { name: sourceName, slug: sourceSlug },
        })
      : existing
    byStagingId.set(sourceId, next)
    if (needsUpdate) updated += 1
  }

  return { byStagingId, created, updated }
}

const syncQuestions = async (stagingQuestions, stagingToLocalProduct) => {
  const byStagingQuestionId = new Map()
  const orderByProduct = new Map()
  let created = 0
  let updated = 0

  for (const source of stagingQuestions) {
    const stagingQuestionId = Number(source?.id)
    const text = String(source?.text || source?.label || '').trim()
    const normalized = normalizeQuestion(text)
    if (!Number.isInteger(stagingQuestionId) || stagingQuestionId <= 0 || !normalized) continue

    const stagingProductId = Number(source?.productId)
    const localProduct = Number.isInteger(stagingProductId) ? stagingToLocalProduct.get(stagingProductId) : null
    const localProductId = localProduct?.id || null
    const nextInputType = normalizeInputType(source?.inputType || source?.type)
    const nextSelectOptions = normalizeSelectOptions(source?.selectOptions || source?.options)
    const nextHelperText = String(source?.helperText || '').trim()

    const orderKey = localProductId === null ? 'null' : String(localProductId)
    const nextOrder = (orderByProduct.get(orderKey) || 0) + 1
    orderByProduct.set(orderKey, nextOrder)

    const existing = await prisma.questionBank.findUnique({ where: { normalized } })
    if (!existing) {
      const createdRow = await prisma.questionBank.create({
        data: {
          text,
          normalized,
          source: 'SYSTEM',
          productId: localProductId,
          inputType: nextInputType,
          selectOptions: JSON.stringify(nextSelectOptions),
          helperText: nextHelperText || null,
          sortOrder: nextOrder,
        },
      })
      byStagingQuestionId.set(stagingQuestionId, createdRow.id)
      created += 1
      continue
    }

    const needsUpdate =
      existing.text !== text ||
      existing.source !== 'SYSTEM' ||
      existing.productId !== localProductId ||
      (existing.inputType || 'general') !== nextInputType ||
      JSON.stringify(safeJson(existing.selectOptions, [])) !== JSON.stringify(nextSelectOptions) ||
      String(existing.helperText || '').trim() !== nextHelperText ||
      Number(existing.sortOrder || 0) !== nextOrder

    const next = needsUpdate
      ? await prisma.questionBank.update({
          where: { id: existing.id },
          data: {
            text,
            source: 'SYSTEM',
            productId: localProductId,
            inputType: nextInputType,
            selectOptions: JSON.stringify(nextSelectOptions),
            helperText: nextHelperText || null,
            sortOrder: nextOrder,
          },
        })
      : existing

    byStagingQuestionId.set(stagingQuestionId, next.id)
    if (needsUpdate) updated += 1
  }

  return { byStagingQuestionId, created, updated }
}

const remapSectionSchema = (schema, questionIdMap) => {
  const sourceSections = Array.isArray(schema?.sections) ? schema.sections : []
  const sections = sourceSections
    .map((section, index) => {
      const key = normalizeSectionKey(section?.key || section?.label || `section-${index + 1}`)
      const label = String(section?.label || key || `Section ${index + 1}`).trim()
      if (!key || !label) return null

      const sourceQuestionIds = Array.isArray(section?.questionIds) ? section.questionIds : []
      const remappedQuestionIds = Array.from(
        new Set(
          sourceQuestionIds
            .map((id) => questionIdMap.get(Number(id)))
            .filter((id) => Number.isInteger(id) && id > 0)
        )
      )

      const rawOverrides = section?.questionOverrides && typeof section.questionOverrides === 'object'
        ? section.questionOverrides
        : {}
      const overrides = {}
      for (const [stagingQuestionIdRaw, config] of Object.entries(rawOverrides)) {
        const localQuestionId = questionIdMap.get(Number(stagingQuestionIdRaw))
        if (!Number.isInteger(localQuestionId) || !remappedQuestionIds.includes(localQuestionId)) continue
        const nextInputType = normalizeInputType(config?.inputType)
        const next = { inputType: nextInputType }
        if (nextInputType === 'select') {
          const options = normalizeSelectOptions(config?.selectOptions)
          if (options.length) next.selectOptions = options
        }
        overrides[String(localQuestionId)] = next
      }

      const sourceSectionKey = normalizeSectionKey(section?.sourceSectionKey || '')
      return {
        key,
        label,
        questionIds: remappedQuestionIds,
        ...(Object.keys(overrides).length ? { questionOverrides: overrides } : {}),
        ...(sourceSectionKey ? { sourceSectionKey } : {}),
      }
    })
    .filter(Boolean)

  return { sections }
}

const syncProductSchemas = async (stagingProducts, stagingToLocalProduct, questionIdMap) => {
  let updated = 0
  for (const source of stagingProducts) {
    const stagingProductId = Number(source?.id)
    const localProduct = stagingToLocalProduct.get(stagingProductId)
    if (!localProduct) continue
    const remappedSchema = remapSectionSchema(source?.formSchema, questionIdMap)
    await prisma.product.update({
      where: { id: localProduct.id },
      data: { formSchema: JSON.stringify(remappedSchema) },
    })
    updated += 1
  }
  return { updated }
}

const syncSharedSections = async (stagingSharedSchema, questionIdMap) => {
  const remapped = remapSectionSchema(stagingSharedSchema, questionIdMap)
  await prisma.formSchema.upsert({
    where: { slug: SHARED_SECTION_LIBRARY_SLUG },
    create: {
      slug: SHARED_SECTION_LIBRARY_SLUG,
      schema: JSON.stringify(remapped),
      updatedBy: 'sync-forms-from-staging',
    },
    update: {
      schema: JSON.stringify(remapped),
      updatedBy: 'sync-forms-from-staging',
    },
  })
  return { sectionCount: Array.isArray(remapped.sections) ? remapped.sections.length : 0 }
}

;(async () => {
  console.log(`Loading staging forms snapshot from ${STAGING_API_URL} ...`)
  const snapshot = await loadStagingSnapshot()
  console.log(
    `Fetched ${snapshot.products.length} products, ${snapshot.questions.length} questions, ` +
      `${Array.isArray(snapshot.sharedSchema?.sections) ? snapshot.sharedSchema.sections.length : 0} shared sections.`
  )

  const productSync = await upsertProducts(snapshot.products)
  const questionSync = await syncQuestions(snapshot.questions, productSync.byStagingId)
  const schemaSync = await syncProductSchemas(snapshot.products, productSync.byStagingId, questionSync.byStagingQuestionId)
  const sharedSync = await syncSharedSections(snapshot.sharedSchema, questionSync.byStagingQuestionId)

  console.log('Sync complete:')
  console.log(`- Products: created ${productSync.created}, updated ${productSync.updated}`)
  console.log(`- Questions: created ${questionSync.created}, updated ${questionSync.updated}`)
  console.log(`- Product schemas updated: ${schemaSync.updated}`)
  console.log(`- Shared sections synced: ${sharedSync.sectionCount}`)
  await prisma.$disconnect()
})().catch(async (error) => {
  console.error('Sync failed:', error.message)
  try {
    await prisma.$disconnect()
  } catch {}
  process.exit(1)
})
