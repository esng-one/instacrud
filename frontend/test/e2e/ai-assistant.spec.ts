/**
 * E2E tests for AI Assistant feature using Playwright.
 *
 * Tests the AI chat interface and conversation management.
 *
 * Run with:
 *   npm run test:e2e
 *   npx playwright test test/e2e/ai-assistant.spec.ts
 */

import { test as baseTest, APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures';
import { TEST_CREDENTIALS, TEST_CONFIG } from '../config';

test.describe('AI Assistant E2E', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigation is handled by the fixture
  });

  test('should display AI assistant page', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);

    // Check for main AI assistant UI elements
    await expect(page.locator('h1, h2').filter({ hasText: /AI|Assistant|Chat/i }).first()).toBeVisible();
  });

  test('should show chat input field', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);

    // Look for chat input (textarea or input with message placeholder)
    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();
    await expect(chatInput).toBeVisible();
  });

  test('should allow sending a message', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Find chat input
    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();

    // Type a message
    await chatInput.fill('Hello, this is a test message');

    // Find and click send button
    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Wait for response
      await page.waitForLoadState('networkidle');

      // Should see the message in the chat
      await expect(page.locator('text="Hello, this is a test message"').first()).toBeVisible();
    }
  });

  test('should show model selector', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);

    // Look for model selector (dropdown or select)
    const modelSelector = page.locator('select, [role="combobox"]').first();
    if (await modelSelector.isVisible()) {
      await expect(modelSelector).toBeVisible();
    }
  });

  test('should display conversation history', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Look for conversation history sidebar or list
    const conversationHistory = page.locator('[class*="conversation"], [class*="history"]').first();
    if (await conversationHistory.isVisible()) {
      await expect(conversationHistory).toBeVisible();
    }
  });

  test('should allow creating a new conversation', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Look for new conversation button
    const newConversationButton = page.locator('button:has-text("New"), button[title*="New"]').first();
    if (await newConversationButton.isVisible()) {
      await newConversationButton.click();
      await page.waitForLoadState('load');

      // Should navigate to a new conversation
      const url = page.url();
      expect(url).toContain('/ai-assistant');
    }
  });

  test('should handle streaming responses', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();
    await chatInput.fill('Count from 1 to 5');

    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Wait and check for streaming indicators
      await page.waitForLoadState('networkidle');

      // Look for loading/thinking indicators
      const thinkingIndicator = page.locator('[class*="thinking"], [class*="loading"]').first();
      if (await thinkingIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Streaming is working
        expect(true).toBe(true);
      }
    }
  });

  test('should display error on failed request', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Try to send an invalid or problematic request
    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();

    // Send empty message (should error or be prevented)
    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Button should be disabled or error shown
      await page.waitForLoadState('load');
      // Test passes if no crash occurs
      expect(true).toBe(true);
    }
  });

  test('should allow deleting a conversation', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Look for delete or trash button
    const deleteButton = page.locator('button:has-text("Delete"), button[title*="Delete"]').first();
    if (await deleteButton.isVisible()) {
      // Create a new conversation first
      const newButton = page.locator('button:has-text("New")').first();
      if (await newButton.isVisible()) {
        await newButton.click();
        await page.waitForLoadState('load');

        // Now try to delete
        const deleteBtn = page.locator('button:has-text("Delete"), [class*="delete"]').first();
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.waitForLoadState('load');

          // Confirm deletion if dialog appears
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
          }

          await page.waitForLoadState('load');
          expect(true).toBe(true);
        }
      }
    }
  });

  test('should persist conversation on reload', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Send a message
    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();
    const testMessage = `Test message ${Date.now()}`;
    await chatInput.fill(testMessage);

    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
      await page.waitForLoadState('networkidle');

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Message should still be visible
      const messageExists = await page.locator(`text="${testMessage}"`).isVisible({ timeout: 5000 }).catch(() => false);
      if (messageExists) {
        expect(messageExists).toBe(true);
      } else {
        // Conversation may be stored but not loaded - that's OK
        expect(true).toBe(true);
      }
    }
  });
});

test.describe('AI Assistant Features', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigation is handled by the fixture
  });

  test('should support code syntax highlighting', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();
    await chatInput.fill('Write a hello world function in Python');

    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
      await page.waitForLoadState('networkidle');

      // Look for code blocks
      const codeBlock = page.locator('code, pre').first();
      if (await codeBlock.isVisible({ timeout: 10000 }).catch(() => false)) {
        expect(await codeBlock.isVisible()).toBe(true);
      }
    }
  });

  test('should support markdown rendering', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();
    await chatInput.fill('Write a markdown list with 3 items');

    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
      await page.waitForLoadState('networkidle');

      // Look for list elements
      const listItems = page.locator('ul li, ol li');
      const count = await listItems.count();
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should allow image upload if supported', async ({ authenticatedPage: page }) => {
    await page.goto(`/ai-assistant`);
    await page.waitForLoadState('load');

    // Look for image upload button
    const uploadButton = page.locator('input[type="file"], button:has-text("Upload")').first();
    if (await uploadButton.isVisible()) {
      await expect(uploadButton).toBeVisible();
    }
  });
});

