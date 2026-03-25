import { expect, test } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/auth';

const UI_BASE_URL = process.env.PW_UI_URL || 'http://localhost:5173';

function testUser() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    email: `student-${suffix}@vanderbilt.edu`,
    name: `Playwright Student ${suffix}`,
  };
}

test('redirects unauthenticated users from protected routes to login', async ({ page }) => {
  await page.goto(`${UI_BASE_URL}/schedule`);
  await expect(page).toHaveURL(`${UI_BASE_URL}/login`);

  await page.goto(`${UI_BASE_URL}/profile`);
  await expect(page).toHaveURL(`${UI_BASE_URL}/login`);

  await page.goto(`${UI_BASE_URL}/feedback`);
  await expect(page).toHaveURL(`${UI_BASE_URL}/login`);
});

test('allows authenticated users to access protected routes', async ({ browser, request }) => {
  const { email, name } = testUser();
  const context = await newAuthenticatedContext(browser, request, email, name);
  const page = await context.newPage();

  try {
    await page.goto(`${UI_BASE_URL}/profile`);
    await expect(page).toHaveURL(`${UI_BASE_URL}/profile`);
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
  } finally {
    await context.close();
  }
});
