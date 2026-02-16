import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'

const existingEmail = process.env.E2E_USER_EMAIL
const existingPassword = process.env.E2E_USER_PASSWORD

test.describe('Staging existing user checks', () => {
  test.skip(!existingEmail || !existingPassword, 'E2E_USER_EMAIL/E2E_USER_PASSWORD not set')

  test('forms load and questions are visible', async ({ page }) => {
    const responses = []
    page.on('response', (res) => {
      const url = res.url()
      if (/\/products(\?|$)/.test(url) || /\/questions\/product(\?|$)/.test(url)) {
        responses.push({ url, status: res.status() })
      }
    })

    await page.goto(baseURL)
    await page.locator('header').getByRole('button', { name: /sign in/i }).click()
    const modal = page.locator('.modal-panel')
    await expect(modal).toBeVisible()
    await modal.getByLabel('Email', { exact: true }).fill(existingEmail)
    await modal.getByLabel('Password').fill(existingPassword)
    await modal.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('button', { name: 'Forms' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: 'Forms' }).click()
    await page.getByRole('button', { name: /household information/i }).click()

    await page.waitForTimeout(3000)

    const error = page.getByText(/something went wrong please try again later/i)
    if (await error.isVisible()) {
      throw new Error(`Question load error visible. Responses: ${JSON.stringify(responses)}`)
    }

    const firstNameInput = page.getByLabel('First Name')
    if (await firstNameInput.isVisible()) {
      await expect(firstNameInput).toBeVisible()
    } else {
      await expect(page.getByText(/First Name:/)).toBeVisible()
    }
  })
})
