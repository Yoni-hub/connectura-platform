const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()
const seedPassword = process.env.SEED_USER_PASSWORD
if (!seedPassword) {
  throw new Error('SEED_USER_PASSWORD is required to run the seed script')
}

const agentsData = [
  {
    name: 'Sarah Tesfaye',
    email: 'sarah@connsura.test',
    bio: 'Bilingual agent focused on personal lines. Quick on renewals and transparent on coverage.',
    languages: ['English', 'Amharic', 'Spanish'],
    states: ['TX', 'VA', 'NY'],
    specialty: 'Auto / Home / Renters',
    availability: 'online',
    rating: 4.9,
    photo: '/uploads/agents/agent1.svg',
    producerNumber: 'PN-1001',
    address: '123 Market St, Dallas, TX',
    zip: '75201',
    products: ['Auto', 'Home', 'Renters'],
    appointedCarriers: ['Travelers', 'Progressive', 'Nationwide'],
    reviews: [
      { author: 'Luis', comment: 'Sarah explained coverages clearly.', rating: 5 },
      { author: 'Aisha', comment: 'Great bilingual support.', rating: 5 },
    ],
  },
  {
    name: 'Miguel Alvarez',
    email: 'miguel@connsura.test',
    bio: 'Motorcycle friendly agent with fast turnaround and weekend availability.',
    languages: ['English', 'Spanish'],
    states: ['NM', 'AZ', 'TX'],
    specialty: 'Auto / Motorcycle',
    availability: 'busy',
    rating: 4.7,
    photo: '/uploads/agents/agent2.svg',
    producerNumber: 'PN-2002',
    address: '456 Canyon Rd, Albuquerque, NM',
    zip: '87101',
    products: ['Auto', 'Motorcycle'],
    appointedCarriers: ['Geico', 'Progressive'],
    reviews: [
      { author: 'Renee', comment: 'Understood my bike coverage needs.', rating: 4.5 },
      { author: 'Jorge', comment: 'Quick quote and follow up.', rating: 4.7 },
    ],
  },
  {
    name: 'Priya Raman',
    email: 'priya@connsura.test',
    bio: 'Home/auto bundling expert with clear explanations.',
    languages: ['English', 'Hindi', 'Tamil'],
    states: ['IL', 'IN', 'MI'],
    specialty: 'Auto / Home / Umbrella',
    availability: 'offline',
    rating: 4.8,
    photo: '/uploads/agents/agent3.svg',
    producerNumber: 'PN-3003',
    address: '789 Lake Shore Dr, Chicago, IL',
    zip: '60601',
    products: ['Auto', 'Home', 'Umbrella'],
    appointedCarriers: ['State Farm', 'Liberty Mutual'],
    reviews: [
      { author: 'Marcus', comment: 'Helpful with condo questions.', rating: 4.8 },
      { author: 'Lakshmi', comment: 'Loved the bilingual guidance.', rating: 5 },
    ],
  },
]

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
  await prisma.agent.deleteMany()
  await prisma.user.deleteMany()
}

async function seedAgents(hashedPassword) {
  for (const agent of agentsData) {
    await prisma.user.create({
      data: {
        email: agent.email,
        password: hashedPassword,
        role: 'AGENT',
        agent: {
          create: {
            name: agent.name,
            bio: agent.bio,
            languages: JSON.stringify(agent.languages),
            states: JSON.stringify(agent.states),
            specialty: agent.specialty,
            producerNumber: agent.producerNumber,
            address: agent.address,
            zip: agent.zip,
            products: JSON.stringify(agent.products),
            appointedCarriers: JSON.stringify(agent.appointedCarriers || []),
            availability: agent.availability,
            rating: agent.rating,
            reviews: JSON.stringify(agent.reviews),
            photo: agent.photo,
          },
        },
      },
    })
  }
}

async function seedCustomers(hashedPassword) {
  for (const customer of customersData) {
    await prisma.user.create({
      data: {
        email: customer.email,
        password: hashedPassword,
        role: 'CUSTOMER',
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
      include: { agent: true },
    })
  }
}

async function main() {
  await reset()
  const hashedPassword = await bcrypt.hash(seedPassword, 10)
  await seedAgents(hashedPassword)
  await seedCustomers(hashedPassword)
  console.log('Seed data created: 3 agents, 2 customers')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
