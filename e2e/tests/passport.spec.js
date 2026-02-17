import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..', '..')
const backendEnvPath = path.join(repoRoot, 'connsura-backend', '.env')

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const apiURL = process.env.E2E_API_URL || 'http://localhost:8000'

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const entries = {}
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const splitIndex = line.indexOf('=')
    if (splitIndex === -1) continue
    const key = line.slice(0, splitIndex).trim()
    let value = line.slice(splitIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    entries[key] = value
  }
  return entries
}

const loadAdminCredentials = () => {
  const fileEnv = parseEnvFile(backendEnvPath)
  const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || fileEnv.ADMIN_EMAIL
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || fileEnv.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    throw new Error('Missing admin credentials for e2e tests.')
  }
  return { adminEmail, adminPassword }
}

const adminLogin = async (request) => {
  const { adminEmail, adminPassword } = loadAdminCredentials()
  const res = await request.post(`${apiURL}/admin/login`, {
    data: { email: adminEmail, password: adminPassword },
  })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  return payload.token
}

const randomSuffix = () => `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`

const createCustomer = async (request) => {
  const suffix = randomSuffix()
  const email = `passport-e2e+${suffix}@example.com`
  const password = `P@ss-${suffix}!`
  const register = await request.post(`${apiURL}/auth/register`, {
    data: {
      email,
      password,
      name: `Passport User ${suffix}`,
      role: 'CUSTOMER',
      consents: {
        terms: true,
        privacy: true,
        emailCommunications: true,
        platformDisclaimer: true,
      },
    },
  })
  expect(register.ok()).toBeTruthy()
  const payload = await register.json()
  return { email, password, token: payload.token }
}

const setCustomerSession = async (page, token) => {
  await page.addInitScript((value) => {
    localStorage.setItem('connsura_token', value)
  }, token)
}

const createAdminProductWithMapping = async (request, adminToken) => {
  const suffix = randomSuffix()
  const productName = `Auto Product ${suffix}`
  const createProduct = await request.post(`${apiURL}/admin/products`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: productName },
  })
  expect(createProduct.ok()).toBeTruthy()
  const product = (await createProduct.json()).product

  const q1 = `Driver First Name ${suffix}`
  const q2 = `Residential City ${suffix}`
  const q3 = `Vehicle VIN ${suffix}`
  const createQuestions = await request.post(`${apiURL}/admin/questions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { texts: [q1, q2, q3], productId: product.id },
  })
  expect(createQuestions.ok()).toBeTruthy()
  const createdQuestions = (await createQuestions.json()).questions
  const findQuestion = (label) => createdQuestions.find((row) => row.text === label)
  const q1Id = findQuestion(q1)?.id
  const q2Id = findQuestion(q2)?.id
  const q3Id = findQuestion(q3)?.id
  expect(q1Id).toBeTruthy()
  expect(q2Id).toBeTruthy()
  expect(q3Id).toBeTruthy()

  const mapping = {
    sections: [
      { key: 'driver', label: 'Driver', questionIds: [q1Id] },
      { key: 'address', label: 'Address', questionIds: [q2Id, q3Id] },
    ],
  }
  const saveMapping = await request.put(`${apiURL}/admin/forms/products/${product.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: productName, formSchema: mapping },
  })
  expect(saveMapping.ok()).toBeTruthy()

  return { product, mapping, questionTexts: { q1, q2, q3 } }
}

