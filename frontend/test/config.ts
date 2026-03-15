/**
 * Test configuration
 * Contains credentials and settings for integration tests
 */

export const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@test.org',
    password: 'admin123',
  },
  east_admin: {
    email: 'east_admin@test.org',
    password: 'eastpass',
  },
};

export const TEST_CONFIG = {
  // Default timeout for integration tests
  timeout: 30000,

  // Backend URL (can be overridden by environment variables)
  getApiUrl: () => {
    return process.env.NEXT_PUBLIC_API_URL || process.env.BASE_URL || 'http://localhost:8000';
  },
};
