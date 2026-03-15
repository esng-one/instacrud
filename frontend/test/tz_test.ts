/**
 * TZ fix regression tests.
 *
 * Covers the two bugs fixed in commits e4f6396 and 5648b7b:
 *
 * 1. formatDate: "2026-03-10T00:00:00Z" must display March 10, not March 9.
 *    Fix: { timeZone: 'UTC' } in toLocaleDateString so the stored calendar
 *    date is shown regardless of the viewer's local TZ offset.
 *
 * 2. Project date roundtrip (integration, requires live backend):
 *    POST start_date "2026-03-10" → GET back "2026-03-10T00:00:00Z"
 *    PUT with that UTC string + plain end_date "2026-03-14" → must return 200.
 *
 * Unit tests run in jest/jsdom (no backend needed).
 * Integration tests require a running backend at localhost:8000.
 */

import { formatDate, formatDateTime, toLocalIsoDate } from '@/app/lib/util';
import { createTestContext, signIn, createAuthHeaders } from './helpers';
import { TEST_CREDENTIALS } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Unit: formatDate
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDate — UTC timezone fix', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('returns empty string for an invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('preserves the UTC calendar date for UTC midnight (regression: must not shift to prior day)', () => {
    // "2026-03-10T00:00:00Z" = UTC March 10 midnight.
    // Without fix: in any UTC-negative TZ (e.g. EST = UTC-4), shows March 9.
    // With fix (timeZone:'UTC'): always shows March 10.
    const result = formatDate('2026-03-10T00:00:00Z');
    expect(result).not.toBe('');
    // The result must contain "2026" (not 2025), "10" (not 9), and some form of "3" or "03" for March.
    // We check the UTC day and year appear in the locale string.
    expect(result).toContain('2026');
    const parts = result.match(/\d+/g)?.map(Number) ?? [];
    expect(parts).toContain(10);  // UTC day
    expect(parts).not.toContain(9);  // must NOT show prior day
  });

  it('Jan 1 UTC midnight must not appear as Dec 31 of prior year', () => {
    // The strongest regression check: Jan 1 UTC → any negative offset shows Dec 31, 2025.
    const result = formatDate('2026-01-01T00:00:00Z');
    expect(result).toContain('2026');     // year must be 2026
    expect(result).not.toContain('2025'); // must not shift to prior year
    const parts = result.match(/\d+/g)?.map(Number) ?? [];
    expect(parts).toContain(1);   // Jan 1 → day 1
    expect(parts).not.toContain(31); // must not be Dec 31
  });

  it('works with date-only strings (no time component)', () => {
    const result = formatDate('2026-03-10');
    expect(result).not.toBe('');
    expect(result).toContain('2026');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit: formatDateTime
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('')).toBe('');
  });

  it('returns a non-empty string for a valid ISO datetime', () => {
    const result = formatDateTime('2026-03-10T14:30:00Z');
    expect(result).not.toBe('');
    expect(result.length).toBeGreaterThan(5);
  });

  it('includes both date and time parts', () => {
    // formatDateTime returns date + ' ' + time (two parts separated by space)
    const result = formatDateTime('2026-03-10T14:30:00Z');
    // Should have at least one space (between date and time)
    expect(result).toMatch(/\s/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit: toLocalIsoDate
// ─────────────────────────────────────────────────────────────────────────────

describe('toLocalIsoDate', () => {
  it('returns YYYY-MM-DD using local date components', () => {
    // Create a date in local time so getFullYear/Month/Date return predictable values
    const d = new Date(2026, 2, 10); // March 10 in local time (month is 0-indexed)
    const result = toLocalIsoDate(d);
    expect(result).toBe('2026-03-10');
  });

  it('zero-pads month and day', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(toLocalIsoDate(d)).toBe('2026-01-05');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Project CRUD date roundtrip
// ─────────────────────────────────────────────────────────────────────────────

describe('Project date roundtrip (integration)', () => {
  const context = createTestContext();
  let adminToken: string;
  let userToken: string;
  let orgId: string;
  let clientId: string;
  let projectId: string;

  const TS = Date.now();
  const ORG_CODE = `tz_fe_org_${TS}`;
  const USER_EMAIL = `tz_fe_user_${TS}@test.com`;

  beforeAll(async () => {
    adminToken = await signIn(TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
    const adminH = createAuthHeaders(adminToken);

    // Create org
    const createOrgResp = await fetch(`${context.apiUrl}/admin/organizations`, {
      method: 'POST',
      headers: adminH,
      body: JSON.stringify({ name: 'TZ FE Org', code: ORG_CODE }),
    });
    if (!createOrgResp.ok) throw new Error(`create org failed: ${await createOrgResp.text()}`);

    // Find org id
    const orgs = await (await fetch(`${context.apiUrl}/admin/organizations`, { headers: adminH })).json();
    const org = orgs.find((o: any) => o.code === ORG_CODE);
    if (!org) throw new Error('org not found after create');
    orgId = org._id ?? org.id;

    // Add user
    const addResp = await fetch(`${context.apiUrl}/admin/add_user`, {
      method: 'POST',
      headers: adminH,
      body: JSON.stringify({ email: USER_EMAIL, password: 'tz_fe_pass1',
                             name: 'TZ FE User', role: 'USER', organization_id: orgId }),
    });
    if (!addResp.ok) throw new Error(`add user failed: ${await addResp.text()}`);

    userToken = await signIn(USER_EMAIL, 'tz_fe_pass1');
    const userH = createAuthHeaders(userToken);

    // Create client
    const clientResp = await fetch(`${context.apiUrl}/clients`, {
      method: 'POST',
      headers: userH,
      body: JSON.stringify({ code: `tz_fe_cl_${TS}`, name: 'TZ FE Client', type: 'COMPANY' }),
    });
    if (!clientResp.ok) throw new Error(`create client failed: ${await clientResp.text()}`);
    const clientData = await clientResp.json();
    clientId = clientData._id ?? clientData.id;
  }, 30000);

  afterAll(async () => {
    if (orgId && adminToken) {
      await fetch(`${context.apiUrl}/admin/organizations/${orgId}`, {
        method: 'DELETE',
        headers: createAuthHeaders(adminToken),
      });
    }
  });

  it('POST project with plain date start_date returns 200', async () => {
    const userH = createAuthHeaders(userToken);
    const resp = await fetch(`${context.apiUrl}/projects`, {
      method: 'POST',
      headers: userH,
      body: JSON.stringify({
        code: `TZ_FE_P_${TS}`,
        client_id: clientId,
        name: 'TZ FE Project',
        start_date: '2026-03-10',
      }),
    });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    projectId = data._id ?? data.id;
    expect(projectId).toBeTruthy();
  }, 15000);

  it('GET project has UTC-aware start_date with correct calendar date', async () => {
    const userH = createAuthHeaders(userToken);
    const resp = await fetch(`${context.apiUrl}/projects/${projectId}`, { headers: userH });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    const startStr: string = data.start_date;

    // Must have UTC indicator
    expect(startStr.endsWith('Z') || startStr.includes('+00:00')).toBe(true);

    // Calendar date must not have shifted
    expect(startStr).toMatch(/^2026-03-10/);

    // Verify formatDate shows the right date
    const displayed = formatDate(startStr);
    expect(displayed).toContain('2026');
    const parts = displayed.match(/\d+/g)?.map(Number) ?? [];
    expect(parts).toContain(10);   // day 10
    expect(parts).not.toContain(9); // not day 9
  }, 15000);

  it('PUT with UTC start + plain end_date does not crash (regression: was TypeError)', async () => {
    const userH = createAuthHeaders(userToken);

    // First get the current start_date from DB (UTC-aware string)
    const getResp = await fetch(`${context.apiUrl}/projects/${projectId}`, { headers: userH });
    const current = await getResp.json();
    const utcStartStr: string = current.start_date;

    // PUT: re-send UTC start + plain end_date (what the edit form does)
    const putResp = await fetch(`${context.apiUrl}/projects/${projectId}`, {
      method: 'PUT',
      headers: userH,
      body: JSON.stringify({
        code: `TZ_FE_P_${TS}`,
        client_id: clientId,
        name: 'TZ FE Project Updated',
        start_date: utcStartStr,   // UTC-aware (from DB response)
        end_date: '2026-03-14',    // plain date (from date picker)
      }),
    });

    expect(putResp.status).toBe(200);
    const updated = await putResp.json();
    expect(updated.start_date).toMatch(/^2026-03-10/);
    expect(updated.end_date).toMatch(/^2026-03-14/);
  }, 15000);

  it('PUT with end_date before start_date returns 422', async () => {
    const userH = createAuthHeaders(userToken);
    const getResp = await fetch(`${context.apiUrl}/projects/${projectId}`, { headers: userH });
    const current = await getResp.json();

    const putResp = await fetch(`${context.apiUrl}/projects/${projectId}`, {
      method: 'PUT',
      headers: userH,
      body: JSON.stringify({
        code: `TZ_FE_P_${TS}`,
        client_id: clientId,
        name: 'TZ FE Project',
        start_date: current.start_date, // 2026-03-10
        end_date: '2026-03-01',         // before start
      }),
    });

    expect(putResp.status).toBe(422);
  }, 15000);
});
