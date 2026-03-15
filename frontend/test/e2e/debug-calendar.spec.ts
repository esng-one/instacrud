import { test, expect } from '@playwright/test';

test('calendar has no double scrollbar', async ({ page }) => {
  await page.goto('/signin', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.fill('input[type="email"], input[name="email"]', 'east_admin@test.org');
  await page.fill('input[type="password"], input[name="password"]', 'eastpass');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15000 });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/calendar', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForSelector('.fc-daygrid-day', { timeout: 15000 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'test-results/calendar-scroll.png', fullPage: true });

  // Check that no fc-scroller element inside the calendar has a visible scrollbar
  const hasInternalScroll = await page.evaluate(() => {
    const scrollers = document.querySelectorAll('.fc-scroller');
    for (const el of scrollers) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if ((overflowY === 'scroll' || overflowY === 'auto') && (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight) {
        return true;
      }
    }
    return false;
  });

  expect(hasInternalScroll, 'FullCalendar internal scroller should not show a scrollbar').toBe(false);
});

test('calendar popover stays within viewport on right edge (March 14)', async ({ page }) => {
  await page.goto('/signin', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.fill('input[type="email"], input[name="email"]', 'east_admin@test.org');
  await page.fill('input[type="password"], input[name="password"]', 'eastpass');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15000 });

  await page.goto('/calendar', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForSelector('.fc-daygrid-day', { timeout: 15000 });

  const moreLink = page.locator('[data-date="2026-03-14"] .fc-daygrid-more-link');
  await expect(moreLink).toBeVisible({ timeout: 5000 });
  await moreLink.click();

  await page.waitForSelector('.fc-popover', { timeout: 5000 });
  await page.waitForTimeout(300);

  const popover = page.locator('.fc-popover');
  const box = await popover.boundingBox();
  const viewportSize = page.viewportSize()!;

  console.log('Popover right:', box!.x + box!.width, 'Viewport width:', viewportSize.width);

  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportSize.width + 1);
});
