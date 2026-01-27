const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const groupSystemQuestions = (rows) => {
  const byProduct = new Map()
  rows.forEach((row) => {
    if (!row.productId || !row.normalized) return
    if (!byProduct.has(row.productId)) {
      byProduct.set(row.productId, new Set())
    }
    byProduct.get(row.productId).add(row.normalized)
  })
  return byProduct
}

const run = async () => {
  const systemQuestions = await prisma.questionBank.findMany({
    where: { source: 'SYSTEM', productId: { not: null } },
    select: { productId: true, normalized: true },
  })
  const grouped = groupSystemQuestions(systemQuestions)
  let totalDeleted = 0

  for (const [productId, normalizedSet] of grouped.entries()) {
    if (!normalizedSet.size) continue
    const result = await prisma.customerQuestion.deleteMany({
      where: {
        productId,
        normalized: { in: Array.from(normalizedSet) },
      },
    })
    totalDeleted += result.count
    if (result.count > 0) {
      console.log(`Deleted ${result.count} customer question(s) for product ${productId}.`)
    }
  }

  console.log(`Done. Total deleted: ${totalDeleted}`)
}

run()
  .catch((error) => {
    console.error('Cleanup failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
