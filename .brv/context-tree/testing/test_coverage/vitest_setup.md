## EdSteward Test Coverage Setup (January 2026)

Successfully configured Vitest for EdSteward with 81 passing tests:

**Configuration (`vitest.config.ts`):**
- Uses `@vitejs/plugin-react` for React component testing
- Path aliases: `@` → `./client/src`, `@shared` → `./shared`
- Environment: `jsdom` for browser API simulation
- Global setup: `./tests/setup/global.setup.ts`
- Test patterns: `client/src/**/*.{test,spec}.{ts,tsx}`, `server/**/*.{test,spec}.{ts,js}`, `tests/**/*.{test,spec}.{ts,js}`

**Test Scripts in `package.json`:**
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:ui": "vitest --ui"
```

**Global Setup (`tests/setup/global.setup.ts`):**
- Sets NODE_ENV=test
- Mocks: fetch, localStorage, sessionStorage, matchMedia, IntersectionObserver, ResizeObserver
- Suppresses React DOM nesting warnings

**Test Files Structure:**
- `tests/unit/` - Unit tests (rate-limiter, accessibility, storage, keyboard-shortcuts, dashboard-widgets)
- `tests/integration/` - API integration tests
- `client/src/hooks/` - Hook tests (use-auth.test.tsx)