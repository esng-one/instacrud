/**
 * Debug test to see what's on the signin page
 */
import { test, expect } from '@playwright/test';

test('debug signin page', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to signin page...');
  await page.goto('/signin', { timeout: 30000 });

  // Wait for page to load and for React to hydrate
  console.log('Waiting for page to load...');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  console.log('Waiting for React hydration...');
  // Allow time for React to fully hydrate
  await page.waitForLoadState('load');

  // Get page content
  const content = await page.content();
  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());

  // Try to find email input with different selectors
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="mail" i]',
  ];

  for (const selector of emailSelectors) {
    const count = await page.locator(selector).count();
    console.log(`Selector "${selector}": found ${count} elements`);
    if (count > 0) {
      const isVisible = await page.locator(selector).first().isVisible();
      console.log(`  - First element visible: ${isVisible}`);
    }
  }

  // Take a screenshot
  await page.screenshot({ path: 'signin-debug.png', fullPage: true });
  console.log('Screenshot saved to signin-debug.png');

  // Check if there are any forms
  const formCount = await page.locator('form').count();
  console.log(`Forms found: ${formCount}`);

  // Check if there are any buttons
  const buttonCount = await page.locator('button').count();
  console.log(`Buttons found: ${buttonCount}`);

  // Get body text
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));

  // Check for any divs
  const divCount = await page.locator('div').count();
  console.log(`Divs found: ${divCount}`);

  // Check if there are any inputs at all
  const inputCount = await page.locator('input').count();
  console.log(`Inputs found: ${inputCount}`);
});