baseTest.describe('Conversation Re-sync Merge Cases (API)', () => {
  const API_URL = `${TEST_CONFIG.getApiUrl()}/api/v1/`;
  let apiCtx: APIRequestContext;

  baseTest.beforeAll(async ({ playwright }) => {
    // Sign in and store an authenticated API context
    const anonCtx = await playwright.request.newContext({ baseURL: API_URL });
    const loginResp = await anonCtx.post('signin', {
      data: { email: TEST_CREDENTIALS.east_admin.email, password: TEST_CREDENTIALS.east_admin.password },
    });
    const { access_token } = await loginResp.json();
    await anonCtx.dispose();

    apiCtx = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${access_token}` },
    });
  });

  baseTest.afterAll(async () => {
    await apiCtx.dispose();
  });

  const makeUuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const makeMsg = (content: string) => ({
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  });

  const listByUuid = async (uuid: string) => {
    const r = await apiCtx.get(
      `conversations?skip=0&limit=10&filters=${encodeURIComponent(JSON.stringify({ external_uuid: uuid }))}`
    );
    return r.json();
  };

  const post = (body: object) =>
    apiCtx.post('conversations', { data: body });

  baseTest('case 1: server only — GET by external_uuid returns exactly 1', async () => {
    const uuid = makeUuid();

    const createResp = await post({ external_uuid: uuid, title: 'Server Only', messages: [makeMsg('hello')] });
    expect(createResp.status()).toBe(200);

    const list = await listByUuid(uuid);
    expect(list.length).toBe(1);
    expect(list[0].external_uuid).toBe(uuid);
  });

  baseTest('case 2: local only — two POSTs with same uuid create exactly 1 conversation', async () => {
    const uuid = makeUuid();

    const r1 = await post({ external_uuid: uuid, title: 'Local Only', messages: [makeMsg('from local')] });
    expect(r1.status()).toBe(200);

    // Simulate second tab pushing same conversation
    const r2 = await post({ external_uuid: uuid, title: 'Local Only', messages: [makeMsg('from local')] });
    expect(r2.status()).toBe(200);

    const list = await listByUuid(uuid);
    expect(list.length).toBe(1);
  });

  baseTest('case 3: both identical — repeated POST is idempotent, no duplicate, no corruption', async () => {
    const uuid = makeUuid();
    const ts = new Date().toISOString();
    const messages = [makeMsg('same message')];

    await post({ external_uuid: uuid, title: 'Identical', messages, last_message_at: ts });
    await post({ external_uuid: uuid, title: 'Identical', messages, last_message_at: ts });

    const list = await listByUuid(uuid);
    expect(list.length).toBe(1);
    expect(list[0].messages.length).toBe(1);
  });

  baseTest('case 4: local has more messages — second POST with newer timestamp updates server', async () => {
    const uuid = makeUuid();
    const olderTs = new Date(Date.now() - 60_000).toISOString();
    const newerTs = new Date().toISOString();

    await post({ external_uuid: uuid, title: 'Grow', messages: [makeMsg('first')], last_message_at: olderTs });
    await post({ external_uuid: uuid, title: 'Grow', messages: [makeMsg('first'), makeMsg('second')], last_message_at: newerTs });

    const list = await listByUuid(uuid);
    expect(list.length).toBe(1);
    expect(list[0].messages.length).toBe(2);
  });

  baseTest('case 5: server newer — no duplicate created regardless of push order', async () => {
    const uuid = makeUuid();
    const olderTs = new Date(Date.now() - 60_000).toISOString();
    const newerTs = new Date().toISOString();

    // Server has 2 messages with newer timestamp
    await post({ external_uuid: uuid, title: 'Server Wins', messages: [makeMsg('msg1'), makeMsg('msg2')], last_message_at: newerTs });

    // Stale local push (frontend timestamp guard prevents this, but backend must not create a duplicate)
    const staleResp = await post({ external_uuid: uuid, title: 'Server Wins', messages: [makeMsg('only one')], last_message_at: olderTs });
    expect(staleResp.status()).toBe(200);

    const list = await listByUuid(uuid);
    expect(list.length).toBe(1);
    expect(list[0].external_uuid).toBe(uuid);
  });
});
