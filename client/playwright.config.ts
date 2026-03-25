import { defineConfig, devices } from '@playwright/test';

const API_BASE_URL = process.env.PW_API_URL || 'http://localhost:3000';
const UI_BASE_URL = process.env.PW_UI_URL || 'http://localhost:5173';
const TEST_TOKEN = process.env.PLAYWRIGHT_TEST_TOKEN || 'playwright-local-token';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'test-results',
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : 'list',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: UI_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1365, height: 768 },
    actionTimeout: 10_000,
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
    },
  }],
  webServer: [
    {
      command: `VITE_API_URL=${API_BASE_URL} npm start`,
      url: API_BASE_URL,
      cwd: '../server',
      env: {
        NODE_ENV: 'test',
        PLAYWRIGHT_TEST_AUTH: 'true',
        PLAYWRIGHT_TEST_TOKEN: TEST_TOKEN,
        ADMIN_EMAILS: 'admin@vanderbilt.edu',
        POSTGRES_HOST: 'localhost',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 0.0.0.0 --port 5173`,
      url: UI_BASE_URL,
      env: {
        VITE_API_URL: API_BASE_URL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
