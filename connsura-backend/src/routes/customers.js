const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')

const router = express.Router()

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
  sharedWithAgent: customer.sharedWithAgent,
  preferredAgentId: customer.preferredAgentId,
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
  res.json({ profile: formatCustomerProfile(updated), photo: photoPath })
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

  await prisma.driver.deleteMany({ where: { customerId } })
  await prisma.vehicle.deleteMany({ where: { customerId } })

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: name ?? customer.name,
      preferredLangs: JSON.stringify(preferredLangs),
      coverages: JSON.stringify(coverages),
      priorInsurance: JSON.stringify(priorInsurance),
      profileData: JSON.stringify(profileData),
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
  res.status(201).json({ profile: formatCustomerProfile(updated) })
})

router.put('/:id/profile', authGuard, async (req, res) => {
  const customerId = Number(req.params.id)
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { drivers: true, vehicles: true },
  })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (req.user.role === 'CUSTOMER' && req.user.id !== customer.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const { sharedWithAgent, preferredAgentId } = req.body
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      sharedWithAgent: sharedWithAgent ?? customer.sharedWithAgent,
      preferredAgentId: preferredAgentId ?? customer.preferredAgentId,
    },
    include: { drivers: true, vehicles: true },
  })
  res.json({ profile: formatCustomerProfile(updated) })
})

module.exports = router
