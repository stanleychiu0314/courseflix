import { expect, test } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/auth';

const UI_BASE_URL = process.env.PW_UI_URL || 'http://localhost:5173';
const COURSE_ID = '00000000-0000-0000-0000-000000000301';

function testUser() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    email: `student-${suffix}@vanderbilt.edu`,
    name: `Playwright Scheduler ${suffix}`,
  };
}

test('allows adding a course to schedule and displays it', async ({ browser, request }) => {
  const { email, name } = testUser();
  const context = await newAuthenticatedContext(browser, request, email, name);
  const page = await context.newPage();

  try {
    await page.goto(`${UI_BASE_URL}/courses`);
    await expect(page.getByText('CS 2201')).toBeVisible();

    await page.goto(`${UI_BASE_URL}/course/${COURSE_ID}`);
    await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();

    await page.getByRole('button', { name: /add to cart/i }).click();
    await expect(page.getByText('Added to cart!')).toBeVisible();

    await page.goto(`${UI_BASE_URL}/schedule`);
    await expect(page.getByRole('heading', { name: /my schedule/i })).toBeVisible();
    await expect(page.getByText('CS 2201')).toBeVisible();
  } finally {
    await context.close();
  }
});
