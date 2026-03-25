import { expect, test } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/auth';

const UI_BASE_URL = process.env.PW_UI_URL || 'http://localhost:5173';

function testUser() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    email: `student-${suffix}@vanderbilt.edu`,
    name: `Playwright Profile ${suffix}`,
  };
}

test('updates profile details and returns to view mode', async ({ browser, request }) => {
  const { email, name } = testUser();
  const context = await newAuthenticatedContext(browser, request, email, name);
  const page = await context.newPage();

  try {
    await page.goto(`${UI_BASE_URL}/profile`);
    await expect(page.getByRole('button', { name: /edit profile/i })).toBeVisible();
    await page.getByRole('button', { name: /edit profile/i }).click();

    const firstName = page.getByPlaceholder('First name');
    const lastName = page.getByPlaceholder('Last name');
    await firstName.fill('Authed');
    await lastName.fill('Tester');

    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
    await expect(page.getByText('Authed Tester')).toBeVisible();
  } finally {
    await context.close();
  }
});
