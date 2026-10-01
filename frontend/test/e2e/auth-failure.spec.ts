/**
 * E2E regression tests for the 401 → auth-failure flow.
 *
 * Reproduces the scenario where a JWT is locally valid (not expired) but the
 * server rejects it — e.g. after a backend DB swap invalidates user records.
 *
 * Before the fix:
 *   - MeContext swallowed the 401, set me=null
 *   - ProvisioningGuard treated 401 as a transient error and started polling
 *   - The app showed an infinite spinner for up to 5 minutes
 *
 * After the fix:
 *   - MeContext surfaces authFailed=true on 401
 *   - ProvisioningGuard's dedicated effect fires, sets status="loading", calls signOut()
 *   - The app redirects to /signin within seconds
 *
 * Run:
 *   npx playwright test test/e2e/auth-failure.spec.ts
 */

import { test, expect, signInViaUI, signOutViaUI } from './fixtures';
import type { Page, Route, Frame } from '@playwright/test';
import { TEST_CREDENTIALS } from '../config';

const ME_URL = '**/api/v1/me';
const ME_401_RESPONSE = {
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ detail: 'User not found' }),
};

/** Clear the MeContext sessionStorage cache so the next mount triggers fetchMe(). */
async function clearMeCache(page: Page) {
  await page.evaluate(() => sessionStorage.removeItem('me.cache'));
}

