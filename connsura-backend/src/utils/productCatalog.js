const productCatalog = [
  { slug: 'household-information', name: 'Household Information' },
  { slug: 'address-information', name: 'Address Information' },
  { slug: 'personal-auto', name: 'Personal Auto' },
  { slug: 'homeowners', name: 'Homeowners' },
  { slug: 'renters', name: 'Renters' },
  { slug: 'motorcycle-offroad', name: 'Motorcycle / Off-Road' },
  { slug: 'commercial-auto', name: 'Commercial Auto' },
  { slug: 'general-liability', name: 'General Liability Insurance' },
  { slug: 'commercial-property', name: 'Commercial Property Insurance' },
  { slug: 'workers-comp', name: "Workers' Compensation" },
  { slug: 'professional-liability', name: 'Professional Liability (Errors & Omissions)' },
  { slug: 'umbrella', name: 'Umbrella Insurance' },
  { slug: 'travel', name: 'Travel Insurance' },
  { slug: 'pet', name: 'Pet Insurance' },
  { slug: 'flood-earthquake', name: 'Flood or Earthquake Insurance' },
  { slug: 'health', name: 'Health Insurance' },
  { slug: 'life', name: 'Life Insurance' },
  { slug: 'disability', name: 'Disability Insurance' },
  { slug: 'dental-vision', name: 'Dental & Vision Insurance' },
  { slug: 'long-term-care', name: 'Long-Term Care Insurance' },
  { slug: 'cyber-liability', name: 'Cyber Liability Insurance' },
]

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const { buildQuestionRecords } = require('./questionBank')

const householdQuestionSeeds = [
  'Relation To Applicant',
  'First Name',
  'Middle Initial',
  'Last Name',
  'Suffix',
  'Phone',
  'Email',
  'Date of Birth',
  'Gender',
  'Marital Status',
  'Education Level',
  'Employment',
  'Occupation',
  'Driver Status',
  "Driver's License Type",
  'License Status',
  'Years Licensed',
  'License State',
  'License Number',
  'Accident Prevention Course',
  'SR-22 Required?',
  'FR-44 Required?',
]

const addressQuestionSeeds = [
  'Address Type',
  'Street Address 1',
  'Street Address 2',
  'City',
  'State',
  'Zip Code',
  'Who lives in this address',
]

const sectionQuestionSeeds = {
  'household-information': householdQuestionSeeds,
  'address-information': addressQuestionSeeds,
}

const ensureProductCatalog = async (prisma) => {
  const existing = await prisma.product.findMany({
    where: { slug: { in: productCatalog.map((item) => item.slug) } },
  })
  const existingSlugs = new Set(existing.map((item) => item.slug))
  const missing = productCatalog.filter((item) => !existingSlugs.has(item.slug))
  if (missing.length) {
    await prisma.product.createMany({
      data: missing.map((item) => ({ slug: item.slug, name: item.name })),
    })
  }

  const seedSlugs = Object.keys(sectionQuestionSeeds)
  const seedProducts = await prisma.product.findMany({
    where: { slug: { in: seedSlugs } },
  })
  for (const product of seedProducts) {
    const seeds = sectionQuestionSeeds[product.slug]
    if (!seeds?.length) continue
    const count = await prisma.questionBank.count({
      where: { productId: product.id, source: 'SYSTEM' },
    })
    if (count > 0) continue
    const records = buildQuestionRecords(seeds, 'SYSTEM', product.id, null).map((record, index) => ({
      ...record,
      sortOrder: index + 1,
    }))
    if (records.length) {
      await prisma.questionBank.createMany({ data: records, skipDuplicates: true })
    }
  }
}

module.exports = { productCatalog, slugify, ensureProductCatalog }
