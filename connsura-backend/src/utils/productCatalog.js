const productCatalog = [
  { slug: 'personal-auto', name: 'Personal Auto' },
  { slug: 'commercial-auto', name: 'Commercial Auto' },
  { slug: 'homeowners', name: 'Homeowners' },
]

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const { buildQuestionRecords } = require('./questionBank')

const relationToApplicantOptions = ['Named Insured', 'Spouse', 'Child', 'Parent', 'Dependent', 'Other']
const genderOptions = ['Male', 'Female']
const maritalStatusOptions = ['Single', 'Married', 'Divorced', 'Legally Separated', 'Living apart from Spouse']
const driverStatusOptions = [
  'Rated',
  'Under 19 Permit Driver',
  'Under 21 Never Licensed',
  '21+ Never Licensed/Surrendered',
  'Revoked License',
  'Other Insurance',
  'Military deployed spouse',
]
const driversLicenseTypeOptions = [
  'Personal Auto',
  'Commercial Vehicle/Business (non-chauffeur)',
  'Chauffeur/Passenger Transport',
  'Permit',
  'Not Licensed/State ID',
]
const licenseStatusOptions = ['Valid', 'Suspended', 'Revoked', 'Expired', 'Other']
const yearsLicensedOptions = ['3 or more', '2', '1', '0 - 12 months']
const licenseStateOptions = [
  'Virginia',
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
  'Canada',
  'Guam',
  'Puerto Rico',
  'Virgin Islands',
  'Foreign Country',
]
const employmentOptions = [
  'Agriculture/Forestry/Fishing',
  'Art/Design/Media',
  'Banking/Finance/Real Estate',
  'Business/Sales/Office',
  'Construction / Energy / Mining',
  'Education/Library',
  'Engineer/Architect/Science/Math',
  'Food Service / Hotel Services',
  'Government/Military',
  'Homemaker (full-time)',
  'Information Technology',
  'Insurance',
  'Legal/Law Enforcement/Security',
  'Medical/Social Services/Religion',
  'Personal Care/Service',
  'Production / Manufacturing',
  'Repair / Maintenance / Grounds',
  'Retired (full-time)',
  'Sports/Recreation',
  'Student (full-time)',
  'Travel / Transportation / Storage',
  'Unemployed',
]
const educationLevelOptions = [
  'No high school diploma or GED',
  'High school diploma or GED',
  'Vocational or trade school degree',
  'Some college',
  'Currently in college',
  'College degree',
  'Graduate degree',
]
const addressTypeOptions = ['Secondary Home', 'Rental Property']

const householdQuestionSeeds = [
  { text: 'Relation To Applicant', inputType: 'select', selectOptions: relationToApplicantOptions },
  { text: 'First Name', inputType: 'text' },
  { text: 'Middle Initial', inputType: 'text' },
  { text: 'Last Name', inputType: 'text' },
  { text: 'Suffix', inputType: 'text' },
  { text: 'Phone', inputType: 'text' },
  { text: 'Email', inputType: 'text' },
  { text: 'Date of Birth', inputType: 'date' },
  { text: 'Gender', inputType: 'select', selectOptions: genderOptions },
  { text: 'Marital Status', inputType: 'select', selectOptions: maritalStatusOptions },
  { text: 'Education Level', inputType: 'select', selectOptions: educationLevelOptions },
  { text: 'Employment', inputType: 'select', selectOptions: employmentOptions },
  { text: 'Occupation', inputType: 'select' },
  { text: 'Driver Status', inputType: 'select', selectOptions: driverStatusOptions },
  { text: "Driver's License Type", inputType: 'select', selectOptions: driversLicenseTypeOptions },
  { text: 'License Status', inputType: 'select', selectOptions: licenseStatusOptions },
  { text: 'Years Licensed', inputType: 'select', selectOptions: yearsLicensedOptions },
  { text: 'License State', inputType: 'select', selectOptions: licenseStateOptions },
  { text: 'License Number', inputType: 'text' },
  { text: 'Accident Prevention Course', inputType: 'yes/no' },
  { text: 'SR-22 Required?', inputType: 'yes/no' },
  { text: 'FR-44 Required?', inputType: 'yes/no' },
]

const addressQuestionSeeds = [
  { text: 'Address Type', inputType: 'select', selectOptions: addressTypeOptions },
  { text: 'Street Address 1', inputType: 'text' },
  { text: 'Street Address 2', inputType: 'text' },
  { text: 'City', inputType: 'text' },
  { text: 'State', inputType: 'text' },
  { text: 'Zip Code', inputType: 'text' },
  { text: 'Who lives in this address', inputType: 'general' },
]

const sectionQuestionSeeds = {
  'household-information': householdQuestionSeeds,
  'address-information': addressQuestionSeeds,
}

const QUESTION_INPUT_TYPES = new Set(['general', 'select', 'yes/no', 'number', 'date', 'text'])
const normalizeInputType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'yesno' || normalized === 'yes-no' || normalized === 'yes_no') return 'yes/no'
  if (QUESTION_INPUT_TYPES.has(normalized)) return normalized
  return ''
}

const normalizeSelectOptionsList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
      }
    } catch {
      // Fall back to comma-separated parsing.
    }
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

const syncQuestionSeedConfig = async (prisma, product, seeds) => {
  if (!product || !seeds?.length) return
  const records = buildQuestionRecords(seeds, 'SYSTEM', product.id, null)
  if (!records.length) return
  const configByNormalized = new Map(records.map((record) => [record.normalized, record]))
  const normalizedList = Array.from(configByNormalized.keys())
  const existing = await prisma.questionBank.findMany({
    where: { productId: product.id, source: 'SYSTEM', normalized: { in: normalizedList } },
    select: { id: true, normalized: true, inputType: true, selectOptions: true },
  })
  if (!existing.length) return
  const updates = []
  existing.forEach((row) => {
    const config = configByNormalized.get(row.normalized)
    if (!config) return
    const currentType = normalizeInputType(row.inputType)
    const nextType = normalizeInputType(config.inputType)
    const currentOptions = normalizeSelectOptionsList(row.selectOptions)
    const nextOptions = normalizeSelectOptionsList(config.selectOptions)
    const data = {}
    if (nextType && nextType !== 'general' && (!currentType || currentType === 'general')) {
      data.inputType = nextType
    }
    if (nextOptions.length > 0 && currentOptions.length === 0) {
      data.selectOptions = JSON.stringify(nextOptions)
    }
    if (Object.keys(data).length) {
      updates.push(prisma.questionBank.update({ where: { id: row.id }, data }))
    }
  })
  if (updates.length) {
    await prisma.$transaction(updates)
  }
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
    if (count === 0) {
      const records = buildQuestionRecords(seeds, 'SYSTEM', product.id, null).map((record, index) => ({
        ...record,
        sortOrder: index + 1,
      }))
      if (records.length) {
        await prisma.questionBank.createMany({ data: records, skipDuplicates: true })
      }
    }
    await syncQuestionSeedConfig(prisma, product, seeds)
  }
}

module.exports = { productCatalog, slugify, ensureProductCatalog }
