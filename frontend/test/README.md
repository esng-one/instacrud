# Frontend Test Suite

Comprehensive test coverage for the InstaCRUD frontend. There are two test suites:

- **Playwright** (`test/e2e/`) — end-to-end browser tests for UI flows, auth, security, and CRUD operations
- **Jest** (`test/`) — API-level integration tests that hit the backend directly without a browser

## Test Structure

### E2E Test Files (Playwright)

Located in `test/e2e/`:

- **`auth.spec.ts`** - Authentication flow tests (login, logout, session management, protected routes)
- **`pentest.spec.ts`** - Security tests (XSS, input validation, authorization, session management)
- **`lifecycle.spec.ts`** - Full integration lifecycle tests (user flows, CRUD operations)
- **`ai-assistant.spec.ts`** - AI Assistant feature tests (chat interface, conversation management)
- **`debug-signin.spec.ts`** - Debug helper for signin page troubleshooting

### Configuration Files

- **`playwright.config.ts`** - Playwright test configuration (root directory)
- **`fixtures.ts`** - Shared Playwright fixtures for authenticated sessions (in `test/e2e/`)
- **`config.ts`** - Test credentials and configuration (in `test/`)

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
# or
npm test
```

### Run Specific Test File

```bash
npx playwright test test/e2e/auth.spec.ts
npx playwright test test/e2e/pentest.spec.ts
npx playwright test test/e2e/lifecycle.spec.ts
npx playwright test test/e2e/ai-assistant.spec.ts
```

### Run Against Live Server

```bash
# Set the backend URL first (optional - defaults to http://localhost:3000)
export BASE_URL=http://localhost:3000

npm run test:e2e
```

### Run Security Tests

```bash
npm run test:pentest
```

### Run with Coverage/Reports

```bash
npm run test:coverage
# or
npx playwright test --reporter=html
```

### Run in Watch/UI Mode

```bash
npm run test:watch
# or
npm run test:e2e:ui
```

## Test Modes

### Local Mode (Default)
- Tests run against locally running Next.js frontend (http://localhost:3000)
- Playwright automatically starts the dev server (configured in `playwright.config.ts`)
- Tests interact with real UI components and state management
- Backend API calls depend on your Next.js app configuration

### Custom URL Mode
- Tests against a specific URL
- Set `BASE_URL` environment variable

Example:
```bash
BASE_URL=http://localhost:3000 npm run test:e2e
# or for production testing
BASE_URL=https://staging.example.com npm run test:e2e
```

### CI Mode
- Automatically detected via `CI` environment variable
- Runs with retries enabled
- Serial execution to avoid conflicts

## E2E Tests with Playwright

End-to-end tests are located in `test/e2e/` and use Playwright for browser automation.

### Test Files

- **`auth.spec.ts`** - Authentication flow tests (login, logout, session management)
- **`pentest.spec.ts`** - Security tests (XSS, input validation, authorization)

### Quick Start

```bash
# Run all E2E tests (headless mode)
npm run test:e2e

# Run with browser visible (headed mode)
npx playwright test test/e2e/ --headed

# Run specific test file
npx playwright test test/e2e/auth.spec.ts

# Run specific test by name
npx playwright test -g "should redirect to login"
```

### 🎯 Watch Test Execution in Real-Time

Playwright offers several ways to watch tests run:

#### Option 1: UI Mode (Recommended)
```bash
npm run test:e2e:ui
```
This opens an interactive UI where you can:
- ✅ Watch tests execute in real-time
- ✅ Step through each test action
- ✅ Inspect DOM at each step
- ✅ View network requests
- ✅ Debug failures interactively
- ✅ Time travel through test execution

#### Option 2: Headed Mode
```bash
# Run with visible browser
npx playwright test test/e2e/ --headed

# Run with visible browser and slow down
npx playwright test test/e2e/ --headed --slow-mo=1000
```

#### Option 3: Debug Mode
```bash
# Open Playwright Inspector for step-by-step debugging
npx playwright test test/e2e/ --debug

# Debug specific test
npx playwright test test/e2e/auth.spec.ts:45 --debug
```

### 📊 View Test Reports

#### HTML Report (Detailed)
After tests run, Playwright automatically generates a detailed HTML report:

```bash
# View the last test report
npx playwright show-report

