/**
 * User Guide Screenshot Generator
 *
 * Captures screenshots for documentation with light theme.
 * Screenshots are saved to docs/docs/user-guide/img/
 *
 * Run with:
 *   npx playwright test screenshots.spec.ts --project=chromium
 */

import { test } from './fixtures';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/docs/user-guide/img');
const VIEWPORT = { width: 1000, height: 800 };

// Ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// Helper to take a screenshot with consistent settings
async function takeScreenshot(page: any, name: string, options: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } } = {}) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    fullPage: options.fullPage ?? false,
    clip: options.clip,
  });
  console.log(`✓ Screenshot saved: ${name}.png`);
}

// Helper to enable light theme
async function enableLightTheme(page: any) {
  // Click the theme toggle button to switch to light mode if in dark mode
  const themeButton = page.locator('button[aria-label*="theme" i], button:has(svg[class*="sun" i]), button:has(svg[class*="moon" i])').first();

  // Check if we're in dark mode by looking at the document
  const isDarkMode = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ||
           document.body.classList.contains('dark') ||
           localStorage.getItem('theme') === 'dark';
  });

  if (isDarkMode && await themeButton.isVisible().catch(() => false)) {
    await themeButton.click();
    await page.waitForTimeout(500);
  }

  // Force light mode via localStorage
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });

  await page.waitForTimeout(300);
}

