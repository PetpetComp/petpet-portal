# Petpet API integration

Upstream documentation: https://petpet-service.onrender.com/api/documentation
OpenAPI schema: https://petpet-service.onrender.com/docs?api-docs.json

## Configuration

The default upstream is `https://petpet-service.onrender.com/api`. Override it with `NEXT_PUBLIC_BACKEND_BASE_URL` and restart Next.js (rebuild for production). The value is the API base including `/api`. Legacy `PETPET_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` are no longer used.

## Omdem CMS conventions

This integration follows the reference at `C:/work/cms/omdem-cms-portal`:

- `src/lib/api-client.ts`: direct browser fetch to the configured backend; centralized status/validation errors, rate limits, JSON and FormData support.
- `src/lib/constants/endpoints.ts`: centralized endpoint paths with encoded IDs.
- `src/lib/constants/cookies.ts`: the Petpet-specific `COOKIE_TOKEN` (`_petpet`).
- `src/services/*`: named `AUTH_SERVICES`, `USER_SERVICES`, `EVENT_SERVICES`, etc., with typed list/detail/create/update/delete methods.
- `src/types/api.ts` and `src/types/auth.ts`: backend payloads and response types.
- `src/hooks/use-auth.tsx`: AuthProvider/useAuth owns account loading, login, logout, roles and permissions.

The browser stores the token in the portal cookie and sends it to the API in the Authorization Bearer header, matching Omdem's client-managed token pattern. Cookie expiry follows `expires_in`; SameSite=Lax and Secure on HTTPS. The browser does not send portal cookies to the API (`credentials: omit`). The previous `/api/backend` forwarding route is removed.

Backend CORS must allow the portal origin and Authorization/Content-Type headers. A read-only OPTIONS check confirmed `http://localhost:3000` is allowed by the deployed API. Configure backend `FRONTEND_URL` for another portal domain.

Portal pages retain the Next.js 16 server layout cookie guard and validate the account with `/auth/me` through useAuth. This serves the same route protection purpose as the reference middleware without introducing its deprecated Next.js convention. Invalid sessions clear the token and return to sign-in. Domain providers handle portal data separately from authentication.

## Connected portal flows

- Users: list, detail, create, edit documented profile fields, delete, assign/revoke roles.
- Events: list, detail, create with an existing organization or new organization name, edit, delete, publish.
- Competitions: list by event, detail, create/edit, close registration.
- Competition settings: list/create versioned rules; list/create/edit/delete registration periods and score criteria.
- Pets: list, detail, create/edit, delete.
- Sponsors: list, detail, create/edit, add/remove PICs.
- Event sponsors: list, attach, remove. Updating a sponsorship level is not documented; remove/recreate through explicit actions.
- Entries: list by competition, register a pet or team, approve/reject/check in, delete/withdraw.
- Staff: list assignments and invitations, invite by email/role, delete an invitation or assignment.
- Reports and participant tables use loaded server records, with errors shown when a dataset is unavailable.

The adapter maps snake_case fields and UUID relationships into portal records. It follows all pagination pages, preserves date/time offsets when reading, submits ISO timestamps, sends numeric measurements in cm/grams, and surfaces backend validation errors. Forms await successful responses and use server-generated UUIDs; failures do not show success or navigate away. There is no runtime fallback to mock data.

## Current service limits

The schema has no species or competition-type catalog endpoint. Creating those records requires administrator-provided UUIDs. Pets belong to the authenticated account; the documented create payload does not let the portal choose another owner.

Unsupported photo/social/audit fields and arbitrary status edits are excluded from the connected forms. There is no documented sponsor or competition delete endpoint, no entry edit/payment endpoint, no direct staff-assignment create/update endpoint, and no PIC-list endpoint. PIC controls perform explicit assign/remove operations without inventing a current assignment list.

Drawing, race timing/results, contest assessment and doorprizes are not connected: their contracts are absent from the deployed schema. Their operational screens display availability notices. Existing algorithm modules and mock fixtures remain for regression tests.

The local sibling backend source supplied response DTOs missing from Swagger, including `access_token`, `expires_in`, `user.profile`, and the `uuid` relationship fields. Its auth routes define `/auth/me` and `/auth/logout`; the deployed server recognizes them even though Swagger omits them.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `node node_modules/vitest/vitest.mjs run`
- `node scripts/verify-api.mjs`

The browser check starts a local API fixture and Next.js on port 3107 from an isolated temporary copy of the project, sharing installed dependencies. It removes that copy afterward and leaves existing development servers running. It validates direct cross-origin fetch and Bearer-cookie behavior, login rejection/success, CRUD failure/success, reload persistence, competition periods, mobile layout, logout and protected routes. It never writes test data to Render.

Public Render list endpoints were checked read-only. Authenticated live CRUD requires a valid backend account and its permissions; local fixture success does not establish production authorization.
