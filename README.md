# Petpet Competition Portal

Responsive Next.js portal connected to the [Petpet service API](https://petpet-service.onrender.com/api/documentation).

## Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with a registered backend email and password. The default API is `https://petpet-service.onrender.com/api`; optionally set `NEXT_PUBLIC_BACKEND_BASE_URL` in `.env.local` and restart the server. The previous `NEXT_PUBLIC_API_BASE_URL` setting is no longer used.

Login, users, events, competitions, pets, sponsors, registration, staff invitations, and competition settings use server data. API mutations persist across reloads. Available operations depend on the account's backend permissions.

See [API integration and limitations](docs/api-integration.md) for supported endpoints, payload mapping, session handling, and features awaiting service support. Species and competition-type catalogs are not exposed yet; creation requires administrator-provided UUIDs. Race results, drawing, payments, and doorprizes are not connected.

## Verify

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:e2e
```

The browser test needs Playwright Chromium (`npx playwright install chromium`). It starts its own Next.js server on port 3107 and a local API fixture, tests login/session behavior and CRUD, and stops both servers afterward. It does not create test data on Render. Authenticated production verification requires an authorized backend account.

Routes live in `src/app/(portal)`. Shared components live in `src/components`. API requests follow the Omdem CMS pattern: `useAuth` for sessions, named service modules, centralized `ENDPOINTS`, and direct `apiClient` requests to the backend. Response mapping remains in `src/services/backend-records.ts`. Backend CORS must allow the portal origin; `http://localhost:3000` is already allowed.

[V560 architecture](docs/architecture-v560.md) documents the original prototype. Its mock data and algorithm modules remain as regression fixtures; the active portal does not fall back to those records.
