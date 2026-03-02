const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const sourceName = process.env.SOURCE_NAME || 'unknown'
const dbUrl = process.env.SOURCE_DB_URL
const outDir = process.env.OUT_DIR

if (!dbUrl) {
  console.error('Missing SOURCE_DB_URL')
  process.exit(1)
}
if (!outDir) {
  console.error('Missing OUT_DIR')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

const parseSchema = (value) => {
  if (!value) return { sections: [] }
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return { raw: value, sections: [] }
  }
}

async function main() {
  const [
    questionBank,
    customerQuestions,
    products,
    customers,
    users,
    profileShares,
    formSchemas,
    passportProducts,
    passportCustomQuestions,
    passportSectionResponses,
  ] = await Promise.all([
    prisma.questionBank.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.customerQuestion.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.product.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.customer.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.user.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.profileShare.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.formSchema.findMany({ orderBy: [{ id: 'asc' }] }),
    prisma.passportProductInstance.findMany({ orderBy: [{ createdAt: 'asc' }] }),
    prisma.passportCustomQuestion.findMany({ orderBy: [{ createdAt: 'asc' }] }),
    prisma.passportSectionResponse.findMany({ orderBy: [{ createdAt: 'asc' }] }),
  ])

  const sectionMappings = products.map((product) => ({
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    formSchema: parseSchema(product.formSchema),
  }))

  const summary = {
    systemQuestions: questionBank.filter((question) => question.source === 'SYSTEM').length,
    customerQuestions: customerQuestions.length,
    products: products.length,
    sectionsFromProducts: sectionMappings.reduce(
      (count, product) => count + (Array.isArray(product.formSchema?.sections) ? product.formSchema.sections.length : 0),
      0
    ),
    clients: customers.length,
    users: users.length,
    profileShares: profileShares.length,
    passportProducts: passportProducts.length,
    passportCustomQuestions: passportCustomQuestions.length,
    passportSectionResponses: passportSectionResponses.length,
  }

  const payload = {
    source: sourceName,
    generatedAt: new Date().toISOString(),
    summary,
    questions: {
      questionBank,
      customerQuestions,
    },
    products,
    sections: {
      productSectionMappings: sectionMappings,
      formSchemas,
    },
    inputTypesAndTooltips: questionBank.map((question) => ({
      id: question.id,
      text: question.text,
      inputType: question.inputType,
      selectOptions: question.selectOptions,
      helperText: question.helperText,
      source: question.source,
      productId: question.productId,
    })),
    clients: {
      users,
      customers,
      profileShares,
    },
    formsFilled: {
      passportProducts,
      passportCustomQuestions,
      passportSectionResponses,
    },
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'structured-export.json'), JSON.stringify(payload, null, 2))
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(`Structured export written for ${sourceName} -> ${outDir}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
