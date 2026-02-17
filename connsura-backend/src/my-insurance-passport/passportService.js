const prisma = require('../prisma')
const { parseJson } = require('../utils/transform')

const INPUT_TYPES = new Set(['general', 'select', 'yes/no', 'number', 'date', 'text'])

const normalizeInputType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (INPUT_TYPES.has(normalized)) return normalized
  if (normalized === 'yesno' || normalized === 'yes-no' || normalized === 'yes_no') return 'yes/no'
  return 'general'
}

const toOptions = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (!value) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
      }
    } catch {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
  }
  return []
}

const normalizeSectionKey = (value) => String(value || '').trim().toLowerCase()

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseFormSchema = (value) => {
  const parsed = parseJson(value, {})
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : []
  return { sections }
}

const ensureOwnedCustomer = async (userId) => {
  const customer = await prisma.customer.findUnique({ where: { userId } })
  if (!customer) return null
  return customer
}

const ensureOwnedInstance = async (userId, productInstanceId, { includeDeleted = false } = {}) => {
  const customer = await ensureOwnedCustomer(userId)
  if (!customer) return null
  return prisma.passportProductInstance.findFirst({
    where: {
      id: productInstanceId,
      customerId: customer.id,
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
  })
}

const formatInstanceSummary = (instance) => ({
  id: instance.id,
  productSource: instance.productSource,
  adminProductId: instance.adminProductId,
  productName: instance.productName,
  updatedAt: instance.updatedAt,
  createdAt: instance.createdAt,
})

const listInstances = async (userId) => {
  const customer = await ensureOwnedCustomer(userId)
  if (!customer) return []
  const rows = await prisma.passportProductInstance.findMany({
    where: { customerId: customer.id, deletedAt: null },
    orderBy: [{ updatedAt: 'desc' }],
  })
  return rows.map(formatInstanceSummary)
}

const createAdminInstance = async (userId, adminProductId) => {
  const customer = await ensureOwnedCustomer(userId)
  if (!customer) return { error: 'Customer not found', status: 404 }
  const product = await prisma.product.findUnique({ where: { id: adminProductId } })
  if (!product) return { error: 'Product not found', status: 404 }
  const created = await prisma.passportProductInstance.create({
    data: {
      customerId: customer.id,
      productSource: 'ADMIN_PRODUCT',
      adminProductId: product.id,
      productName: product.name,
    },
  })
  return { instance: formatInstanceSummary(created) }
}

const createCustomInstance = async (userId, productName) => {
  const customer = await ensureOwnedCustomer(userId)
  if (!customer) return { error: 'Customer not found', status: 404 }
  const trimmed = String(productName || '').trim()
  if (!trimmed) return { error: 'Product name is required', status: 400 }
  const created = await prisma.passportProductInstance.create({
    data: {
      customerId: customer.id,
      productSource: 'CUSTOM_PRODUCT',
      productName: trimmed,
    },
  })
  return { instance: formatInstanceSummary(created) }
}

const replaceCustomQuestions = async (userId, productInstanceId, questions = []) => {
  const instance = await ensureOwnedInstance(userId, productInstanceId)
  if (!instance) return { error: 'Product instance not found', status: 404 }
  if (instance.productSource !== 'CUSTOM_PRODUCT') {
    return { error: 'Custom questions can only be set on custom products', status: 400 }
  }
  if (!Array.isArray(questions)) return { error: 'questions must be an array', status: 400 }

  const normalized = questions
    .map((question, index) => {
      const questionText = String(question?.questionText || '').trim()
      if (!questionText) return null
      const inputType = normalizeInputType(question?.inputType)
      const options = inputType === 'select' ? toOptions(question?.options) : null
      return {
        questionText,
        inputType,
        options,
        orderIndex: Number.isInteger(question?.orderIndex) ? question.orderIndex : index,
      }
    })
    .filter(Boolean)

  await prisma.$transaction([
    prisma.passportCustomQuestion.deleteMany({ where: { productInstanceId: instance.id } }),
    ...(normalized.length
      ? [
          prisma.passportCustomQuestion.createMany({
            data: normalized.map((row) => ({
              productInstanceId: instance.id,
              questionText: row.questionText,
              inputType: row.inputType,
              options: row.options || null,
              orderIndex: row.orderIndex,
            })),
          }),
        ]
      : []),
  ])

  return { ok: true }
}

const deleteInstance = async (userId, productInstanceId) => {
  const instance = await ensureOwnedInstance(userId, productInstanceId)
  if (!instance) return { error: 'Product instance not found', status: 404 }
  await prisma.passportProductInstance.update({
    where: { id: instance.id },
    data: { deletedAt: new Date() },
  })
  return { ok: true }
}

const getSchemaProducts = async () => {
  const rows = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  return rows.map((row) => ({ id: row.id, name: row.name }))
}

const getSchemaQuestions = async () => {
  const rows = await prisma.questionBank.findMany({
    where: { source: 'SYSTEM' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  return rows.map((row) => ({
    id: row.id,
    label: row.text,
    type: row.inputType || 'general',
    options: parseJson(row.selectOptions, []),
    productId: row.productId,
  }))
}

const buildAdminProductSections = async (product) => {
  const formSchema = parseFormSchema(product?.formSchema)
  const sections = Array.isArray(formSchema.sections) ? formSchema.sections : []
  const questionIds = Array.from(
    new Set(
      sections
        .flatMap((section) => (Array.isArray(section?.questionIds) ? section.questionIds : []))
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  )
  const questions = questionIds.length
    ? await prisma.questionBank.findMany({
        where: { id: { in: questionIds }, source: 'SYSTEM' },
      })
    : []
  const byId = new Map(questions.map((question) => [question.id, question]))
  return sections
    .map((section, sectionIndex) => {
      const key = normalizeSectionKey(section?.key || `section-${sectionIndex + 1}`)
      const label = String(section?.label || key || `Section ${sectionIndex + 1}`).trim()
      if (!key) return null
      const fieldIds = Array.isArray(section?.questionIds) ? section.questionIds : []
      const fields = fieldIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((question) => ({
          key: String(question.id),
          label: question.text,
          type: question.inputType || 'general',
          options: parseJson(question.selectOptions, []),
          questionId: question.id,
        }))
      return { key, label, fields }
    })
    .filter(Boolean)
}

const buildCustomSections = async (instanceId, instanceName) => {
  const questions = await prisma.passportCustomQuestion.findMany({
    where: { productInstanceId: instanceId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
  return [
    {
      key: 'custom',
      label: instanceName || 'Custom',
      fields: questions.map((question) => ({
        key: question.id,
        label: question.questionText,
        type: normalizeInputType(question.inputType),
        options: toOptions(question.options),
        questionInstanceId: question.id,
      })),
    },
  ]
}

const getProductForm = async (userId, productInstanceId) => {
  const instance = await ensureOwnedInstance(userId, productInstanceId)
  if (!instance) return { error: 'Product instance not found', status: 404 }

  let sections = []
  if (instance.productSource === 'ADMIN_PRODUCT') {
    const product = instance.adminProductId
      ? await prisma.product.findUnique({ where: { id: instance.adminProductId } })
      : null
    sections = await buildAdminProductSections(product)
  } else {
    sections = await buildCustomSections(instance.id, instance.productName)
  }

  return {
    productInstance: formatInstanceSummary(instance),
    sections,
  }
}

const assertSectionExists = (sections, sectionKey) => {
  const normalized = normalizeSectionKey(sectionKey)
  return (sections || []).some((section) => normalizeSectionKey(section?.key) === normalized)
}

const saveSectionValues = async (userId, productInstanceId, sectionKey, values) => {
  const form = await getProductForm(userId, productInstanceId)
  if (form.error) return form
  const normalizedSectionKey = normalizeSectionKey(sectionKey)
  if (!normalizedSectionKey) return { error: 'sectionKey is required', status: 400 }
  if (!assertSectionExists(form.sections, normalizedSectionKey)) {
    return { error: 'Invalid sectionKey for this product instance', status: 400 }
  }
  if (!isPlainObject(values)) return { error: 'values must be an object', status: 400 }

  const saved = await prisma.passportSectionResponse.upsert({
    where: {
      productInstanceId_sectionKey: {
        productInstanceId,
        sectionKey: normalizedSectionKey,
      },
    },
    create: {
      productInstanceId,
      sectionKey: normalizedSectionKey,
      values,
    },
    update: {
      values,
    },
  })

  return {
    sectionKey: saved.sectionKey,
    values: isPlainObject(saved.values) ? saved.values : {},
    updatedAt: saved.updatedAt,
  }
}

const loadSectionValues = async (userId, productInstanceId, sectionKey) => {
  const form = await getProductForm(userId, productInstanceId)
  if (form.error) return form
  const normalizedSectionKey = normalizeSectionKey(sectionKey)
  if (!normalizedSectionKey) return { error: 'sectionKey is required', status: 400 }
  if (!assertSectionExists(form.sections, normalizedSectionKey)) {
    return { error: 'Invalid sectionKey for this product instance', status: 400 }
  }
  const row = await prisma.passportSectionResponse.findUnique({
    where: {
      productInstanceId_sectionKey: {
        productInstanceId,
        sectionKey: normalizedSectionKey,
      },
    },
  })
  return {
    sectionKey: normalizedSectionKey,
    values: isPlainObject(row?.values) ? row.values : {},
  }
}

const getShareBundle = async (userId) => {
  const customer = await ensureOwnedCustomer(userId)
  if (!customer) return []
  const instances = await prisma.passportProductInstance.findMany({
    where: { customerId: customer.id, deletedAt: null },
    orderBy: [{ updatedAt: 'desc' }],
  })
  const bundles = []
  for (const instance of instances) {
    const form = await getProductForm(userId, instance.id)
    const responses = await prisma.passportSectionResponse.findMany({
      where: { productInstanceId: instance.id },
    })
    bundles.push({
      productInstance: formatInstanceSummary(instance),
      sections: form.error ? [] : form.sections,
      responses: responses.map((row) => ({
        sectionKey: row.sectionKey,
        values: isPlainObject(row.values) ? row.values : {},
        updatedAt: row.updatedAt,
      })),
    })
  }
  return bundles
}

module.exports = {
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
  getShareBundle,
}
