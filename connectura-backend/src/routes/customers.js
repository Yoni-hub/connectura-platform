const express = require('express')
const prisma = require('../prisma')
const { authGuard } = require('../middleware/auth')
const { parseJson } = require('../utils/transform')

const router = express.Router()

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
