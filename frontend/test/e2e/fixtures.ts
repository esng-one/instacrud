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
async function waitAndFillSignInForm(page: any, email: string, password: string) {
  // Wait for form elements with increased timeout
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 20000 });
  await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('button[type="submit"]', { state: 'visible', timeout: 10000 });

  // Clear and fill fields (clear first to handle any pre-filled values)
  await page.locator('input[type="email"]').clear();
  await page.fill('input[type="email"]', email);
  await page.locator('input[type="password"]').clear();
  await page.fill('input[type="password"]', password);

  // Wait for form to be ready
  await page.waitForTimeout(300);
}

// Helper function to perform sign in via UI
async function signInViaUI(page: any, email: string, password: string) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for page to stabilize
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      await waitAndFillSignInForm(page, email, password);

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

// Extend base test with authenticated fixtures
export const test = base.extend<AuthFixtures>({
  // Authenticated page fixture - logs in as east_admin user
  // This can be used for testing regular user permissions vs admin
  authenticatedPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Sign in via UI as east_admin (non-super-admin user)
    // Falls back to admin if east_admin doesn't exist
    const credentials = TEST_CREDENTIALS.east_admin || TEST_CREDENTIALS.admin;
    await signInViaUI(page, credentials.email, credentials.password);

    // Use the authenticated page
    await use(page);

    // Cleanup
    await context.close();
  },

  // Admin authenticated page fixture - logs in as super admin
  adminAuthenticatedPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Sign in as admin via UI
    await signInViaUI(page, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);

    // Use the authenticated page
    await use(page);

    // Cleanup
    await context.close();
  },
});

export { expect };