test.describe('User Guide Screenshots', () => {
  test.beforeEach(async ({ adminAuthenticatedPage: page }) => {
    await page.setViewportSize(VIEWPORT);
    await enableLightTheme(page);
  });

  // ===== DASHBOARD =====
  test('Dashboard screenshot', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'dashboard');
  });

  // ===== CLIENTS =====
  test('Clients screenshots', async ({ adminAuthenticatedPage: page }) => {
    // Clients list
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'clients-list');

    // New Client modal - also use this to create a client for detail screenshot
    const newButton = page.locator('button:has-text("New Client"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'clients-new-modal');

      // Create a test client for detail screenshot
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      const codeInput = page.locator('input[name="code"], input[placeholder*="code" i]').first();

      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Demo Client');
      }
      if (await codeInput.isVisible().catch(() => false)) {
        await codeInput.fill('DEMO-001');
      }

      // Try to find and select client type
      const typeSelect = page.locator('select[name="type"], [data-testid="type-select"]').first();
      if (await typeSelect.isVisible().catch(() => false)) {
        await typeSelect.selectOption({ index: 1 });
      }

      // Submit the form
      const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
      } else {
        // Close modal if can't submit
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // Client detail view - find a client ID and navigate to detail view
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);

    // Get client ID from MUI DataGrid row
    const clientId = await page.evaluate(() => {
      // MUI DataGrid uses data-id on row elements
      const row = document.querySelector('.MuiDataGrid-row[data-id]');
      if (row) return row.getAttribute('data-id');

      // Fallback: try to find ID from table row data attribute
      const tableRow = document.querySelector('table tbody tr[data-id], table tbody tr[data-row-id]');
      if (tableRow) return tableRow.getAttribute('data-id') || tableRow.getAttribute('data-row-id');

      return null;
    });

    if (clientId) {
      await page.goto(`/clients?id=${clientId}`);
      await page.waitForLoadState('networkidle');
      await enableLightTheme(page);
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'clients-detail');
    } else {
      // If no clients exist, take screenshot of empty list as detail placeholder
      console.log('No clients found for detail view, using list as placeholder');
      await takeScreenshot(page, 'clients-detail');
    }
  });

  // ===== PROJECTS =====
  test('Projects screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'projects-list');

    // New Project modal
    const newButton = page.locator('button:has-text("New Project"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'projects-new-modal');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Project detail view - find a project ID and navigate to detail view
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);

    // Get project ID from MUI DataGrid row
    const projectId = await page.evaluate(() => {
      // MUI DataGrid uses data-id on row elements
      const row = document.querySelector('.MuiDataGrid-row[data-id]');
      if (row) return row.getAttribute('data-id');

      // Fallback: try to find ID from table row data attribute
      const tableRow = document.querySelector('table tbody tr[data-id], table tbody tr[data-row-id]');
      if (tableRow) return tableRow.getAttribute('data-id') || tableRow.getAttribute('data-row-id');

      return null;
    });

    if (projectId) {
      await page.goto(`/projects?id=${projectId}`);
      await page.waitForLoadState('networkidle');
      await enableLightTheme(page);
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'projects-detail');
    } else {
      // If no projects exist, take screenshot of list as placeholder
      console.log('No projects found for detail view, using list as placeholder');
      await takeScreenshot(page, 'projects-detail');
    }
  });

  // ===== CONTACTS =====
  test('Contacts screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'contacts-list');

    const newButton = page.locator('button:has-text("New Contact"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'contacts-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== ADDRESSES =====
  test('Addresses screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/addresses');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'addresses-list');

    const newButton = page.locator('button:has-text("New Address"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'addresses-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== DOCUMENTS =====
  test('Documents screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'documents-list');

    const newButton = page.locator('button:has-text("New Document"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'documents-new-modal');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Document detail view - find a document ID and navigate to detail view
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);

    // Get document ID from Accordion panel header (documents use Accordion, not DataGrid)
    const documentId = await page.evaluate(() => {
      // Documents use Accordion with id="panel-{docId}-header"
      const accordionHeader = document.querySelector('[id^="panel-"][id$="-header"]');
      if (accordionHeader) {
        const id = accordionHeader.id;
        const match = id.match(/^panel-(.+)-header$/);
        if (match) return match[1];
      }
      return null;
    });

    if (documentId) {
      await page.goto(`/documents?id=${documentId}`);
      await page.waitForLoadState('networkidle');
      await enableLightTheme(page);
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'documents-detail');
    } else {
      // If no documents exist, take screenshot of list as placeholder
      console.log('No documents found for detail view, using list as placeholder');
      await takeScreenshot(page, 'documents-detail');
    }
  });

  // ===== CALENDAR =====
  test('Calendar screenshot', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'calendar');
  });

  // ===== AI ASSISTANT =====
  test('AI Assistant screenshots', async ({ adminAuthenticatedPage: page }) => {
    // Generate a new conversation ID
    const conversationId = crypto.randomUUID ? crypto.randomUUID() : 'test-conversation';
    await page.goto(`/ai-assistant/${conversationId}`);
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'ai-assistant-chat');

    // Image generation mode
    await page.goto(`/ai-assistant/${conversationId}?mode=image-gen`);
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'ai-assistant-image-gen');
  });

  // ===== SEARCH =====
  test('Search screenshots', async ({ adminAuthenticatedPage: page }) => {
    // Use dashboard page for search screenshot
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);

    // Try multiple selectors for search
    const searchSelectors = [
      'input[placeholder*="Search" i]',
      'input[type="search"]',
      '[data-testid="search-input"]',
      'header input',
      '.search-input',
    ];

    let searchFound = false;
    for (const selector of searchSelectors) {
      const searchInput = page.locator(selector).first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.click();
        await page.waitForTimeout(300);
        await searchInput.fill('test');
        await page.waitForTimeout(1000);

        // Get the search input's bounding box to capture a focused screenshot
        const searchBox = await searchInput.boundingBox();
        if (searchBox) {
          // Capture area around search: include some padding and dropdown results
          const clip = {
            x: Math.max(0, searchBox.x - 20),
            y: Math.max(0, searchBox.y - 20),
            width: Math.min(500, VIEWPORT.width - searchBox.x + 40),
            height: 350, // Include space for dropdown results
          };
          await takeScreenshot(page, 'search-text', { clip });
        } else {
          await takeScreenshot(page, 'search-text');
        }
        searchFound = true;
        break;
      }
    }

    // If no search input found, take screenshot of header area anyway
    if (!searchFound) {
      console.log('Search input not found, taking header screenshot');
      // Capture top portion of the page where search would be
      await takeScreenshot(page, 'search-text', { clip: { x: 0, y: 0, width: VIEWPORT.width, height: 200 } });
    }
  });

  // ===== ORGANIZATIONS =====
  test('Organizations screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'organizations-list');

    const newButton = page.locator('button:has-text("New Organization"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'organizations-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== USERS =====
  test('Users screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'users-list');

    const newButton = page.locator('button:has-text("New User"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'users-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== INVITATIONS =====
  test('Invitations screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'invitations-list');

    const newButton = page.locator('button:has-text("Send Invitation"), button:has-text("Invite"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'invitations-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== AI MODELS =====
  test('AI Models screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/aimodels');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'aimodels-list');

    const newButton = page.locator('button:has-text("Create AI Model"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'aimodels-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== TIERS =====
  test('Tiers screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/tiers');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'tiers-list');

    const newButton = page.locator('button:has-text("Create Tier"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'tiers-new-modal');
      await page.keyboard.press('Escape');
    }
  });

  // ===== PROFILE =====
  test('Profile screenshots', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'profile', { fullPage: true });

    // Change password modal
    const changePasswordBtn = page.locator('button:has-text("Change Password")').first();
    if (await changePasswordBtn.isVisible()) {
      await changePasswordBtn.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'profile-change-password');
      await page.keyboard.press('Escape');
    }
  });

  // ===== SIDEBAR =====
  test('Sidebar screenshot', async ({ adminAuthenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await enableLightTheme(page);
    await page.waitForTimeout(500);

    // Capture just the sidebar area
    const sidebar = page.locator('aside, nav[role="navigation"], [data-sidebar]').first();
    if (await sidebar.isVisible()) {
      await sidebar.screenshot({ path: path.join(SCREENSHOT_DIR, 'sidebar.png') });
      console.log('✓ Screenshot saved: sidebar.png');
    }
  });
});