# Or manually open: test-results/html-report/index.html
```

The HTML report includes:
- ✅ Test execution timeline
- ✅ Screenshots on failure
- ✅ Videos of test runs (if enabled)
- ✅ Network activity logs
- ✅ Console logs
- ✅ Trace files

#### Terminal Report (Quick)
```bash
# Run with verbose line reporter
npx playwright test test/e2e/ --reporter=line

# Run with list reporter (shows each test)
npx playwright test test/e2e/ --reporter=list

# Run with dot reporter (minimal)
npx playwright test test/e2e/ --reporter=dot
```

### 🎥 Video & Screenshot Configuration

Videos and screenshots are controlled in `playwright.config.ts`. Here's how to configure them:

#### Current Configuration
```typescript
use: {
  screenshot: 'only-on-failure',  // Take screenshot only when test fails
  video: 'retain-on-failure',      // Keep video only when test fails
}
```

#### Available Options

**Screenshots:**
```typescript
screenshot: 'off'              // Never take screenshots
screenshot: 'on'               // Always take screenshots
screenshot: 'only-on-failure'  // Only on test failure (default)
```

**Videos:**
```typescript
video: 'off'                   // Never record videos
video: 'on'                    // Always record videos
video: 'retain-on-failure'     // Keep only failed test videos (default)
video: 'on-first-retry'        // Record when retrying failed tests
```

#### How to Change Settings

Edit `playwright.config.ts`:

```typescript
// To always record videos and screenshots (useful for debugging):
use: {
  screenshot: 'on',
  video: 'on',
}

// To disable all recording (faster test runs):
use: {
  screenshot: 'off',
  video: 'off',
}
```

#### Command-Line Override
```bash
# Force screenshots on all tests
npx playwright test test/e2e/ --screenshot=on

# Force video recording on all tests
npx playwright test test/e2e/ --video=on
```

### 📁 Storage Locations

#### Test Artifacts
```
test-results/
├── .last-run.json           # Last test run metadata
├── auth-login-flow-chromium/
│   ├── video.webm          # Test video (if recorded)
│   └── test-failed-1.png   # Failure screenshot
├── html-report/             # HTML test report
│   └── index.html          # Open this to view detailed report
└── traces/                  # Trace files for debugging
```

#### Cleanup Commands

```bash
# Clean all test artifacts
npm run test:e2e:clean
# Or manually:
rm -rf test-results/

# Clean specific artifacts
rm -rf test-results/*.png          # Remove screenshots
rm -rf test-results/*/video.webm   # Remove videos
rm -rf test-results/html-report/   # Remove HTML reports

# Clean before running tests (fresh start)
npx playwright test test/e2e/ --reporter=html && npx playwright show-report
```

#### Storage Management Tips

1. **Size concerns?** Videos can be large (5-20MB each)
   - Use `video: 'retain-on-failure'` to keep only failed tests
   - Run cleanup regularly: `rm -rf test-results/`

2. **Debugging?** Enable full recording temporarily:
   ```bash
   npx playwright test test/e2e/auth.spec.ts --video=on --screenshot=on
   ```

3. **CI/CD?** Use artifacts to store test results:
   - Upload `test-results/html-report/` for review
   - Keep videos of failures for debugging
   - Clean up after artifact upload

### 🔧 Advanced Usage

#### Run Specific Browser
```bash
npx playwright test test/e2e/ --project=chromium
npx playwright test test/e2e/ --project=firefox
npx playwright test test/e2e/ --project=webkit
```

#### Run Tests in Parallel
```bash
# Run with 4 workers (faster)
npx playwright test test/e2e/ --workers=4

# Run serially (one at a time)
npx playwright test test/e2e/ --workers=1
```

#### Generate Test Code
```bash
# Record browser actions to generate test code
npx playwright codegen http://localhost:3000
```

#### Update Snapshots
```bash
# Update visual regression snapshots
npx playwright test test/e2e/ --update-snapshots
```

## Writing Tests

### Test File Naming Convention

All E2E test files should follow the pattern: `*.spec.ts` in the `test/e2e/` directory

### Example Test Structure

```typescript
import { test, expect } from './fixtures';

