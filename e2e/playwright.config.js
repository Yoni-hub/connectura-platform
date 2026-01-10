import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const apiURL = process.env.E2E_API_URL || 'http://localhost:8000'
const startServers = process.env.E2E_START_SERVERS === 'true'

const webServer = startServers
  ? [
      {
        command: 'npm run dev',
        cwd: path.join(__dirname, '..', 'connsura-backend'),
        url: apiURL,
        reuseExistingServer: !process.env.CI,
        env: { ...process.env, NODE_ENV: 'development' },
      },
      {
        command: 'npm run dev',
        cwd: path.join(__dirname, '..', 'connsura-frontend'),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
    ]
  : undefined

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer,
})
