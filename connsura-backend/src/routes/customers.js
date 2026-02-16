const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const crypto = require('crypto')
const { sendEmail } = require('../utils/emailClient')
const { sendEmailOtp, verifyEmailOtp, RateLimitError } = require('../utils/emailOtp')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')
const { logClientAudit } = require('../utils/auditLog')
const {
  ensureNotificationPreferences,
  deriveFromLegacyPreferences,
  mapPreferencesToLegacy,
} = require('../utils/notifications/preferences')
const { notifyProfileUpdated } = require('../utils/notifications/dispatcher')
const { logInAppNotification } = require('../utils/notifications/logging')

const router = express.Router()

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const ip = raw || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || ''
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '')
}

const buildNotificationHash = (prefs) =>
  crypto.createHash('sha256').update(JSON.stringify(prefs)).digest('hex')

const buildFullName = (first, middle, last) => [first, middle, last].filter(Boolean).join(' ').trim()

const NAME_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000

const parseDateValue = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const sanitizeJsonValue = (value, maxDepth = 50) => {
  const seen = new WeakMap()
  const normalizePrimitive = (val) => {
    if (typeof val === 'bigint') {
      const asNumber = Number(val)
      return Number.isSafeInteger(asNumber) ? asNumber : val.toString()
    }
    if (typeof val === 'function' || typeof val === 'symbol') return undefined
    return val
  }
  const buildClone = (input, depth) => {
    if (input === null || input === undefined) return input
    const primitive = normalizePrimitive(input)
    if (primitive !== input) return primitive
    if (typeof input !== 'object') return input
    if (depth >= maxDepth) return undefined
    if (seen.has(input)) return undefined
    const output = Array.isArray(input) ? [] : {}
    seen.set(input, output)
    if (Array.isArray(input)) {
      input.forEach((item) => {
        const next = buildClone(item, depth + 1)
        if (next !== undefined) output.push(next)
      })
      return output
    }
    Object.entries(input).forEach(([key, val]) => {
      const next = buildClone(val, depth + 1)
      if (next !== undefined) {
        output[key] = next
      }
    })
    return output
  }
  return buildClone(value, 0)
}

