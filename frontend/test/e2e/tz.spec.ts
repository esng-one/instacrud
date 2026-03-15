/**
 * TZ: date display and date picker Playwright E2E tests.
 *
 * Verifies the TZ bug fixes (commits e4f6396, 5648b7b):
 *
 * 1. Detail view: UTC midnight date ("2026-03-10T00:00:00Z") displays as
 *    March 10 in the browser, never shifted to March 9 in UTC-negative TZs.
 *
 * 2. Edit view: flatpickr pickers load the correct calendar date from a
 *    UTC-aware string; the end_date picker is initially empty.
 *
 * 3. Calendar picker: clicking a day selects the right date, "Save Changes"
 *    sends toLocalIsoDate (YYYY-MM-DD) to the API, not a UTC timestamp.
 *
 * 4. API roundtrip: saved end_date comes back as UTC-aware and preserves
 *    the calendar date without shifting.
 *
 * Run:  npm run test:e2e -- tz.spec.ts
 */

import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from '../config';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API = `${API_BASE}/api/v1`;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TS = Date.now();

// ─── API helpers (no browser) ─────────────────────────────────────────────────

async function apiSignIn(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`signin failed (${r.status}): ${await r.text()}`);
  return (await r.json()).access_token;
}

function authH(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function signInViaUI(page: any, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/signin'), { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

// ─── Shared state (populated in beforeAll) ────────────────────────────────────

let adminToken: string;
let userEmail: string;
let userPassword: string;
let orgId: string;
let projectId: string;

// ─────────────────────────────────────────────────────────────────────────────

// Serial: tests share module-level state set in beforeAll (projectId, userEmail, etc.)
// Parallel workers would not share that state.
test.describe.serial('TZ: date display and date picker', () => {
  test.setTimeout(90000);

  // Create org + user + client + project via API (no browser needed)
  test.beforeAll(async () => {
    adminToken = await apiSignIn(TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);

    // Create org
    const orgCode = `tz_e2e_${TS}`;
    const orgR = await fetch(`${API}/admin/organizations`, {
      method: 'POST', headers: authH(adminToken),
      body: JSON.stringify({ name: 'TZ E2E Org', code: orgCode }),
    });
    if (!orgR.ok) throw new Error(`create org failed: ${await orgR.text()}`);

    const orgs = await (await fetch(`${API}/admin/organizations`, { headers: authH(adminToken) })).json();
    const org = orgs.find((o: any) => o.code === orgCode);
    if (!org) throw new Error('org not found after create');
    orgId = org._id ?? org.id;

    // Add user
    userEmail = `tz_e2e_${TS}@test.com`;
    userPassword = 'tz_e2e_pass1';
    const addR = await fetch(`${API}/admin/add_user`, {
      method: 'POST', headers: authH(adminToken),
      body: JSON.stringify({ email: userEmail, password: userPassword,
                             name: 'TZ E2E User', role: 'USER', organization_id: orgId }),
    });
    if (!addR.ok) throw new Error(`add user failed: ${await addR.text()}`);

    const userToken = await apiSignIn(userEmail, userPassword);

    // Create client
    const clientR = await fetch(`${API}/clients`, {
      method: 'POST', headers: authH(userToken),
      body: JSON.stringify({ code: `tz_e2e_cl_${TS}`, name: 'TZ E2E Client', type: 'COMPANY' }),
    });
    if (!clientR.ok) throw new Error(`create client failed: ${await clientR.text()}`);
    const clientId = (await clientR.json())._id;

    // Create project with a plain-date start_date — this is what toLocalIsoDate sends
    const projR = await fetch(`${API}/projects`, {
      method: 'POST', headers: authH(userToken),
      body: JSON.stringify({ code: `TZ_E2E_P_${TS}`, client_id: clientId,
                             name: 'TZ E2E Project', start_date: '2026-03-10' }),
    });
    if (!projR.ok) throw new Error(`create project failed: ${await projR.text()}`);
    projectId = (await projR.json())._id;
  });

  // Delete org (cascades to user + project + client)
  test.afterAll(async () => {
    if (orgId && adminToken) {
      await fetch(`${API}/admin/organizations/${orgId}`, {
        method: 'DELETE', headers: authH(adminToken),
      });
    }
  });

  // ─── 1. Detail view: date not shifted ──────────────────────────────────────
  test('detail view: start_date displays UTC calendar date without TZ shift', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInViaUI(page, userEmail, userPassword);
      await page.goto(`${BASE_URL}/projects?id=${projectId}`);
      await page.waitForLoadState('networkidle');

      // What formatDate() should produce with the UTC fix:
      //   new Date('2026-03-10T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' })
      const expected = await page.evaluate(
        () => new Date('2026-03-10T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' })
      );
      // What it would produce WITHOUT the fix (in UTC-negative TZ this becomes March 9):
      const withoutFix = await page.evaluate(
        () => new Date('2026-03-10T00:00:00Z').toLocaleDateString()
      );

      // Find the "Start Date" label, then its sibling value paragraph
      const startLabel = page.locator('p').filter({ hasText: /^Start Date$/ }).first();
      await expect(startLabel).toBeVisible({ timeout: 10000 });
      const startValue = startLabel.locator('+ p');
      await expect(startValue).toBeVisible();
      await expect(startValue).toHaveText(expected);

      // In UTC-negative TZs the fix changes the displayed value — verify the wrong one is absent
      if (withoutFix !== expected) {
        await expect(startValue).not.toHaveText(withoutFix);
      }
    } finally {
      await ctx.close();
    }
  });

  // ─── 2. Edit view: pickers load correct dates ───────────────────────────────
  test('edit view: start_date picker shows loaded date; end_date is empty', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInViaUI(page, userEmail, userPassword);
      await page.goto(`${BASE_URL}/projects?id=${projectId}`);
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Edit")');
      await page.waitForSelector('#start_date', { state: 'visible', timeout: 10000 });
      await page.waitForSelector('#end_date',   { state: 'visible', timeout: 5000 });

      // Flatpickr syncs via: fpRef.current.setDate(new Date("2026-03-10T12:00:00"), false)
      // Noon local time → "3/10/2026" in format n/j/Y regardless of TZ
      const startVal = await page.locator('#start_date').inputValue();
      // Accept various locale formats: M/D/YYYY, D/M/YYYY, D.M.YYYY
      expect(startVal).toMatch(/3[\/.]10[\/.]2026|10[\/.]3[\/.]2026/);
      expect(startVal).not.toMatch(/3[\/.]9[\/.]2026|9[\/.]3[\/.]2026/);

      // end_date starts empty (no end_date was set)
      const endVal = await page.locator('#end_date').inputValue();
      expect(endVal).toBe('');

      await page.keyboard.press('Escape');
    } finally {
      await ctx.close();
    }
  });

  // ─── 3. Calendar picker: pick end_date, save, verify detail view ────────────
  test('edit view: select end_date from calendar; save; detail view shows correct date', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInViaUI(page, userEmail, userPassword);
      await page.goto(`${BASE_URL}/projects?id=${projectId}`);
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Edit")');
      await page.waitForSelector('#end_date', { state: 'visible', timeout: 10000 });

      // Click the end_date input to open flatpickr (click bubbles to parent onClick handler)
      await page.click('#end_date');
      await page.waitForSelector('.flatpickr-calendar.open', { state: 'visible', timeout: 5000 });

      // Navigate calendar to March 2026 (today is 2026-03-14, so we start in March 2026 already)
      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
      for (let i = 0; i < 24; i++) {
        const month = (await page.locator('.flatpickr-calendar.open .cur-month').textContent()) ?? '';
        const year  = (await page.locator('.flatpickr-calendar.open .cur-year').inputValue()) ?? '0';
        if (month.includes('March') && year === '2026') break;
        const mIdx = monthNames.findIndex(m => month.includes(m));
        const y = parseInt(year);
        if (y > 2026 || (y === 2026 && mIdx > 2)) {
          await page.locator('.flatpickr-calendar.open .flatpickr-prev-month').click();
        } else {
          await page.locator('.flatpickr-calendar.open .flatpickr-next-month').click();
        }
      }

      // Select March 20 (after start_date March 10 — valid range)
      // CSS :not() applied directly so we filter the element itself, not a descendant
      await page.locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)')
        .filter({ hasText: /^20$/ })
        .first()
        .click();

      // Verify flatpickr input shows March 20
      const endVal = await page.locator('#end_date').inputValue();
      expect(endVal).toMatch(/3[\/.]20[\/.]2026|20[\/.]3[\/.]2026/);

      // Save
      await page.click('button:has-text("Save Changes")');
      await page.waitForLoadState('networkidle');
      // Modal closes; wait for detail view to render updated end_date
      await page.waitForSelector('p:text("End Date")', { timeout: 10000 });

      const endLabel = page.locator('p').filter({ hasText: /^End Date$/ }).first();
      await expect(endLabel).toBeVisible();
      const endValue = endLabel.locator('+ p');
      await expect(endValue).toBeVisible();

      const displayedEnd = await endValue.textContent() ?? '';
      const nums = (displayedEnd.match(/\d+/g) ?? []).map(Number);
      expect(nums).toContain(20);   // day 20
      expect(nums).toContain(2026); // correct year
    } finally {
      await ctx.close();
    }
  });

  // ─── 4. API: saved end_date has UTC indicator and correct calendar date ──────
  test('API: saved end_date is UTC-aware and preserves calendar date', async () => {
    // Runs after test 3, which saved end_date = 2026-03-20 via the calendar picker.
    // Verify the API response has Z/+00:00 and the calendar date was not shifted.
    const userToken = await apiSignIn(userEmail, userPassword);

    // If test 3 didn't save end_date (guard), set it directly via API
    const check = await (await fetch(`${API}/projects/${projectId}`, { headers: authH(userToken) })).json();
    if (!check.end_date) {
      const putR = await fetch(`${API}/projects/${projectId}`, {
        method: 'PUT', headers: authH(userToken),
        body: JSON.stringify({ ...check, end_date: '2026-03-20' }),
      });
      expect(putR.status).toBe(200);
    }

    const r = await fetch(`${API}/projects/${projectId}`, { headers: authH(userToken) });
    expect(r.ok).toBe(true);
    const data = await r.json();

    // start_date must be UTC-aware
    expect(data.start_date).toMatch(/Z$|[+]\d{2}:\d{2}$/);
    expect(data.start_date).toMatch(/^2026-03-10/);

    // end_date must be UTC-aware and calendar date must not have shifted
    expect(data.end_date).toMatch(/Z$|[+]\d{2}:\d{2}$/);
    expect(data.end_date).toMatch(/^2026-03-20/);
  });

  // ─── 5. Regression: edit with UTC start + plain end does not crash ───────────
  test('edit: PUT with UTC start_date + plain end_date returns 200 (regression)', async () => {
    const userToken = await apiSignIn(userEmail, userPassword);

    // GET current project (start_date will be UTC-aware "...Z")
    const getR = await fetch(`${API}/projects/${projectId}`, { headers: authH(userToken) });
    const current = await getR.json();
    const utcStartStr: string = current.start_date;

    // PUT: re-send UTC start (as returned by API) + plain end (as sent by date picker)
    const putR = await fetch(`${API}/projects/${projectId}`, {
      method: 'PUT', headers: authH(userToken),
      body: JSON.stringify({
        code: current.code, client_id: current.client_id,
        name: current.name,
        start_date: utcStartStr,    // UTC-aware string from DB
        end_date: '2026-03-20',     // plain date string from toLocalIsoDate
      }),
    });
    expect(putR.status).toBe(200);
    const updated = await putR.json();
    expect(updated.start_date).toMatch(/^2026-03-10/);
    expect(updated.end_date).toMatch(/^2026-03-20/);
  });

  // ─── 7. Calendar API: start dates are plain YYYY-MM-DD, not UTC timestamps ───
  test('calendar API: event start is a plain date (no TZ shift in FullCalendar)', async () => {
    // Bug: API was returning "2026-03-09T00:00:00Z". In a UTC-negative browser, FullCalendar
    // converts UTC midnight to local time and shows the event one day earlier (March 8).
    // Fix: serialize as "YYYY-MM-DD" so FullCalendar treats it as a calendar date.
    const userToken = await apiSignIn(userEmail, userPassword);

    // The project we created in beforeAll has start_date = '2026-03-10'
    const r = await fetch(`${API}/calendar`, { headers: authH(userToken) });
    expect(r.ok).toBe(true);
    const events = await r.json();

    const myEvent = events.find((e: any) => e.entity_id === projectId);
    expect(myEvent).toBeDefined();

    // Must be a plain YYYY-MM-DD string (10 chars), not a full datetime with Z/+
    expect(myEvent.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(myEvent.start).toBe('2026-03-10');
  });

  // ─── 6. Validation: end_date before start_date shows error in UI ─────────────
  test('edit view: end_date before start_date shows validation error', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInViaUI(page, userEmail, userPassword);
      await page.goto(`${BASE_URL}/projects?id=${projectId}`);
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Edit")');
      await page.waitForSelector('#end_date', { state: 'visible', timeout: 10000 });

      // Pick end_date = March 1 (before start_date March 10)
      await page.click('#end_date');
      await page.waitForSelector('.flatpickr-calendar.open', { state: 'visible', timeout: 5000 });

      // Navigate to March 2026
      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
      for (let i = 0; i < 24; i++) {
        const month = (await page.locator('.flatpickr-calendar.open .cur-month').textContent()) ?? '';
        const year  = (await page.locator('.flatpickr-calendar.open .cur-year').inputValue()) ?? '0';
        if (month.includes('March') && year === '2026') break;
        const mIdx = monthNames.findIndex(m => month.includes(m));
        const y = parseInt(year);
        if (y > 2026 || (y === 2026 && mIdx > 2)) {
          await page.locator('.flatpickr-calendar.open .flatpickr-prev-month').click();
        } else {
          await page.locator('.flatpickr-calendar.open .flatpickr-next-month').click();
        }
      }

      await page.locator('.flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)')
        .filter({ hasText: /^1$/ })
        .first()
        .click();

      // Save — should fail validation
      await page.click('button:has-text("Save Changes")');
      await page.waitForLoadState('load');

      // Modal should remain open (validation error)
      await expect(page.locator('#end_date')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });
});