/** Reload; the 401 redirect can interrupt it (WebKit reports that as an error). */
async function reloadExpectingRedirect(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Regression: 401 on bootstrap must redirect, not spin forever
// ---------------------------------------------------------------------------

test.describe('Auth failure — 401 from /me redirects to /signin', () => {

  test('redirects to /signin on bootstrap 401 (regression: was infinite spinner)', async ({
    adminAuthenticatedPage: page,
  }) => {
    // Intercept all /me calls from this point on to return 401.
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    // Reload simulates the "backend DB swapped, user no longer exists" scenario.
    // The token in localStorage is still valid locally; the server will reject it.
    await reloadExpectingRedirect(page);

    // Must redirect to /signin — NOT remain on spinner for 5 minutes.
    await page.waitForURL('**/signin', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/signin/);
  });

  test('redirect resolves in well under 5 seconds (not the old 5-minute timeout)', async ({
    adminAuthenticatedPage: page,
  }) => {
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    const start = Date.now();
    await reloadExpectingRedirect(page);
    await page.waitForURL('**/signin', { timeout: 10_000 });

    const elapsed = Date.now() - start;
    // The old behaviour timed out after 5 × 60 × 1000 ms = 300 000 ms.
    // A correct implementation must redirect in a fraction of that.
    expect(elapsed).toBeLessThan(5_000);
  });

  // -------------------------------------------------------------------------
  // Deduplication guard
  // -------------------------------------------------------------------------

  test('navigates to /signin exactly once even when multiple code paths see 401', async ({
    adminAuthenticatedPage: page,
  }) => {
    // Both MeContext.fetchMe() and ProvisioningGuard.initialCheck() may race to
    // detect the 401. logoutCalledRef must prevent duplicate router.push calls.
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    let signinNavigations = 0;
    page.on('framenavigated', (frame: Frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/signin')) {
        signinNavigations++;
      }
    });

    await reloadExpectingRedirect(page);
    await page.waitForURL('**/signin', { timeout: 10_000 });

    // Wait a beat to catch any delayed duplicate navigation.
    await page.waitForTimeout(1_000);

    expect(signinNavigations).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Logout reason is preserved for the signin page
  // -------------------------------------------------------------------------

  test('stores a logout reason in sessionStorage so signin page can show a message', async ({
    adminAuthenticatedPage: page,
  }) => {
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    await reloadExpectingRedirect(page);
    await page.waitForURL('**/signin', { timeout: 10_000 });

    const reason = await page.evaluate(() => {
      const raw = sessionStorage.getItem('logoutReason');
      return raw ? JSON.parse(raw) : null;
    });

    expect(reason).not.toBeNull();
    expect(reason.message).toBe('Your session has expired');
    expect(reason.action).toBe('Please sign in again');
  });

  // -------------------------------------------------------------------------
  // No admin content rendered during redirect window (Finding 2 regression)
  //
  // ProvisioningGuard.authFailed effect calls setStatus("loading") before
  // signOut() to ensure <AuthLoader /> is shown — not page children —
  // during the router.push navigation window.
  // -------------------------------------------------------------------------

  test('does not render admin content during the redirect window', async ({
    adminAuthenticatedPage: page,
  }) => {
    // Intercept before reload so the very first /me call returns 401.
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    await reloadExpectingRedirect(page);

    // AppSidebar / the main nav lives inside ProvisioningGuard's children.
    // If status is forced to "loading" before signOut fires, it will never
    // be painted. We accept a generous 1-second window to catch any flash.
    const sidebarVisible = await page
      .locator('aside, [data-testid="app-sidebar"]')
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    expect(sidebarVisible).toBe(false);

    await page.waitForURL('**/signin', { timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Token is cleared after auth failure (no stale credential left in storage)
  // -------------------------------------------------------------------------

  test('clears auth token from storage after 401 redirect', async ({
    adminAuthenticatedPage: page,
  }) => {
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    await reloadExpectingRedirect(page);
    await page.waitForURL('**/signin', { timeout: 10_000 });

    const tokenAfter = await page.evaluate(
      () => localStorage.getItem('token') ?? sessionStorage.getItem('token')
    );

    // Token must be removed by the canonical logout utility so the next
    // page load does not attempt to re-use the rejected credential.
    expect(tokenAfter).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Re-navigation to a protected route after logout shows signin, not spinner
  // -------------------------------------------------------------------------

  test('a 401 from any authenticated endpoint logs out once (not only /me)', async ({
    adminAuthenticatedPage: page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // /me stays valid; only the contacts list is rejected
    await page.route('**/api/v1/contacts*', (route: Route) => route.fulfill(ME_401_RESPONSE));

    let signinNavigations = 0;
    page.on('framenavigated', (frame: Frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/signin')) signinNavigations++;
    });

    await page.goto('/contacts');
    await page.waitForURL('**/signin', { timeout: 10_000 });
    await page.waitForTimeout(1_000);

    expect(signinNavigations).toBe(1);
    const reason = await page.evaluate(() => JSON.parse(sessionStorage.getItem('logoutReason') ?? 'null'));
    expect(reason?.message).toBe('Your session has expired');
    expect(await page.evaluate(() => localStorage.getItem('token') ?? sessionStorage.getItem('token'))).toBeNull();
  });

  test('many concurrent 401s still log out exactly once', async ({ adminAuthenticatedPage: page }) => {
    // Count logout() calls: each one writes logoutReason (navigations can't show duplicates,
    // repeated router.push('/signin') collapses into one)
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'logoutReason') set.call(sessionStorage, '__logouts', String(Number(sessionStorage.getItem('__logouts') ?? 0) + 1));
        return set.call(this, key, value);
      };
    });
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Reject every data request (keep /me valid so only the global handler reacts)
    let rejected = 0;
    await page.route(/\/api\/v1\/(?!me\b|signin|getSettings)/, (route: Route) => {
      rejected++;
      return route.fulfill(ME_401_RESPONSE);
    });

    let signinNavigations = 0;
    page.on('framenavigated', (frame: Frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/signin')) signinNavigations++;
    });

    await page.goto('/projects');
    await page.waitForURL('**/signin', { timeout: 10_000 });
    await page.waitForTimeout(1_000);

    expect(rejected).toBeGreaterThan(1);
    expect(signinNavigations).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('__logouts'))).toBe('1');
  });

  test('a 401 from the chat stream logs out', async ({ authenticatedPage: page }) => {
    await page.goto('/ai-assistant');
    await page.waitForLoadState('networkidle');
    await page.route(/\/api\/v1\/(chat|completion)/, (route: Route) => route.fulfill(ME_401_RESPONSE));

    const input = page.locator('textarea, input[placeholder*="message" i]').first();
    await input.fill('hello');
    await input.press('Enter');

    await page.waitForURL('**/signin', { timeout: 10_000 });
    expect(await page.evaluate(() => localStorage.getItem('token') ?? sessionStorage.getItem('token'))).toBeNull();
  });

  test('navigating to a protected route after 401 logout shows signin form', async ({
    adminAuthenticatedPage: page,
  }) => {
    await page.route(ME_URL, (route: Route) => route.fulfill(ME_401_RESPONSE));
    await clearMeCache(page);

    await reloadExpectingRedirect(page);
    await page.waitForURL('**/signin', { timeout: 10_000 });

    // Stop intercepting /me so it can respond normally.
    await page.unroute(ME_URL);

    // Navigate back to a protected route without a token.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // useAuth finds no token and redirects — must not spin or crash.
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });
});

test.describe('Sign out', () => {
  test('clears a session-only token (Keep me logged in unchecked)', async ({ page }) => {
    await signInViaUI(page, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password, { keepLoggedIn: false });
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).not.toBeNull();

    await signOutViaUI(page);

    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin/);
  });
});
