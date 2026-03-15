# InstaCRUD Frontend

Next.js 15 + TypeScript + Tailwind CSS frontend for InstaCRUD.

## Test commands

### Playwright e2e (`test/e2e/`)
```bash
npm run test:e2e          # run all specs (headless)
npm run test:e2e:ui       # interactive UI mode
npm run test:lifecycle    # lifecycle.spec.ts
npm run test:pentest      # pentest.spec.ts
npm run test:tz           # tz.spec.ts — TZ display & date picker
```

### Jest (`test/*_test.ts`)
```bash
npm run test:jest         # run all Jest tests
npm run test:ai           # ai_agent_test.ts only
npm run test:tz:jest      # tz_test.ts only (TZ unit + integration)
```

> Both suites require a running backend at `localhost:8000` for integration tests.
