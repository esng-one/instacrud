/**
 * Shared test utilities and helpers for frontend tests.
 * Similar to backend's conftest.py but for TypeScript/Jest.
 */

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'ORG_ADMIN' | 'USER' | 'RO_USER';
  token?: string;
  userId?: string;
}

export interface TestOrganization {
  name: string;
  code: string;
  description: string;
  orgId?: string;
}

export interface TestContext {
  admin?: TestUser;
  orgAdmin?: TestUser;
  user?: TestUser;
  roUser?: TestUser;
  organization?: TestOrganization;
  organization2?: TestOrganization;
  baseUrl: string;
  apiUrl: string;
}

/**
 * Get base URL from environment or default to localhost
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || process.env.BASE_URL || 'http://localhost:8000';
}

/**
 * Get API URL
 */
export function getApiUrl(): string {
  return `${getBaseUrl()}/api/v1`;
}

/**
 * Create a test context with base URLs
 */
export function createTestContext(): TestContext {
  return {
    baseUrl: getBaseUrl(),
    apiUrl: getApiUrl(),
  };
}

/**
 * Sign in a user and return the access token
 */
export async function signIn(email: string, password: string): Promise<string> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Sign in failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Create headers with authorization token
 */
export function createAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Generate a unique test identifier based on timestamp
 */
export function generateTestId(): string {
  return Date.now().toString();
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
