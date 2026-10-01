/**
 * Playwright fixtures for shared authentication state.
 * This allows tests to log in once and reuse the session.
 */
import { test as base, expect, Browser, Page } from '@playwright/test';
import { TEST_CREDENTIALS } from '../config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

type AuthFixtures = {
  authenticatedPage: any;
  adminAuthenticatedPage: any;
};

// Helper function to wait for and fill sign-in form
async function waitAndFillSignInForm(page: any, email: string, password: string, keepLoggedIn: boolean) {
  // Wait for form elements with increased timeout
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 20000 });
  await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('button[type="submit"]', { state: 'visible', timeout: 10000 });

  // Clear and fill fields (clear first to handle any pre-filled values)
  await page.locator('input[type="email"]').clear();
  await page.fill('input[type="email"]', email);
  await page.locator('input[type="password"]').clear();
  await page.fill('input[type="password"]', password);
  const keepBox = page.locator('form input[type="checkbox"]').first();
  await keepBox.setChecked(keepLoggedIn);

  // Wait for form to be ready; a late hydration can wipe the typed values
  await page.waitForTimeout(300);
  await expect(page.locator('input[type="email"]')).toHaveValue(email, { timeout: 2000 });
  await expect(page.locator('input[type="password"]')).toHaveValue(password, { timeout: 2000 });
  await expect(keepBox).toBeChecked({ checked: keepLoggedIn, timeout: 2000 });
}

// Signs out through the user dropdown; on mobile that sits behind the application menu
export async function signOutViaUI(page: Page) {
  // Menus are toggles: only click what isn't open yet (early clicks can land before hydration)
  await page.waitForLoadState('networkidle');
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024; // header's lg breakpoint
  const appMenu = page.getByRole('button', { name: 'Application menu' });
  const userMenu = page.getByRole('button', { name: 'User menu' });
  const signOut = page.getByRole('button', { name: 'Sign out' });
  await expect(async () => {
    if (await signOut.isVisible()) return;
    if (isMobile && !(await userMenu.isVisible())) await appMenu.click({ timeout: 2000 });
    await userMenu.click({ timeout: 2000 });
    await expect(signOut).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await signOut.click();
  await page.waitForURL(/\/signin/, { timeout: 10000 });
}

// Helper function to perform sign in via UI
export async function signInViaUI(page: any, email: string, password: string, { keepLoggedIn = true } = {}) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for page to stabilize
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      await waitAndFillSignInForm(page, email, password, keepLoggedIn);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for navigation away from signin page
      await page.waitForURL((url: URL) => !url.pathname.includes('/signin'), { timeout: 10000 });

      await page.waitForLoadState('domcontentloaded');
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Authentication failed after ${maxRetries} attempts: ${error}`);
      }
      // Wait before retry
      await page.waitForTimeout(1000);
    }
  }
}

const API = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`;
const ENTITY_POST = /\/api\/v1\/(clients|projects|contacts|documents|addresses|conversations)\/?(\?.*)?$/;

// Records the id of every entity the page creates, so it can be deleted after the test
function trackCreated(page: Page): Promise<string | null>[] {
  const created: Promise<string | null>[] = [];
  page.on('response', (r) => {
    const m = r.url().match(ENTITY_POST);
    if (!m || r.request().method() !== 'POST' || !r.ok()) return;
    created.push(r.json().then((b) => (b?._id ? `${m[1]}/${b._id}` : null)).catch(() => null));
  });
  return created;
}

async function deleteCreated(pending: Promise<string | null>[], email: string, password: string) {
  const created = (await Promise.all(pending)).filter((p): p is string => !!p);
  if (!created.length) return;
  const r = await fetch(`${API}/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`cleanup signin failed (${r.status}); leaked: ${created.join(', ')}`);
  const headers = { Authorization: `Bearer ${(await r.json()).access_token}` };
  const failed: string[] = [];
  for (const path of created.reverse()) {
    const d = await fetch(`${API}/${path}`, { method: 'DELETE', headers });
    // 404: the test already deleted it
    if (!d.ok && d.status !== 404) failed.push(`${path} (${d.status})`);
  }
  if (failed.length) throw new Error(`cleanup failed for: ${failed.join(', ')}`);
}

async function authedPage(browser: Browser, run: (page: Page) => Promise<void>, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const created = trackCreated(page);
  await signInViaUI(page, email, password);
  try {
    await run(page);
  } finally {
    await deleteCreated(created, email, password);
    await context.close();
  }
}

// Extend base test with authenticated fixtures
export const test = base.extend<AuthFixtures>({
  // Logs in as east_admin (non-super-admin user)
  authenticatedPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const credentials = TEST_CREDENTIALS.east_admin || TEST_CREDENTIALS.admin;
    await authedPage(browser, use, credentials.email, credentials.password);
  },

  // Logs in as super admin
  adminAuthenticatedPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    await authedPage(browser, use, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
  },
});

export { expect };