test.describe.serial('My Passport', () => {
  test('1) Admin sets product mapping with 2 sections and 3 questions', async ({ request }) => {
    const token = await adminLogin(request)
    const { product, mapping } = await createAdminProductWithMapping(request, token)
    const verify = await request.get(`${apiURL}/admin/forms/products`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(verify.ok()).toBeTruthy()
    const products = (await verify.json()).products || []
    const saved = products.find((row) => row.id === product.id)
    expect(saved).toBeTruthy()
    expect(saved.formSchema.sections.length).toBe(2)
    expect(saved.formSchema.sections[0].questionIds.length).toBe(mapping.sections[0].questionIds.length)
    expect(saved.formSchema.sections[1].questionIds.length).toBe(mapping.sections[1].questionIds.length)
  })

  test('2) Customer uses admin product, saves values, refresh hydrates values', async ({ page, request }) => {
    const adminToken = await adminLogin(request)
    const setup = await createAdminProductWithMapping(request, adminToken)
    const customer = await createCustomer(request)

    await setCustomerSession(page, customer.token)
    await page.goto(`${baseURL}/passport`)
    await expect(page.getByRole('heading', { name: 'My Passport' })).toBeVisible()
    await page.selectOption('select', { label: setup.product.name })
    await page.getByRole('button', { name: 'Create from existing' }).click()

    await expect(page.getByLabel(setup.questionTexts.q1).first()).toBeVisible()
    await page.getByLabel(setup.questionTexts.q1).first().fill('Yoni')
    await page.getByRole('button', { name: 'Save section' }).click()

    await page.getByRole('button', { name: 'Address' }).click()
    await page.getByLabel(setup.questionTexts.q2).first().fill('New York')
    await page.getByLabel(setup.questionTexts.q3).first().fill('VIN-123-XYZ')
    await page.getByRole('button', { name: 'Save section' }).click()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Driver' })).toBeVisible()
    await expect(page.getByLabel(setup.questionTexts.q1).first()).toHaveValue('Yoni')
    await page.getByRole('button', { name: 'Address' }).click()
    await expect(page.getByLabel(setup.questionTexts.q2).first()).toHaveValue('New York')
    await expect(page.getByLabel(setup.questionTexts.q3).first()).toHaveValue('VIN-123-XYZ')
  })

  test('3) Customer custom product with custom questions saves and hydrates after refresh', async ({ page, request }) => {
    const customer = await createCustomer(request)
    const customProductName = `Custom Product ${randomSuffix()}`

    await setCustomerSession(page, customer.token)
    await page.goto(`${baseURL}/passport`)
    await expect(page.getByRole('heading', { name: 'My Passport' })).toBeVisible()

    await page.getByPlaceholder('Custom product name').fill(customProductName)
    await page.getByRole('button', { name: 'Create custom' }).click()

    await expect(page.getByText('Build your custom form')).toBeVisible()
    await page.getByPlaceholder('Question 1').fill('Custom question A')
    await page.getByRole('button', { name: 'Add question' }).click()
    await page.getByPlaceholder('Question 2').fill('Custom question B')
    await page.getByRole('button', { name: 'Save custom questions' }).click()

    await expect(page.getByLabel('Custom question A').first()).toBeVisible()
    await page.getByLabel('Custom question A').first().fill('Answer A')
    await page.getByLabel('Custom question B').first().fill('Answer B')
    await page.getByRole('button', { name: 'Save section' }).click()

    await page.reload()
    await expect(page.getByLabel('Custom question A').first()).toHaveValue('Answer A')
    await expect(page.getByLabel('Custom question B').first()).toHaveValue('Answer B')
  })

  test('4) Customer has multiple instances and can remove one', async ({ page, request }) => {
    const adminToken = await adminLogin(request)
    const setup = await createAdminProductWithMapping(request, adminToken)
    const customer = await createCustomer(request)
    const customName = `Second Product ${randomSuffix()}`

    await setCustomerSession(page, customer.token)
    await page.goto(`${baseURL}/passport`)
    await expect(page.getByRole('heading', { name: 'My Passport' })).toBeVisible()

    await page.selectOption('select', { label: setup.product.name })
    await page.getByRole('button', { name: 'Create from existing' }).click()
    await expect(page.getByRole('link', { name: 'Back to My Passport' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to My Passport' }).click()

    await page.getByPlaceholder('Custom product name').fill(customName)
    await page.getByRole('button', { name: 'Create custom' }).click()
    await expect(page.getByRole('link', { name: 'Back to My Passport' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to My Passport' }).click()

    const cardsBefore = page.locator('div.rounded-xl.border.border-slate-200.bg-slate-50')
    await expect(cardsBefore).toHaveCount(2)
    await page.getByRole('button', { name: 'Remove' }).first().click()
    const cardsAfter = page.locator('div.rounded-xl.border.border-slate-200.bg-slate-50')
    await expect(cardsAfter).toHaveCount(1)
  })
})