test.describe('Feature Name', () => {
  test('should do something as authenticated user', async ({ adminAuthenticatedPage: page }) => {
    // Navigate to page
    await page.goto('/feature');
    await page.waitForLoadState('domcontentloaded');

    // Interact with UI
    await page.click('button:has-text("Action")');

    // Assert results
    await expect(page.locator('.result')).toBeVisible();
    await expect(page.locator('.result')).toHaveText('Expected Text');
  });

  test('should handle unauthenticated access', async ({ page }) => {
    await page.goto('/protected-page');
    await page.waitForLoadState('networkidle');

    // Should redirect to signin
    await expect(page).toHaveURL(/\/signin/);
  });
});
```

## Test Fixtures

### `adminAuthenticatedPage`
Provides a Playwright page with admin user already authenticated. Use this for tests that require admin privileges.

### `authenticatedPage`
Provides a Playwright page with regular user (east_admin) authenticated. Use this for testing non-admin user permissions.

### `page`
Standard Playwright page without authentication. Use for testing public pages or authentication flows.

## Best Practices for Playwright Tests

### Avoid Hardcoded Timeouts
❌ **Don't do this:**
```typescript
await page.waitForTimeout(2000); // Flaky!
```

✅ **Do this instead:**
```typescript
await page.waitForLoadState('networkidle');
await page.waitForURL(/dashboard/);
await expect(element).toBeVisible();
```

### Use Proper Selectors
❌ **Avoid:**
```typescript
await page.click('.css-class-xyz'); // Fragile
```

✅ **Prefer:**
```typescript
await page.click('button:has-text("Save")'); // Semantic
await page.click('[data-testid="save-button"]'); // Explicit
```

### Wait for Navigation
```typescript
// Wait for URL change after action
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard/);

// Wait for modal to open
await page.click('button:has-text("New")');
const modal = page.locator('[role="dialog"]');
await modal.waitFor({ state: 'visible' });
```

## CI/CD Integration

Playwright tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/
          retention-days: 30
```

## Troubleshooting

### Tests fail with "Cannot find module"

Make sure you've installed all dependencies:
```bash
npm install
```

### Tests fail with connection errors

1. Check that backend is running (for live tests)
2. Verify `NEXT_PUBLIC_API_URL` is set correctly
3. Check that backend is accessible from the test environment

### Tests timeout

Increase timeout in test file:
```typescript
it('should do something', async () => {
  // test code
}, 30000); // 30 second timeout
```

## Best Practices

1. **Clean up after tests** - Track created resource IDs and delete them in `test.afterAll()` hooks
2. **Use unique identifiers** - Use `Date.now()` or UUIDs in test data to avoid collisions
3. **Test isolation** - Each test should be independent and not rely on other tests
4. **Proper waits** - Use `waitForLoadState()`, `waitForURL()`, or element visibility instead of `waitForTimeout()`
5. **Meaningful assertions** - Use specific Playwright matchers like `toHaveText()`, `toBeVisible()`, `toHaveURL()`
6. **Error handling** - Test both success and failure cases (invalid input, unauthorized access)
7. **Security testing** - Always test authorization, XSS protection, and input validation
8. **Use fixtures** - Leverage `adminAuthenticatedPage` and `authenticatedPage` to avoid repeating login code
9. **Resource tracking** - Use arrays to track multiple created resources for proper cleanup

## Coverage Goals

- **E2E Tests**: All critical user flows (auth, CRUD, navigation)
- **Security Tests**: All authentication, authorization, and input validation paths
- **UI Tests**: Key user interactions and error states

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Selectors](https://playwright.dev/docs/selectors)

## Jest Tests

Jest tests are located in `test/` and use **Jest** (via `next/jest`) for API-level integration testing against a running backend.

Jest was chosen here instead of Playwright because these tests exercise the backend API directly — they make raw `fetch` calls, assert on JSON responses, and validate HTTP status codes. No browser or UI rendering is involved. Jest is lighter-weight and faster for this kind of pure HTTP integration testing, while Playwright is reserved for scenarios that require a real browser (navigation, rendering, user interactions).

- **Live mode only** — requires a running backend and valid credentials in `test/config.ts`
- Test files follow the `*_test.ts` / `*_test.tsx` naming convention

### Test Files

| Test file | What it covers |
|---|---|
| `ai_agent_test.ts` | AI features: completions, streaming, embeddings, image generation, conversation sync |

### Quick Start

```bash
# Run all Jest tests
npm test

# Run a specific test file
npm test -- ai_agent_test.ts

# Run in live mode (against a real backend)
npm run test:live -- ai_agent_test.ts
```
