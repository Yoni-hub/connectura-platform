const productCatalog = [
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

const ensureProductCatalog = async (prisma) => {
  const existing = await prisma.product.findMany({
    where: { slug: { in: productCatalog.map((item) => item.slug) } },
  })
  const existingSlugs = new Set(existing.map((item) => item.slug))
  const missing = productCatalog.filter((item) => !existingSlugs.has(item.slug))
  if (!missing.length) return
  await prisma.product.createMany({
    data: missing.map((item) => ({ slug: item.slug, name: item.name })),
  })
}

module.exports = { productCatalog, slugify, ensureProductCatalog }