const safeStringify = (value) => {
  const sanitized = sanitizeJsonValue(value)
  return JSON.stringify(sanitized ?? {})
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const normalizeSectionKey = (value) => String(value || '').trim().toLowerCase()

const splitCustomValues = (values = {}) => {
  const custom = {}
  const regular = {}
  Object.entries(values || {}).forEach(([key, val]) => {
    if (typeof key === 'string' && key.startsWith('custom.')) {
      custom[key.slice('custom.'.length)] = val
    } else {
      regular[key] = val
    }
  })
  return { custom, regular }
}

const mergeAddressSection = (existingSection = {}, values = {}) => {
  const section = {
    ...existingSection,
    contacts: Array.isArray(existingSection.contacts) ? [...existingSection.contacts] : [],
    residential: isPlainObject(existingSection.residential) ? { ...existingSection.residential } : {},
    mailing: isPlainObject(existingSection.mailing) ? { ...existingSection.mailing } : {},
  }

  Object.entries(values || {}).forEach(([key, val]) => {
    if (key.startsWith('residential.')) {
      const field = key.slice('residential.'.length)
      section.residential[field] = val
      return
    }
    if (key.startsWith('mailing.')) {
      const field = key.slice('mailing.'.length)
      section.mailing[field] = val
      return
    }
    if (key.startsWith('contact.')) {
      const field = key.slice('contact.'.length)
      const primary = section.contacts[0] || {}
      section.contacts[0] = { ...primary, [field]: val }
      return
    }
    section[key] = val
  })

  return section
}

const mergeHouseholdSection = (existingSection = {}, values = {}) => {
  const section = {
    ...existingSection,
    namedInsured: isPlainObject(existingSection.namedInsured) ? { ...existingSection.namedInsured } : {},
  }
  Object.entries(values || {}).forEach(([key, val]) => {
    section.namedInsured[key] = val
  })
  return section
}

const mergeSectionValuesIntoForms = (forms = {}, sectionKey, values = {}) => {
  if (!sectionKey) return forms
  const nextForms = { ...(forms || {}) }
  const nextCustomFields = isPlainObject(forms.customFields) ? { ...forms.customFields } : {}
  const { custom, regular } = splitCustomValues(values)

  if (Object.keys(custom).length) {
    nextCustomFields[sectionKey] = {
      ...(isPlainObject(nextCustomFields[sectionKey]) ? nextCustomFields[sectionKey] : {}),
      ...custom,
    }
  }

  const existingSection = isPlainObject(nextForms[sectionKey]) ? nextForms[sectionKey] : {}
  if (sectionKey === 'address') {
    nextForms[sectionKey] = mergeAddressSection(existingSection, regular)
  } else if (sectionKey === 'household') {
    nextForms[sectionKey] = mergeHouseholdSection(existingSection, regular)
  } else {
    nextForms[sectionKey] = { ...existingSection, ...regular }
  }

  if (Object.keys(nextCustomFields).length) {
    nextForms.customFields = nextCustomFields
  }

  return nextForms
}

const extractSectionValues = (forms = {}, sectionKey) => {
  if (!sectionKey) return {}
  const section = isPlainObject(forms[sectionKey]) ? forms[sectionKey] : {}
  const customFields = isPlainObject(forms.customFields?.[sectionKey]) ? forms.customFields[sectionKey] : {}

  if (sectionKey === 'address') {
    const result = {}
    const addPrefixed = (prefix, obj) => {
      if (!isPlainObject(obj)) return
      Object.entries(obj).forEach(([k, v]) => {
        result[`${prefix}.${k}`] = v
      })
    }
    if (Array.isArray(section.contacts) && section.contacts[0]) {
      addPrefixed('contact', section.contacts[0])
    }
    addPrefixed('residential', section.residential || {})
    addPrefixed('mailing', section.mailing || {})
    Object.entries(customFields).forEach(([k, v]) => {
      result[`custom.${k}`] = v
    })
    return result
  }

  if (sectionKey === 'household') {
    const base = isPlainObject(section.namedInsured) ? section.namedInsured : section
    const values = isPlainObject(base) ? { ...base } : {}
    Object.entries(customFields).forEach(([k, v]) => {
      values[`custom.${k}`] = v
    })
    return values
  }

  if (sectionKey === 'additional') {
    const values = {}
    if (Array.isArray(section.additionalForms)) {
      values.additionalForms = section.additionalForms
    }
    Object.entries(customFields).forEach(([k, v]) => {
      values[`custom.${k}`] = v
    })
    return Object.keys(values).length ? values : { ...section }
  }

  const values = isPlainObject(section) ? { ...section } : {}
  Object.entries(customFields).forEach(([k, v]) => {
    values[`custom.${k}`] = v
  })
  return values
}

const handleOtpSendError = (err, res) => {
  if (err instanceof RateLimitError || err?.code === 'RATE_LIMIT') {
    if (err.retryAfterSeconds) {
      res.set('Retry-After', String(err.retryAfterSeconds))
    }
    return res.status(429).json({ error: err.message || 'Too many requests' })
  }
  console.error('email otp send error', err)
  return res.status(500).json({ error: 'Failed to send verification code' })
}

const parseAuditDiff = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

const COOKIE_PREF_OPTIONS = ['all', 'essential', 'none']
const normalizeCookiePreference = (value) => {
  const normalized = String(value || '').toLowerCase()
  return COOKIE_PREF_OPTIONS.includes(normalized) ? normalized : 'all'
}

const buildCookiePrefEmail = (timestamp) => ({
  text:
    `Your cookie preferences were updated.\n\n` +
    `Some features that rely on cookies may not work as expected.\n\n` +
    `Updated: ${timestamp}\n\n` +
    `If this was not you, contact us at privacy@connsura.com.`,
  html: `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px 0;">Cookie preferences updated</h2>
      <p style="margin: 0 0 12px 0;">Your cookie preferences were updated.</p>
      <p style="margin: 0 0 12px 0;">Some features that rely on cookies may not work as expected.</p>
      <p style="margin: 0 0 12px 0;"><strong>Updated:</strong> ${timestamp}</p>
      <p style="margin: 0;">If this was not you, contact us at privacy@connsura.com.</p>
    </div>
  `,
})

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'customers')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    const customerId = req.params.id || 'customer'
    cb(null, `customer-${customerId}-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'))
    }
    return cb(null, true)
  },
})

const handlePhotoUpload = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    return next()
  })
}

const formatCustomerProfile = (customer) => ({
  id: customer.id,
  name: customer.name,
  preferredLangs: parseJson(customer.preferredLangs, []),
  coverages: parseJson(customer.coverages, []),
  priorInsurance: parseJson(customer.priorInsurance, []),
  drivers: customer.drivers || [],
  vehicles: customer.vehicles || [],
  profileData: parseJson(customer.profileData, {}),
  isDisabled: customer.isDisabled,
})

router.get('/:id/profile', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json({ profile: formatCustomerProfile(customer) })
})

router.post('/:id/photo', authGuard, handlePhotoUpload, async (req, res) => {
  const customerId = Number(req.params.id)
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer || customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' })
  }
  const photoPath = `/uploads/customers/${req.file.filename}`
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, photo: photoPath }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_PROFILE_PICTURE_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ profile: formatCustomerProfile(updated), photo: photoPath })
})

router.post('/:id/photo/remove', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer || customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, photo: '' }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_PROFILE_PICTURE_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
    removed: true,
  })
  res.json({ profile: formatCustomerProfile(updated), photo: '' })
})

router.post('/:id/profile', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const {
    name,
    preferredLangs = [],
    coverages = [],
    priorInsurance = [],
    drivers = [],
    vehicles = [],
    profileData = {},
  } = req.body
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const currentProfileData = parseJson(customer.profileData, {})
  const mergedProfileData = { ...currentProfileData, ...profileData }

  await prisma.driver.deleteMany({ where: { customerId } })
  await prisma.vehicle.deleteMany({ where: { customerId } })

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: name ?? customer.name,
      preferredLangs: JSON.stringify(preferredLangs),
      coverages: JSON.stringify(coverages),
      priorInsurance: JSON.stringify(priorInsurance),
      profileData: JSON.stringify(mergedProfileData),
      drivers: {
        create: drivers.map((driver) => ({
          name: driver.name,
          licenseNo: driver.licenseNo,
          birthDate: new Date(driver.birthDate || new Date()),
          relationship: driver.relationship || 'Self',
        })),
      },
      vehicles: {
        create: vehicles.map((v) => ({
          year: v.year || 2020,
          make: v.make || 'Unknown',
          model: v.model || 'Vehicle',
          vin: v.vin || `VIN-${Date.now()}`,
          primaryUse: v.primaryUse || 'Commute',
        })),
      },
    },
    include: { drivers: true, vehicles: true },
  })
  if (req.user.role === 'CUSTOMER') {
    notifyProfileUpdated({ user: req.user }).catch((err) =>
      console.error('profile update notification error', err)
    )
  }
  res.status(201).json({ profile: formatCustomerProfile(updated) })
})

router.patch('/:id/profile-data', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const updates = req.body?.profileData || {}
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, ...updates }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      profileData: JSON.stringify(updatedProfileData),
    },
    include: { drivers: true, vehicles: true },
  })
  if (req.user.role === 'CUSTOMER') {
    notifyProfileUpdated({ user: req.user }).catch((err) =>
      console.error('profile update notification error', err)
    )
  }
  res.json({ profile: formatCustomerProfile(updated) })
})

router.patch('/:id/name', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const firstName = String(req.body?.firstName || '').trim()
  const middleName = String(req.body?.middleName || '').trim()
  const lastName = String(req.body?.lastName || '').trim()
  const fullName = buildFullName(firstName, middleName, lastName)
  if (!fullName) {
    return res.status(400).json({ error: 'Name is required' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = { ...currentProfileData, firstName, middleName, lastName }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: fullName,
      profileData: JSON.stringify(updatedProfileData),
    },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_NAME_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ profile: formatCustomerProfile(updated) })
})

router.post('/:id/name-change/request', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  if (!req.user.email) {
    return res.status(400).json({ error: 'Email is required to verify name changes' })
  }
  const firstName = String(req.body?.firstName || '').trim()
  const middleName = String(req.body?.middleName || '').trim()
  const lastName = String(req.body?.lastName || '').trim()
  const fullName = buildFullName(firstName, middleName, lastName)
  if (!fullName) {
    return res.status(400).json({ error: 'Name is required' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const lastChangedAt = parseDateValue(
    currentProfileData.nameChangedAt || currentProfileData.name_changed_at
  )
  if (lastChangedAt && Date.now() - lastChangedAt.getTime() < NAME_CHANGE_COOLDOWN_MS) {
    return res.status(400).json({ error: 'Name can only be changed once every 24 hours.' })
  }
  const ip = getRequestIp(req)
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const userAgent = String(req.headers['user-agent'] || '')
  try {
    const result = await sendEmailOtp(req.user.email, { ip, template: 'name_change', userId: req.user.id })
    const updatedProfileData = {
      ...currentProfileData,
      nameChangePending: {
        firstName,
        middleName,
        lastName,
        requestedAt: new Date().toISOString(),
      },
    }
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        profileData: JSON.stringify(updatedProfileData),
      },
      include: { drivers: true, vehicles: true },
    })
    await logClientAudit(customerId, 'CLIENT_NAME_CHANGE_REQUESTED', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
    })
    return res.json({ sent: true, delivery: result.delivery, profile: formatCustomerProfile(updated) })
  } catch (err) {
    return handleOtpSendError(err, res)
  }
})

router.post('/:id/name-change/confirm', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  if (!req.user.email) {
    return res.status(400).json({ error: 'Email is required to verify name changes' })
  }
  const code = String(req.body?.code || '').trim()
  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' })
  }
  const currentProfileData = parseJson(customer.profileData, {})
  const lastChangedAt = parseDateValue(
    currentProfileData.nameChangedAt || currentProfileData.name_changed_at
  )
  if (lastChangedAt && Date.now() - lastChangedAt.getTime() < NAME_CHANGE_COOLDOWN_MS) {
    return res.status(400).json({ error: 'Name can only be changed once every 24 hours.' })
  }
  const pending = currentProfileData.nameChangePending || {}
  const firstName = String(pending.firstName || '').trim()
  const middleName = String(pending.middleName || '').trim()
  const lastName = String(pending.lastName || '').trim()
  const fullName = buildFullName(firstName, middleName, lastName)
  if (!fullName) {
    return res.status(400).json({ error: 'No pending name change found.' })
  }
  const result = await verifyEmailOtp(req.user.email, code)
  if (!result.valid) {
    return res.status(400).json({ error: result.error || 'Invalid code' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const updatedProfileData = {
    ...currentProfileData,
    firstName,
    middleName,
    lastName,
    nameChangedAt: new Date().toISOString(),
  }
  delete updatedProfileData.nameChangePending
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: fullName,
      profileData: JSON.stringify(updatedProfileData),
    },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_NAME_UPDATED', {
    session_id: sessionId,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  return res.json({ profile: formatCustomerProfile(updated) })
})

router.patch('/:id/preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const language = req.body?.language ? String(req.body.language).trim() : ''
  const timezone = req.body?.timezone ? String(req.body.timezone).trim() : ''
  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = {
    ...currentProfileData,
    language: language || currentProfileData.language || null,
    timezone: timezone || currentProfileData.timezone || null,
  }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })
  await logClientAudit(customerId, 'CLIENT_PREFERENCES_UPDATED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ profile: formatCustomerProfile(updated) })
})

router.post('/:id/forms/start', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }

  const currentProfileData = parseJson(customer.profileData, {})
  const updatedProfileData = {
    ...currentProfileData,
    profile_status: 'draft',
    current_section: 'Household Information',
    forms_started: true,
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { drivers: true, vehicles: true },
  })

  await logClientAudit(customerId, 'CLIENT_ONBOARDING_CTA_CLICKED')
  await logClientAudit(customerId, 'CLIENT_FORMS_FLOW_STARTED', { current_section: 'Household Information' })

  res.json({ profile: formatCustomerProfile(updated) })
})

router.post('/:id/forms/section-load', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }

  const formSlug = String(req.body?.formSlug || '').trim() || 'create-profile'
  const sectionKey = normalizeSectionKey(req.body?.sectionKey || '')
  if (!sectionKey) return res.status(400).json({ error: 'Section key is required' })

  const profileData = parseJson(customer.profileData, {})
  const forms = isPlainObject(profileData.forms) ? profileData.forms : {}
  const values = extractSectionValues(forms, sectionKey)

  return res.json({
    formSlug,
    sectionKey,
    values,
  })
})

router.post('/:id/forms/section-save', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }

  const section = req.body?.section || ''
  const sectionKey = normalizeSectionKey(req.body?.sectionKey || section)
  const nextSection = req.body?.nextSection || ''

  const logClick = req.body?.logClick !== false
  if (logClick) {
    await logClientAudit(customerId, 'CLIENT_FORMS_SAVE_CONTINUE_CLICKED', {
      section,
    })
  }

  const currentProfileData = parseJson(customer.profileData, {})
  const incomingProfileData = req.body?.profileData || {}
  const requestedStatus = req.body?.profileStatus || incomingProfileData.profile_status
  const nextProfileStatus = requestedStatus || currentProfileData.profile_status || 'draft'
  const valuesPayload = req.body?.values
  const hasValues = valuesPayload && typeof valuesPayload === 'object' && !Array.isArray(valuesPayload)
  const existingForms = isPlainObject(incomingProfileData.forms)
    ? incomingProfileData.forms
    : isPlainObject(currentProfileData.forms)
      ? currentProfileData.forms
      : {}

  const mergedForms = hasValues && sectionKey
    ? mergeSectionValuesIntoForms(existingForms, sectionKey, valuesPayload)
    : existingForms

  const updatedProfileData = {
    ...currentProfileData,
    ...incomingProfileData,
    forms: mergedForms,
    profile_status: nextProfileStatus,
    current_section: nextSection || currentProfileData.current_section,
    forms_started: true,
  }

  let serializedProfileData = ''
  try {
    serializedProfileData = safeStringify(updatedProfileData)
  } catch (error) {
    console.error('forms section-save serialization error', error)
    return res.status(400).json({
      error: 'Invalid profile data payload',
      detail: process.env.NODE_ENV === 'production' ? undefined : error?.message,
    })
  }

  try {
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { profileData: serializedProfileData },
      include: { drivers: true, vehicles: true },
    })
    await logClientAudit(customerId, 'CLIENT_FORM_SECTION_SAVED', {
      section,
      result: 'SUCCESS',
    })
    if (nextSection === 'Summary') {
      await logClientAudit(customerId, 'CLIENT_PROFILE_SUMMARY_VIEWED')
      if (currentProfileData.profile_status !== 'completed' && nextProfileStatus === 'completed') {
        await logClientAudit(customerId, 'CLIENT_PROFILE_COMPLETED')
      }
    }
    if (
      req.user?.role === 'CUSTOMER' &&
      (nextSection === 'Summary' ||
        (currentProfileData.profile_status !== 'completed' && nextProfileStatus === 'completed'))
    ) {
      notifyProfileUpdated({ user: req.user }).catch((err) =>
        console.error('profile update notification error', err)
      )
    }
    return res.json({ profile: formatCustomerProfile(updated) })
  } catch (error) {
    console.error('forms section-save update error', error)
    await logClientAudit(customerId, 'CLIENT_FORM_SECTION_SAVED', {
      section,
      result: 'FAILED',
    })
    return res.status(500).json({
      error: 'Failed to save profile section',
      detail: process.env.NODE_ENV === 'production' ? undefined : error?.message,
    })
  }
})

router.post('/:id/tab-view', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const tabName = String(req.body?.tabName || '').trim()
  if (!customerId || !tabName) return res.status(400).json({ error: 'Customer id and tab name are required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const profileStatus = req.body?.profileStatus ? String(req.body.profileStatus) : null
  const currentSection = req.body?.currentSection ? String(req.body.currentSection) : null

  await logClientAudit(customerId, 'CLIENT_TAB_VIEWED', {
    tab_name: tabName,
    session_id: sessionId,
    profile_status: profileStatus,
    current_section: currentSection,
  })
  if (tabName.toLowerCase() === 'my insurance passport') {
    await logClientAudit(customerId, 'CLIENT_INSURANCE_PASSPORT_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
      profile_status: profileStatus,
      current_section: currentSection,
    })
  }
  if (tabName.toLowerCase() === 'forms') {
    await logClientAudit(customerId, 'CLIENT_FORMS_TAB_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
      profile_status: profileStatus,
      current_section: currentSection,
    })
  }
  if (tabName.toLowerCase() === 'settings') {
    await logClientAudit(customerId, 'CLIENT_SETTINGS_VIEWED', {
      tab_name: tabName,
      session_id: sessionId,
    })
  }
  res.json({ ok: true })
})

router.get('/:id/notification-preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const profileData = parseJson(customer.profileData, {})
  const prefs = await ensureNotificationPreferences(prisma, req.user.id, {
    updatedByUserId: req.user.id,
    legacyPreferences: profileData.notification_prefs,
  })
  const legacyPrefs = mapPreferencesToLegacy(prefs)
  const hash = buildNotificationHash(legacyPrefs)
  const sessionId = req.query?.sessionId ? String(req.query.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_NOTIFICATION_PREFERENCES_VIEWED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    new_preferences_hash: hash,
  })
  res.json({ preferences: legacyPrefs })
})

router.put('/:id/notification-preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const profileData = parseJson(customer.profileData, {})
  const existing = await ensureNotificationPreferences(prisma, req.user.id, {
    updatedByUserId: req.user.id,
    legacyPreferences: profileData.notification_prefs,
  })
  const previousLegacy = mapPreferencesToLegacy(existing)
  const nextLegacy = mapPreferencesToLegacy(deriveFromLegacyPreferences(req.body?.preferences || {}))
  const previousHash = buildNotificationHash(previousLegacy)
  const newHash = buildNotificationHash(nextLegacy)
  const channelChanged = []
  if (previousLegacy.email !== nextLegacy.email) channelChanged.push('email')
  if (previousLegacy.inapp !== nextLegacy.inapp) channelChanged.push('inapp')
  if (previousLegacy.loginAlerts !== nextLegacy.loginAlerts) channelChanged.push('login_alerts')
  const groupsChanged =
    previousLegacy.groups.passport !== nextLegacy.groups.passport ||
    previousLegacy.groups.system !== nextLegacy.groups.system
  if (groupsChanged && !channelChanged.includes('inapp')) {
    channelChanged.push('inapp')
  }
  const nextDerived = deriveFromLegacyPreferences(req.body?.preferences || {})
  const updated = await prisma.notificationPreferences.update({
    where: { userId: req.user.id },
    data: {
      emailProfileUpdatesEnabled: nextDerived.emailProfileUpdatesEnabled,
      emailFeatureUpdatesEnabled: nextDerived.emailFeatureUpdatesEnabled,
      emailMarketingEnabled: nextDerived.emailMarketingEnabled,
      preferencesVersion: (existing.preferencesVersion || 0) + 1,
      updatedByUserId: req.user.id,
    },
  })
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_NOTIFICATION_PREFERENCES_UPDATED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    previous_preferences_hash: previousHash,
    new_preferences_hash: newHash,
    channel_changed: channelChanged,
  })
  res.json({
    preferences: mapPreferencesToLegacy(updated),
  })
})

router.put('/:id/cookie-preferences', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this customer' })
  }
  const nextPref = normalizeCookiePreference(req.body?.preference)
  const profileData = parseJson(customer.profileData, {})
  const previousPref = normalizeCookiePreference(profileData.cookie_preference)
  if (previousPref === nextPref) {
    return res.json({ preference: previousPref, unchanged: true })
  }
  const updatedAt = new Date()
  const updatedProfileData = {
    ...profileData,
    cookie_preference: nextPref,
    cookie_pref_updated_at: updatedAt.toISOString(),
  }
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { profileData: JSON.stringify(updatedProfileData) },
    include: { user: true },
  })
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_COOKIE_PREFERENCES_UPDATED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    previous_cookie_pref: previousPref,
    new_cookie_pref: nextPref,
  })
  const timestamp = updatedAt.toLocaleString()
  let emailDelivery = 'disabled'
  try {
    const content = buildCookiePrefEmail(timestamp)
    const emailResult = await sendEmail({
      to: updated.user?.email || customer.user?.email,
      subject: 'Your cookie preferences were updated',
      text: content.text,
      html: content.html,
      replyTo: 'privacy@connsura.com',
    })
    emailDelivery = emailResult?.delivery || 'smtp'
    await logClientAudit(customerId, 'PRIVACY_EMAIL_SENT', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
      type: 'cookie_preferences_receipt',
      result: 'success',
      delivery: emailDelivery,
    })
  } catch (err) {
    console.error('cookie pref email error', err)
    await logClientAudit(customerId, 'PRIVACY_EMAIL_SENT', {
      session_id: sessionId,
      ip,
      user_agent: userAgent,
      type: 'cookie_preferences_receipt',
      result: 'failed',
      reason: 'email_send_failed',
    })
  }
  res.json({
    preference: normalizeCookiePreference(
      parseJson(updated.profileData, {}).cookie_preference || nextPref
    ),
  })
})

router.post('/:id/inapp-notice', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const noticeType = req.body?.type ? String(req.body.type) : ''
  await logClientAudit(customerId, 'INAPP_NOTICE_SHOWN', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
    type: noticeType,
  })
  await logInAppNotification({
    eventType: 'IN_APP_NOTICE',
    severity: 'INFO',
    userId: req.user.id,
    required: true,
    metadata: { type: noticeType || null },
    actorType: 'USER',
    actorUserId: req.user.id,
  })
  res.json({ ok: true })
})

router.post('/:id/login-alerts/view', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  await logClientAudit(customerId, 'CLIENT_LOGIN_ALERTS_VIEWED', {
    session_id: req.body?.sessionId ? String(req.body.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({ ok: true })
})

router.get('/:id/login-activity', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const entries = await prisma.auditLog.findMany({
    where: {
      targetType: 'Client',
      targetId: String(customerId),
      action: 'CLIENT_LOGIN_SUCCESS',
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  await logClientAudit(customerId, 'CLIENT_LOGIN_ACTIVITY_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  const activity = entries.map((entry) => {
    const diff = parseAuditDiff(entry.diff)
    return {
      id: entry.id,
      ip: diff.ip || '',
      userAgent: diff.user_agent || '',
      location: diff.location || null,
      city: diff.city || null,
      region: diff.region || null,
      country: diff.country || null,
      timestamp: entry.createdAt,
    }
  })
  res.json({ activity })
})

router.get('/:id/active-sessions', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.query?.sessionId ? String(req.query.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  if (sessionId) {
    await prisma.userSession
      .updateMany({
        where: { userId: req.user.id, sessionId },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {})
  }
  const rows = await prisma.userSession.findMany({
    where: { userId: req.user.id, revokedAt: null },
    orderBy: { lastSeenAt: 'desc' },
    take: 20,
  })
  await logClientAudit(customerId, 'CLIENT_ACTIVE_SESSIONS_VIEWED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
  })
  const sessions = rows.map((row) => ({
    id: row.sessionId,
    current: sessionId ? row.sessionId === sessionId : false,
    ip: row.ip || '',
    userAgent: row.userAgent || '',
    location: row.locationLabel || null,
    city: row.city || null,
    region: row.region || null,
    country: row.country || null,
    lastSeenAt: row.lastSeenAt,
  }))
  if (!sessions.length) {
    sessions.push({
      id: sessionId || 'current',
      current: true,
      ip,
      userAgent,
      lastSeenAt: new Date().toISOString(),
    })
  }
  res.json({ sessions })
})

router.get('/:id/shared-profile-activity', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const shares = await prisma.profileShare.findMany({
    where: { customerId },
    orderBy: { updatedAt: 'desc' },
  })
  await logClientAudit(customerId, 'CLIENT_SHARED_PROFILE_ACTIVITY_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  const activity = shares.map((share) => ({
    id: share.id,
    recipient: share.recipientName || 'Shared link',
    status: share.status,
    lastAccessedAt: share.lastAccessedAt,
  }))
  res.json({ activity })
})

router.get('/:id/consent-history', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const consents = await prisma.userConsent.findMany({
    where: { userId: customer.userId },
    orderBy: { consentedAt: 'desc' },
  })
  await logClientAudit(customerId, 'CLIENT_CONSENT_HISTORY_VIEWED', {
    session_id: req.query?.sessionId ? String(req.query.sessionId) : null,
    ip: getRequestIp(req),
    user_agent: String(req.headers['user-agent'] || ''),
  })
  res.json({
    consents: consents.map((row) => ({
      id: row.id,
      documentType: row.documentType,
      version: row.version,
      role: row.role,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      consentedAt: row.consentedAt,
      consentItems: row.consentItems ? parseJson(row.consentItems, null) : null,
    })),
  })
})

router.post('/:id/delete-account/click', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_DELETE_ACCOUNT_CLICKED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
  })
  res.json({ ok: true })
})

router.post('/:id/2fa/disable-click', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : null
  const ip = getRequestIp(req)
  const userAgent = String(req.headers['user-agent'] || '')
  await logClientAudit(customerId, 'CLIENT_2FA_DISABLE_STARTED', {
    session_id: sessionId,
    ip,
    user_agent: userAgent,
    result: 'started',
  })
  res.json({ ok: true })
})

router.post('/:id/forms/additional/remove', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  if (!customerId) return res.status(400).json({ error: 'Customer id required' })
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Forbidden' })
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (customer.userId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot access this customer' })
  }
  const formName = req.body?.formName || ''
  await logClientAudit(customerId, 'CLIENT_ADDITIONAL_FORM_REMOVED', {
    formName,
  })
  res.json({ ok: true })
})

module.exports = router
