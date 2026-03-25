import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';

const TEST_AUTH_HEADER = 'x-playwright-test-auth-token';

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

const API_BASE_URL = process.env.PW_API_URL || 'http://localhost:3000';
const PLAYWRIGHT_TEST_TOKEN = process.env.PLAYWRIGHT_TEST_TOKEN || 'playwright-local-token';

interface LoginOptions {
  email: string;
  name: string;
}

function testAuthHeaders() {
  return {
    [TEST_AUTH_HEADER]: PLAYWRIGHT_TEST_TOKEN,
  };
}

export async function loginForPlaywright(
  request: APIRequestContext,
  options: LoginOptions
): Promise<{
  storageState: StorageState;
}> {
  const response = await request.post(`${API_BASE_URL}/api/auth/test-login`, {
    headers: testAuthHeaders(),
    data: {
      email: options.email,
      name: options.name,
    },
  });

  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `Playwright test login failed: ${response.status()} ${response.statusText()} ${JSON.stringify(body)}`
    );
  }

  return {
    storageState: await request.storageState(),
  };
}

export async function newAuthenticatedContext(
  browser: Browser,
  request: APIRequestContext,
  email: string,
  name: string
): Promise<BrowserContext> {
  const { storageState } = await loginForPlaywright(request, { email, name });
  return browser.newContext({ storageState });
}

export { API_BASE_URL, TEST_AUTH_HEADER, PLAYWRIGHT_TEST_TOKEN };
