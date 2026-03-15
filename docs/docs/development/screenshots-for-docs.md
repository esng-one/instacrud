---
sidebar_position: 5
title: Documentation Screenshots
---

# Documentation Screenshots

Keeping documentation screenshots up to date manually is tedious — especially as the UI evolves. InstaCRUD solves this with a Playwright-based screenshot generator that captures every page automatically and saves the images straight into the docs folder.

## How it works

The spec file `frontend/test/e2e/screenshots.spec.ts` contains a test per page/feature. Each test:

1. Navigates to the target page using an authenticated admin session
2. Switches the UI to **light theme** for consistent, readable screenshots
3. Sets a uniform viewport (`1000×800`)
4. Captures a screenshot and saves it to `docs/docs/user-guide/img/`

The screenshots land exactly where Docusaurus expects them, so documentation images stay in sync with the actual UI with zero manual effort.

## Running the generator

```bash
# Generate all screenshots
npx playwright test screenshots.spec.ts --project=chromium
```

This requires a running application instance (local or remote) and valid test credentials configured in `frontend/test/config.ts`.

## What gets captured

The spec covers every major section of the app:

- **Dashboard** — main landing page
- **Clients** — list, new modal, detail view
- **Projects** — list, new modal, detail view
- **Contacts & Addresses** — list and new modal
- **Documents** — list, new modal, detail view
- **Calendar** — monthly view
- **AI Assistant** — chat and image generation modes
- **Search** — focused search with dropdown results
- **Admin pages** — organizations, users, invitations, AI models, tiers
- **Profile** — settings and change password modal
- **Sidebar** — navigation panel

## Adding screenshots for a new page

Follow the existing pattern in `screenshots.spec.ts`:

```ts
test('My Feature screenshots', async ({ adminAuthenticatedPage: page }) => {
  await page.goto('/my-feature');
  await page.waitForLoadState('networkidle');
  await enableLightTheme(page);
  await page.waitForTimeout(500);
  await takeScreenshot(page, 'my-feature-list');
});
```

The `takeScreenshot` helper accepts options for full-page captures and region clipping:

```ts
// Full page
await takeScreenshot(page, 'my-feature-full', { fullPage: true });

// Specific region
await takeScreenshot(page, 'my-feature-detail', {
  clip: { x: 0, y: 0, width: 500, height: 300 }
});
```

## Tips

- **Run after UI changes** — regenerate screenshots whenever the UI is modified to keep docs current.
- **Commit the PNGs** — the generated images live in `docs/docs/user-guide/img/` and should be committed so the documentation site renders them.
- **Use `--project=chromium`** — running in a single browser keeps screenshots consistent and fast.
- For more details on the Playwright test setup, fixtures, and configuration, see [`frontend/test/README.md`](https://github.com/esng-one/instacrud/blob/main/frontend/test/README.md).
