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

const buildE2ePassword = () => {
  const override = process.env.E2E_USER_PASSWORD
  if (override) return override
  const suffix = crypto.randomBytes(8).toString('hex')
  return `E2E-${suffix}!`
}

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
    throw new Error(
      'Admin credentials not found. Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD in connsura-backend/.env.'
    )
  }
  return { adminEmail, adminPassword }
}

const loginAdmin = async (request, adminEmail, adminPassword) => {
  const res = await request.post(`${apiURL}/admin/login`, {
    data: { email: adminEmail, password: adminPassword },
  })
  if (!res.ok()) {
    throw new Error(`Admin login failed: ${res.status()}`)
  }
  const payload = await res.json()
  if (!payload?.token) {
    throw new Error('Admin login did not return a token.')
  }
  return payload.token
}

const fetchEmailOtp = async (request, token, email) => {
  const res = await request.get(`${apiURL}/admin/email-otp?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok()) {
    throw new Error(`Failed to fetch email OTP: ${res.status()}`)
  }
  const payload = await res.json()
  if (!payload?.code) {
    throw new Error('Email OTP code missing in response.')
  }
  return payload.code
}

const clickVisibleButton = async (page, name) => {
  const button = page.locator('button:visible', { hasText: name }).first()
  await expect(button).toBeVisible()
  await button.click()
}

const timedStep = async (label, fn) => {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    const elapsed = Date.now() - start
    console.log(`[timing] ${label}: ${elapsed}ms`)
  }
}

const verifyEmailIfNeeded = async (page, request, email, adminEmail, adminPassword) => {
  const verifyButton = page.getByRole('button', { name: /verify email/i })
  if (await verifyButton.isVisible()) {
    await verifyButton.click()
    await expect(page.getByText('Enter verification code:')).toBeVisible()
    const token = await loginAdmin(request, adminEmail, adminPassword)
    const code = await fetchEmailOtp(request, token, email)
    const codeInput = page.getByText('Enter verification code:').locator('..').getByRole('textbox')
    await codeInput.fill(code)
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(verifyButton).toBeHidden()
  }
}

const openSectionForEditing = async (page, sectionName, fieldLabel) => {
  const sectionButton = page.getByRole('button', { name: sectionName })
  await expect(sectionButton).toBeVisible()
  await sectionButton.click()

  const field = page.getByLabel(fieldLabel).first()
  try {
    await expect(field).toBeVisible({ timeout: 2000 })
  } catch (error) {
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    if (await editButton.isVisible()) {
      await editButton.click()
    }
    await expect(field).toBeVisible()
  }
}

const fillCreateProfile = async (page, email) => {
  await timedStep('Fill household section', async () => {
    await openSectionForEditing(page, /household information/i, 'Relation To Applicant')
    await page.getByLabel('Relation To Applicant').selectOption({ label: 'Named Insured' })
    await page.getByLabel('First Name').fill('E2E')
    await page.getByLabel('Last Name').fill('User')
    await page.getByLabel('Date of Birth').fill('1990-01-01')
    await page.getByLabel('Gender').selectOption({ label: 'Male' })
    await page.getByLabel('License Number').fill('A1234567')
    await clickVisibleButton(page, 'Save & Continue')
    await clickVisibleButton(page, 'Continue')
  })

  await timedStep('Fill address section', async () => {
    await openSectionForEditing(page, /address information/i, 'Phone #1')
    await page.getByLabel('Phone #1').fill('555-555-5555')
    await page.getByLabel('Email Address #1').fill(email)
    await page.locator('#res-address1').fill('123 Main St')
    await clickVisibleButton(page, 'Save & Continue')
    await clickVisibleButton(page, 'Continue')
  })

  await timedStep('Fill additional section', async () => {
    await page.getByRole('button', { name: 'Create custom product' }).click()
    await page.getByLabel('Custom form name').fill('E2E Custom Form')
    await page.getByRole('button', { name: 'Add question' }).click()
    await page.getByPlaceholder('Question').fill('What is your current insurer?')
    await page.getByPlaceholder('Answer').fill('None')
    await clickVisibleButton(page, 'Save & Continue')
    await clickVisibleButton(page, 'Continue')
  })
}

const createShareLink = async (page, { recipientName, accessMode }) => {
  await page.getByRole('button', { name: 'Share' }).click()
  const modal = page.locator('.modal-panel')
  await expect(modal).toBeVisible()

  if (accessMode === 'edit') {
    await modal.getByLabel('Allow edits').check()
  } else {
    await modal.getByLabel('Read only').check()
  }
  await modal.getByLabel('Share all sections').check()
  await clickVisibleButton(modal, 'Continue')
  await modal.getByRole('button', { name: 'Share with link' }).click()
  await modal.getByLabel('Recipient name').fill(recipientName)
  await modal.getByRole('button', { name: 'Create link' }).click()

  const linkContainer = modal.getByRole('button', { name: 'Copy link' }).locator('..')
  const codeContainer = modal.getByRole('button', { name: 'Copy code' }).locator('..')
  const link = (await linkContainer.locator('div').first().textContent())?.trim()
  const code = (await codeContainer.locator('div').first().textContent())?.trim()
  if (!code || !link) {
    throw new Error('Share link or code not found in modal.')
  }

  await modal.getByRole('button', { name: 'Close' }).click()
  await expect(modal).toBeHidden()
  return { link, code }
}

const unlockShareLink = async (page, code, recipientName) => {
  await expect(page.getByRole('heading', { name: /shared insurance profile/i })).toBeVisible()
  await page.getByLabel('Access code').fill(code)
  await page.getByLabel('Recipient name (for public links)').fill(recipientName)
  await page.getByRole('button', { name: 'Unlock profile' }).click()
  await expect(page.getByText('Shared by')).toBeVisible()
}

const submitEditableShare = async (browser, { link, code }, recipientName) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(link)
  await unlockShareLink(page, code, recipientName)

  await page.getByRole('button', { name: /household information/i }).click()
  await page.getByLabel('First Name').fill('Edited')
  await clickVisibleButton(page, 'Save & Continue')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Awaiting client approval')).toBeVisible()

  await context.close()
}

test.describe.serial('Core user journeys', () => {
  test('customer signup, profile creation, share flows', async ({ page, browser, request }) => {
    const { adminEmail, adminPassword } = loadAdminCredentials()
    const timestamp = Date.now()
    const email = `e2e+${timestamp}@example.com`
    const password = buildE2ePassword()
    const recipientName = 'E2E Recipient'
    const editRecipientName = 'E2E Editor'

    await timedStep('Open homepage', async () => {
      await page.goto(baseURL)
    })
    await timedStep('Open signup modal', async () => {
      await page.locator('header').getByRole('button', { name: /create your insurance profile/i }).click()
    })

    const modal = page.locator('.modal-panel')
    await timedStep('Complete signup', async () => {
      await expect(modal).toBeVisible()
      await modal.getByLabel('Email').fill(email)
      await modal.getByLabel('Full name').fill('E2E User')
      await modal.getByLabel('Password').first().fill(password)
      await modal.getByLabel('Confirm password').fill(password)
      await modal.getByRole('button', { name: 'Sign up' }).click()
    })

    await timedStep('Verify and reach dashboard', async () => {
      await expect(page.getByRole('heading', { name: 'Connsura Client Dashboard' })).toBeVisible()
      await verifyEmailIfNeeded(page, request, email, adminEmail, adminPassword)
      await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled()
    })

    await timedStep('Open forms tab', async () => {
      await page.getByRole('button', { name: 'Forms' }).click()
    })
    await fillCreateProfile(page, email)

    const readShare = await timedStep('Create read-only share link', async () =>
      createShareLink(page, { recipientName, accessMode: 'read' })
    )
    await timedStep('Open read-only share', async () => {
      const readContext = await browser.newContext()
      const readPage = await readContext.newPage()
      await readPage.goto(readShare.link)
      await unlockShareLink(readPage, readShare.code, recipientName)
      await readContext.close()
    })

    const editShare = await timedStep('Create editable share link', async () =>
      createShareLink(page, { recipientName: editRecipientName, accessMode: 'edit' })
    )
    await timedStep('Submit editable share', async () => {
      await submitEditableShare(browser, editShare, editRecipientName)
    })

    await timedStep('Accept edits', async () => {
      await expect(page.getByText('Review profile edits')).toBeVisible({ timeout: 30000 })
      await page.getByRole('button', { name: 'Accept changes' }).click()
    })
  })
})
