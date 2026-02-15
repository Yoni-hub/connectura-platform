const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()
const seedPassword = process.env.SEED_USER_PASSWORD
if (!seedPassword) {
  throw new Error('SEED_USER_PASSWORD is required to run the seed script')
}

const customersData = [
  {
    name: 'Jordan Lee',
    email: 'jordan@connsura.test',
    preferredLangs: ['English'],
    priorInsurance: [{ carrier: 'Allstate', months: 24, lapse: false }],
    coverages: ['Full coverage', 'Roadside', 'Rental car'],
    profileData: { contact: { phone: '555-123-7890', bestTime: 'Afternoon' } },
    drivers: [
      { name: 'Jordan Lee', licenseNo: 'LEEJ742', birthDate: '1992-03-11', relationship: 'Self' },
    ],
    vehicles: [
      { year: 2021, make: 'Toyota', model: 'RAV4', vin: 'JT3BG29V4M1234567', primaryUse: 'Commute' },
    ],
  },
  {
    name: 'Alexis Morgan',
    email: 'alexis@connsura.test',
    preferredLangs: ['English', 'Spanish'],
    priorInsurance: [{ carrier: 'Geico', months: 36, lapse: false }],
    coverages: ['Liability', 'Comprehensive', 'Collision'],
    profileData: { contact: { phone: '555-222-9999', bestTime: 'Morning' } },
    drivers: [
      { name: 'Alexis Morgan', licenseNo: 'MORG223', birthDate: '1987-07-21', relationship: 'Self' },
      { name: 'Taylor Morgan', licenseNo: 'MORG990', birthDate: '1990-12-02', relationship: 'Spouse' },
    ],
    vehicles: [
      { year: 2019, make: 'Honda', model: 'Civic', vin: '2HGES16545H123456', primaryUse: 'Commute' },
      { year: 2023, make: 'Subaru', model: 'Outback', vin: '4S4BTANC5N3123456', primaryUse: 'Family' },
    ],
  },
]

async function reset() {
  await prisma.driver.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
}

async function seedCustomers(hashedPassword) {
  for (const customer of customersData) {
    await prisma.user.create({
      data: {
        email: customer.email,
        password: hashedPassword,
        role: 'CUSTOMER',
        notificationPreferences: {
          create: {
            emailProfileUpdatesEnabled: false,
            emailFeatureUpdatesEnabled: true,
            emailMarketingEnabled: false,
            preferencesVersion: 1,
          },
        },
        customer: {
          create: {
            name: customer.name,
            preferredLangs: JSON.stringify(customer.preferredLangs),
            priorInsurance: JSON.stringify(customer.priorInsurance),
            coverages: JSON.stringify(customer.coverages),
            profileData: JSON.stringify(customer.profileData || {}),
            drivers: {
              create: customer.drivers.map((driver) => ({
                name: driver.name,
                licenseNo: driver.licenseNo,
                birthDate: new Date(driver.birthDate),
                relationship: driver.relationship,
              })),
            },
            vehicles: {
              create: customer.vehicles.map((vehicle) => ({
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
                vin: vehicle.vin,
                primaryUse: vehicle.primaryUse,
              })),
            },
          },
        },
      },
      include: { customer: true },
    })
  }
}

async function main() {
  await reset()
  const hashedPassword = await bcrypt.hash(seedPassword, 10)
  await seedCustomers(hashedPassword)
  console.log('Seed data created: 2 customers')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
