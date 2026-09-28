# Role-Based Access Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detach the portal from the real backend behind one flag, and give it a landing page + navigation that show Super Admin / Organizer / Competitor / Sponsor capabilities instead of one undifferentiated back-office.

**Architecture:** A single interception point in `src/lib/api-client.ts` routes every existing `apiClient.get/post/patch/delete` call to an in-memory mock store instead of `fetch`, when `NEXT_PUBLIC_USE_MOCK_BACKEND` is on. No service, hook, or component that already calls `apiClient` changes. On top of that unchanged data layer, a new `useCapabilities()` hook derives what the signed-in account can do from the mock store's own records (organization membership, sponsor PIC lists), and a new landing page + nav filtering + two new home routes (Competitor, Sponsor) present the flow described in the spec.

**Tech Stack:** Next.js (App Router), TypeScript, existing `apiClient`/`ENDPOINTS`/`services/*` layer, existing `useAuth`/`AuthProvider`, existing `PortalShell` + `nav-data.ts`.

**Spec:** `docs/superpowers/specs/2026-09-28-role-based-access-flow-design.md`

## Global Constraints

- No automated tests in this plan — the user is handling testing themselves. Every task ends with a manual verification step (`npm run typecheck`, and where noted, running the dev server) instead of a test run.
- No changes to any existing service file's public function signatures (`USER_SERVICES`, `PET_SERVICES`, `EVENT_SERVICES`, `COMPETITION_SERVICES`, `ORGANIZATION_SERVICES`, `SPONSOR_SERVICES`, `ENTRY_SERVICES`, `EVENT_SPONSOR_SERVICES`, `AUTH_SERVICES`) — they keep calling `apiClient` exactly as today.
- Mock state is a module-level in-memory store; it resets on a full page reload. This is accepted, not a bug (matches the existing v560 dummy-workflow convention documented in `docs/architecture-v560.md`).
- `isValidAuthToken` in `src/lib/auth-cookie.ts` explicitly rejects the literal string `"mock-token"` — mock login must issue a different token string (e.g. `"mock." + crypto.randomUUID()"`), not that literal, and that file is not modified.
- Follow existing ownership boundaries from `docs/architecture-v560.md`: `_components`/`_lib` inside a route own that route's forms/widgets; global widgets only move to `src/components/common` when reused.

## Review Focus

- Unknown email/wrong password on the mock login must fail the same way the real API does (`ApiError` with a message), not silently log in — a person mistyping their password should see an error, not a blank dashboard.
- An account with **no** organization and **no** sponsor profile (a fresh Competitor) must still get a working nav and home page — it must not crash on empty `members`/`pics` arrays.
- Reloading the browser after using demo login must not throw due to the mock store re-seeding while the auth cookie still references a since-reset user id — `readSession()`'s `/auth/me` call must resolve against current store state or the session must be treated as expired, not throw unhandled.
- Pagination math in the mock list responses (`meta.last_page`, `meta.total`) must stay correct when a list is empty (zero records) — `Math.ceil(0/pageSize)` must not produce `0` and break `usePaginatedList`'s "load next page" loop.
- The Organizer nav/data filter must key off the **current** signed-in user's uuid from `useAuth()`, not a stale closure — switching accounts (sign out, sign in as a different demo persona) without a full reload must show the new account's own organization, not the previous one's.

---

## File Structure

New files:
- `src/lib/mocks/mock-types.ts` — mock record shapes (`MockUser`, `MockOrganization`, `MockEvent`, `MockCompetition`, `MockPet`, `MockSponsor`, `MockEventSponsor`, `MockEntry`).
- `src/lib/mocks/mock-store.ts` — the in-memory arrays, seed data, and small CRUD/pagination helpers.
- `src/lib/mocks/mock-request.ts` — `mockRequest<T>()`, the path-matching router used by `api-client.ts`.
- `src/hooks/use-capabilities.tsx` — `useCapabilities()`.
- `src/app/(marketing)/layout.tsx` + `src/app/(marketing)/page.tsx` — the three-entry landing page (replaces the current redirect-only `src/app/page.tsx`).
- `src/app/(portal)/my-competitions/page.tsx` + `_components/competitor-home.tsx` — Competitor home.
- `src/app/(portal)/sponsor-home/page.tsx` + `_components/sponsor-home.tsx` — Sponsor onboarding + home.

Modified files:
- `src/lib/api-client.ts` — one branch in `request<T>()`.
- `.env.example` — document the new flag.
- `src/hooks/use-auth.tsx` — read an `intent`/`next` redirect target after login/register instead of hardcoding `/competition`.
- `src/lib/constants/routes.ts` — add the new route constants.
- `src/components/layouts/sidebar/nav-data.ts` — nav items gain a `capability` tag.
- `src/components/layouts/portal-shell.tsx` — filter nav by `useCapabilities()`.
- `src/app/(portal)/event-management/_components/event-workspace.tsx` (or `api-workspace.tsx`, see Task 9) — organizer scoping + pending-sponsor-application list on an event's detail view.

---

### Task 1: Mock record types and in-memory store

**Files:**
- Create: `src/lib/mocks/mock-types.ts`
- Create: `src/lib/mocks/mock-store.ts`

**Interfaces:**
- Produces: `MockUser`, `MockOrganization`, `MockEvent`, `MockCompetition`, `MockPet`, `MockSponsor`, `MockEventSponsor`, `MockEntry` (from `mock-types.ts`); `store` object and `nextUuid()`, `paginate(items, query)`, `findOrThrow(list, uuid, label)` (from `mock-store.ts`). Later tasks import these two modules only.

- [ ] **Step 1: Write the mock record types**

```typescript
// src/lib/mocks/mock-types.ts
export interface MockUser {
  uuid: string;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  status: string;
}

export interface MockOrganizationMember {
  user_uuid: string;
  role: "OWNER" | "ADMIN" | "STAFF";
}

export interface MockOrganization {
  uuid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  members: MockOrganizationMember[];
}

export interface MockEvent {
  uuid: string;
  organization_uuid: string;
  name: string;
  tagline?: string;
  description?: string;
  venue_name?: string;
  venue_address?: string;
  map_location?: string;
  timezone?: string;
  start_at: string;
  end_at: string;
  status: string;
}

export interface MockCompetition {
  uuid: string;
  event_uuid: string;
  name: string;
  description?: string;
  arena_name?: string;
  capacity?: number;
  minimum_judges?: number;
  competition_type_uuid?: string;
  species_uuid?: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  registration_closed_at: string | null;
  status: string;
}

export interface MockPet {
  uuid: string;
  owner_uuid: string;
  name: string;
  species_uuid?: string;
  morph_uuid?: string;
  registration_number?: string;
  gender?: string;
  birth_date?: string;
  height_cm?: number;
  weight_grams?: number;
  status: string;
}

export interface MockSponsorPic {
  uuid: string;
  name: string;
  user_uuid: string;
}

export interface MockSponsor {
  uuid: string;
  brand_name: string;
  phone?: string;
  email?: string;
  website_url?: string;
  status: string;
  pics: MockSponsorPic[];
}

export interface MockEventSponsor {
  uuid: string;
  event_uuid: string;
  sponsor_uuid: string;
  sponsorship_level: string;
  campaign_text?: string;
  display_order?: number;
  start_at?: string;
  end_at?: string;
  status: "pending" | "approved" | "rejected";
}

export interface MockEntry {
  uuid: string;
  competition_uuid: string;
  owner_uuid: string;
  pet_uuid?: string;
  team_uuid?: string;
  bib_number?: string;
  registration_fee?: number;
  payment_status: string;
  checkin_status: string;
  status: string;
}
```

- [ ] **Step 2: Write the store, seed data, and helpers**

```typescript
// src/lib/mocks/mock-store.ts
import type {
  MockUser,
  MockOrganization,
  MockEvent,
  MockCompetition,
  MockPet,
  MockSponsor,
  MockEventSponsor,
  MockEntry,
} from "./mock-types";

export function nextUuid(): string {
  return crypto.randomUUID();
}

const SUPERADMIN_UUID = "u-superadmin";
const ORGANIZER_UUID = "u-organizer";
const COMPETITOR_UUID = "u-competitor";
const SPONSOR_USER_UUID = "u-sponsor";
const ORG_UUID = "org-petpet-community";
const EVENT_UUID = "evt-jakarta-pet-festival";
const COMPETITION_UUID = "comp-agility-sprint";
const PET_UUID = "pet-bolt";
const SPONSOR_UUID = "spo-whiskas-indonesia";

export const DEMO_PASSWORD = "password123";

export const store = {
  users: [
    {
      uuid: SUPERADMIN_UUID,
      username: "admin",
      email: "admin@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Petpet",
      last_name: "Admin",
      status: "Active",
    },
    {
      uuid: ORGANIZER_UUID,
      username: "organizer",
      email: "organizer@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Organizer",
      last_name: "Demo",
      status: "Active",
    },
    {
      uuid: COMPETITOR_UUID,
      username: "competitor",
      email: "competitor@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Competitor",
      last_name: "Demo",
      status: "Active",
    },
    {
      uuid: SPONSOR_USER_UUID,
      username: "sponsor",
      email: "sponsor@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Sponsor",
      last_name: "Demo",
      status: "Active",
    },
  ] as MockUser[],

  organizations: [
    {
      uuid: ORG_UUID,
      name: "Petpet Community",
      email: "contact@petpetcommunity.dev",
      members: [{ user_uuid: ORGANIZER_UUID, role: "OWNER" }],
    },
  ] as MockOrganization[],

  events: [
    {
      uuid: EVENT_UUID,
      organization_uuid: ORG_UUID,
      name: "Jakarta Pet Festival 2026",
      tagline: "Where every paw wins",
      venue_name: "JIExpo Kemayoran",
      venue_address: "Jl. Benyamin Suaeb, Jakarta",
      timezone: "Asia/Jakarta",
      start_at: "2026-11-05T08:00:00+07:00",
      end_at: "2026-11-06T18:00:00+07:00",
      status: "Published",
    },
  ] as MockEvent[],

  competitions: [
    {
      uuid: COMPETITION_UUID,
      event_uuid: EVENT_UUID,
      name: "Agility Sprint",
      arena_name: "Main Arena",
      capacity: 40,
      scheduled_start_at: "2026-11-05T09:00:00+07:00",
      scheduled_end_at: "2026-11-05T15:00:00+07:00",
      registration_closed_at: null,
      status: "Open",
    },
  ] as MockCompetition[],

  pets: [
    {
      uuid: PET_UUID,
      owner_uuid: COMPETITOR_UUID,
      name: "Bolt",
      gender: "Male",
      birth_date: "2023-02-10",
      status: "Active",
    },
  ] as MockPet[],

  sponsors: [
    {
      uuid: SPONSOR_UUID,
      brand_name: "Whiskas Indonesia",
      email: "partnership@whiskas.example",
      status: "Active",
      pics: [{ uuid: "pic-1", name: "Sponsor Demo", user_uuid: SPONSOR_USER_UUID }],
    },
  ] as MockSponsor[],

  eventSponsors: [] as MockEventSponsor[],

  entries: [
    {
      uuid: "entry-bolt-agility",
      competition_uuid: COMPETITION_UUID,
      owner_uuid: COMPETITOR_UUID,
      pet_uuid: PET_UUID,
      bib_number: "001",
      payment_status: "Paid",
      checkin_status: "Pending",
      status: "Approved",
    },
  ] as MockEntry[],
};

export const SUPERADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? "admin@petpet.dev"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function paginate<T>(
  items: T[],
  query: URLSearchParams,
): {
  items: T[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
} {
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const perPage = Math.max(1, Number(query.get("per_page") ?? 20) || 20);
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    meta: {
      current_page: page,
      per_page: perPage,
      total: items.length,
      last_page: Math.max(1, Math.ceil(items.length / perPage)),
    },
  };
}

export function findOrThrow<T extends { uuid: string }>(
  list: T[],
  uuid: string,
  label: string,
): T {
  const record = list.find((item) => item.uuid === uuid);
  if (!record) throw new Error(label + " not found: " + uuid);
  return record;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
Expected: no errors referencing `mock-types.ts` or `mock-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mocks/mock-types.ts src/lib/mocks/mock-store.ts
git commit -m "feat: add mock backend types, seed data, and store helpers"
```

---

### Task 2: Mock request router — auth, users, pets

**Files:**
- Create: `src/lib/mocks/mock-request.ts`

**Interfaces:**
- Consumes: `store`, `paginate`, `findOrThrow`, `nextUuid`, `DEMO_PASSWORD` from `./mock-store` (Task 1); `MockUser` etc. from `./mock-types`.
- Produces: `mockRequest<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T>` — the full router, extended by Task 3 and Task 4 in the same file. Consumed by `api-client.ts` in Task 5.

- [ ] **Step 1: Write the path matcher and the auth/users/pets routes**

```typescript
// src/lib/mocks/mock-request.ts
import { ApiError } from "@/lib/api-client";
import { store, paginate, findOrThrow, nextUuid, DEMO_PASSWORD } from "./mock-store";
import type { MockUser } from "./mock-types";

function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index++) {
    const segment = patternSegments[index];
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = decodeURIComponent(pathSegments[index]);
    } else if (segment !== pathSegments[index]) {
      return null;
    }
  }
  return params;
}

function userRecord(user: MockUser) {
  return {
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name ?? null,
    phone: user.phone ?? null,
    status: user.status,
    roles: [] as { code: string; name: string }[],
  };
}

let currentSessionUserUuid: string | null = null;

function requireSession(): MockUser {
  if (!currentSessionUserUuid)
    throw new ApiError(401, "Session expired. Please sign in again.");
  return findOrThrow(store.users, currentSessionUserUuid, "User");
}

type Route = {
  method: string;
  pattern: string;
  handler: (
    params: Record<string, string>,
    body: Record<string, unknown> | undefined,
    query: URLSearchParams,
  ) => unknown;
};

const routes: Route[] = [
  {
    method: "POST",
    pattern: "/auth/login",
    handler: (_params, body) => {
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(body?.password ?? "");
      const user = store.users.find((item) => item.email.toLowerCase() === email);
      if (!user || user.password !== password)
        throw new ApiError(401, "Invalid email or password.");
      currentSessionUserUuid = user.uuid;
      return {
        access_token: "mock." + nextUuid(),
        token_type: "Bearer",
        expires_in: 60 * 60 * 8,
        user: userRecord(user),
      };
    },
  },
  {
    method: "POST",
    pattern: "/auth/register",
    handler: (_params, body) => {
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      if (store.users.some((item) => item.email.toLowerCase() === email))
        throw new ApiError(422, "That email is already registered.");
      const user: MockUser = {
        uuid: nextUuid(),
        username: String(body?.username ?? email.split("@")[0]),
        email,
        password: String(body?.password ?? DEMO_PASSWORD),
        first_name: String(body?.first_name ?? "New"),
        last_name: body?.last_name ? String(body.last_name) : undefined,
        status: "Active",
      };
      store.users.push(user);
      currentSessionUserUuid = user.uuid;
      return {
        access_token: "mock." + nextUuid(),
        token_type: "Bearer",
        expires_in: 60 * 60 * 8,
        user: userRecord(user),
      };
    },
  },
  {
    method: "GET",
    pattern: "/auth/me",
    handler: () => userRecord(requireSession()),
  },
  {
    method: "POST",
    pattern: "/auth/logout",
    handler: () => {
      currentSessionUserUuid = null;
      return null;
    },
  },
  { method: "GET", pattern: "/auth/roles", handler: () => [] },
  { method: "GET", pattern: "/auth/permissions", handler: () => [] },
  {
    method: "GET",
    pattern: "/users",
    handler: (_params, _body, query) => paginate(store.users.map(userRecord), query),
  },
  {
    method: "GET",
    pattern: "/users/:uuid",
    handler: (params) => userRecord(findOrThrow(store.users, params.uuid, "User")),
  },
  {
    method: "GET",
    pattern: "/pets",
    handler: (_params, _body, query) => paginate(store.pets, query),
  },
  {
    method: "GET",
    pattern: "/pets/:uuid",
    handler: (params) => findOrThrow(store.pets, params.uuid, "Pet"),
  },
  {
    method: "POST",
    pattern: "/pets",
    handler: (_params, body) => {
      const owner = requireSession();
      const pet = {
        uuid: nextUuid(),
        owner_uuid: owner.uuid,
        name: String(body?.name ?? ""),
        species_id: body?.species_id ? String(body.species_id) : undefined,
        status: "Active",
        ...body,
      };
      store.pets.push(pet as (typeof store.pets)[number]);
      return pet;
    },
  },
  {
    method: "PATCH",
    pattern: "/pets/:uuid",
    handler: (params, body) => {
      const pet = findOrThrow(store.pets, params.uuid, "Pet");
      Object.assign(pet, body);
      return pet;
    },
  },
  {
    method: "DELETE",
    pattern: "/pets/:uuid",
    handler: (params) => {
      store.pets = store.pets.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
];

export function currentMockUser(): MockUser | null {
  return currentSessionUserUuid
    ? (store.users.find((item) => item.uuid === currentSessionUserUuid) ?? null)
    : null;
}

export { routes as mockRoutes, matchPath, requireSession };
```

- [ ] **Step 2: Verify it compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
Expected: no errors (the `ApiError` import will only resolve once Task 5 exports it unchanged from `api-client.ts` — it already is exported there today, so this passes now).

Once Task 5 wires this router in, manually confirm the wrong-password case doesn't get silently waved through: run the dev server, go to `/sign-in`, submit `organizer@petpet.dev` with an incorrect password.
Expected: the form shows "Invalid email or password." and does not navigate away.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mocks/mock-request.ts
git commit -m "feat: add mock router for auth, users, and pets endpoints"
```

---

### Task 3: Mock request router — organizations, events, competitions

**Files:**
- Modify: `src/lib/mocks/mock-request.ts`

**Interfaces:**
- Consumes: `routes` array, `matchPath`, `requireSession` from Task 2 (same file — append to the `routes` array, don't redeclare it).
- Produces: extends `mockRoutes` with organization/event/competition entries; no new exports.

- [ ] **Step 1: Insert organization, event, and competition routes**

Insert these entries into the `routes` array from Task 2 (before the closing `];`):

```typescript
  {
    method: "GET",
    pattern: "/organizations",
    handler: (_params, _body, query) => paginate(store.organizations, query),
  },
  {
    method: "GET",
    pattern: "/organizations/:uuid",
    handler: (params) => findOrThrow(store.organizations, params.uuid, "Organization"),
  },
  {
    method: "PATCH",
    pattern: "/organizations/:uuid",
    handler: (params, body) => {
      const org = findOrThrow(store.organizations, params.uuid, "Organization");
      Object.assign(org, body);
      return org;
    },
  },
  {
    method: "GET",
    pattern: "/events",
    handler: (_params, _body, query) => {
      const organizationId = query.get("organization_id");
      const filtered = organizationId
        ? store.events.filter((event) => event.organization_uuid === organizationId)
        : store.events;
      return paginate(filtered, query);
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid",
    handler: (params) => findOrThrow(store.events, params.uuid, "Event"),
  },
  {
    method: "POST",
    pattern: "/events",
    handler: (_params, body) => {
      const owner = requireSession();
      let organizationUuid = body?.organization_id
        ? String(body.organization_id)
        : "";
      const newOrganization = body?.new_organization as
        | { name?: string; email?: string; phone?: string; address?: string }
        | undefined;
      if (!organizationUuid && newOrganization?.name) {
        organizationUuid = nextUuid();
        store.organizations.push({
          uuid: organizationUuid,
          name: newOrganization.name,
          email: newOrganization.email,
          phone: newOrganization.phone,
          address: newOrganization.address,
          members: [{ user_uuid: owner.uuid, role: "OWNER" }],
        });
      }
      if (!organizationUuid)
        throw new ApiError(422, "Choose an organization or enter a new organization name.");
      const event = {
        uuid: nextUuid(),
        organization_uuid: organizationUuid,
        name: String(body?.name ?? ""),
        status: "Draft",
        ...body,
      };
      store.events.push(event as (typeof store.events)[number]);
      return event;
    },
  },
  {
    method: "PATCH",
    pattern: "/events/:uuid",
    handler: (params, body) => {
      const event = findOrThrow(store.events, params.uuid, "Event");
      Object.assign(event, body);
      return event;
    },
  },
  {
    method: "DELETE",
    pattern: "/events/:uuid",
    handler: (params) => {
      store.events = store.events.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
  {
    method: "POST",
    pattern: "/events/:uuid/publish",
    handler: (params) => {
      const event = findOrThrow(store.events, params.uuid, "Event");
      event.status = "Published";
      return event;
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid/competitions",
    handler: (params, _body, query) =>
      paginate(
        store.competitions.filter((item) => item.event_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/competitions",
    handler: (params, body) => {
      const competition = {
        uuid: nextUuid(),
        event_uuid: params.uuid,
        name: String(body?.name ?? ""),
        registration_closed_at: null,
        status: "Open",
        ...body,
      };
      store.competitions.push(competition as (typeof store.competitions)[number]);
      return competition;
    },
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid",
    handler: (params) => findOrThrow(store.competitions, params.uuid, "Competition"),
  },
  {
    method: "PATCH",
    pattern: "/competitions/:uuid",
    handler: (params, body) => {
      const competition = findOrThrow(store.competitions, params.uuid, "Competition");
      Object.assign(competition, body);
      return competition;
    },
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/close-registration",
    handler: (params) => {
      const competition = findOrThrow(store.competitions, params.uuid, "Competition");
      competition.registration_closed_at = new Date().toISOString();
      return competition;
    },
  },
```

- [ ] **Step 2: Verify it compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mocks/mock-request.ts
git commit -m "feat: add mock router for organizations, events, and competitions"
```

---

### Task 4: Mock request router — sponsors, entries, event-sponsors

**Files:**
- Modify: `src/lib/mocks/mock-request.ts`

**Interfaces:**
- Consumes: same `routes` array from Task 2/3.
- Produces: extends `mockRoutes` with sponsor, entry, and event-sponsor entries. This is the last route group; no new exports.

- [ ] **Step 1: Insert sponsor, entry, and event-sponsor routes**

Insert before the closing `];` of `routes`:

```typescript
  {
    method: "GET",
    pattern: "/sponsors",
    handler: (_params, _body, query) => paginate(store.sponsors, query),
  },
  {
    method: "GET",
    pattern: "/sponsors/:uuid",
    handler: (params) => findOrThrow(store.sponsors, params.uuid, "Sponsor"),
  },
  {
    method: "POST",
    pattern: "/sponsors",
    handler: (_params, body) => {
      const sponsor = {
        uuid: nextUuid(),
        brand_name: String(body?.brand_name ?? ""),
        status: "Active",
        pics: [] as { uuid: string; name: string; user_uuid: string }[],
        ...body,
      };
      store.sponsors.push(sponsor as (typeof store.sponsors)[number]);
      return sponsor;
    },
  },
  {
    method: "PATCH",
    pattern: "/sponsors/:uuid",
    handler: (params, body) => {
      const sponsor = findOrThrow(store.sponsors, params.uuid, "Sponsor");
      Object.assign(sponsor, body);
      return sponsor;
    },
  },
  {
    method: "POST",
    pattern: "/sponsors/:uuid/pics",
    handler: (params, body) => {
      const sponsor = findOrThrow(store.sponsors, params.uuid, "Sponsor");
      const user = findOrThrow(store.users, String(body?.user_id ?? ""), "User");
      sponsor.pics.push({ uuid: nextUuid(), name: user.first_name, user_uuid: user.uuid });
      return sponsor;
    },
  },
  {
    method: "DELETE",
    pattern: "/sponsors/:uuid/pics/:userId",
    handler: (params) => {
      const sponsor = findOrThrow(store.sponsors, params.uuid, "Sponsor");
      sponsor.pics = sponsor.pics.filter((pic) => pic.user_uuid !== params.userId);
      return null;
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid/sponsors",
    handler: (params, _body, query) =>
      paginate(
        store.eventSponsors.filter((item) => item.event_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/sponsors",
    handler: (params, body) => {
      const link = {
        uuid: nextUuid(),
        event_uuid: params.uuid,
        sponsor_uuid: String(body?.sponsor_id ?? ""),
        sponsorship_level: String(body?.sponsorship_level ?? "BRONZE"),
        campaign_text: body?.campaign_text ? String(body.campaign_text) : undefined,
        status: "pending" as const,
      };
      store.eventSponsors.push(link);
      return link;
    },
  },
  {
    method: "DELETE",
    pattern: "/events/:eventId/sponsors/:linkId",
    handler: (params) => {
      store.eventSponsors = store.eventSponsors.filter(
        (item) => item.uuid !== params.linkId,
      );
      return null;
    },
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/entries",
    handler: (params, _body, query) =>
      paginate(
        store.entries.filter((item) => item.competition_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/entries",
    handler: (params, body) => {
      const owner = requireSession();
      const entry = {
        uuid: nextUuid(),
        competition_uuid: params.uuid,
        owner_uuid: owner.uuid,
        payment_status: "Pending",
        checkin_status: "Pending",
        status: "Pending",
        ...body,
      };
      store.entries.push(entry as (typeof store.entries)[number]);
      return entry;
    },
  },
  {
    method: "DELETE",
    pattern: "/entries/:uuid",
    handler: (params) => {
      store.entries = store.entries.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/approve",
    handler: (params) => {
      const entry = findOrThrow(store.entries, params.uuid, "Entry");
      entry.status = "Approved";
      return entry;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/reject",
    handler: (params) => {
      const entry = findOrThrow(store.entries, params.uuid, "Entry");
      entry.status = "Rejected";
      return entry;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/checkin",
    handler: (params) => {
      const entry = findOrThrow(store.entries, params.uuid, "Entry");
      entry.checkin_status = "Checked in";
      return entry;
    },
  },
```

- [ ] **Step 2: Write the router entry point at the bottom of the file**

```typescript
export async function mockRequest<T>(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const [path, search] = endpoint.split("?");
  const query = new URLSearchParams(search ?? "");
  const route = routes.find(
    (candidate) =>
      candidate.method === method && matchPath(candidate.pattern, path) !== null,
  );
  if (!route) throw new ApiError(404, "Not available in demo mode.");
  const params = matchPath(route.pattern, path) ?? {};
  const data = route.handler(params, body, query);
  return { success: true, message: "OK", data } as T;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mocks/mock-request.ts
git commit -m "feat: add mock router for sponsors, entries, and event-sponsor links, and the mockRequest entry point"
```

---

### Task 5: Wire the mock switch into api-client.ts

**Files:**
- Modify: `src/lib/api-client.ts:34-99` (the `request<T>` function)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `mockRequest` from `./mocks/mock-request` (Task 4).
- Produces: no change to `apiClient`'s public shape — every existing caller is unaffected.

- [ ] **Step 1: Add the mock branch**

In `src/lib/api-client.ts`, add the import near the top:

```typescript
import { mockRequest } from "@/lib/mocks/mock-request";
```

Then change the start of `request<T>` (currently `src/lib/api-client.ts:34-38`) to:

```typescript
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  if (process.env.NEXT_PUBLIC_USE_MOCK_BACKEND === "true") {
    return mockRequest<T>(
      options.method ?? "GET",
      endpoint,
      options.body instanceof FormData ? undefined : options.body,
    );
  }
  const token = getAuthToken();
```

(the rest of the function body is unchanged — it simply isn't reached when the flag is on).

- [ ] **Step 2: Document the flag**

Add to `.env.example`:

```
# Route every apiClient call to the in-memory mock backend (src/lib/mocks)
# instead of the real API. Set to "false" to reconnect to the real backend.
NEXT_PUBLIC_USE_MOCK_BACKEND=true
NEXT_PUBLIC_SUPERADMIN_EMAILS=admin@petpet.dev
```

Also add the same two lines to `.env.local` if that file exists in the working tree (check with the file tool before editing — don't create it if it doesn't already exist, since it's git-ignored per-developer config).

- [ ] **Step 3: Verify end to end**

Run: `npm run typecheck`
Expected: passes.

Run: `npm run dev -- --port 3001`, then open `http://localhost:3001/sign-in` and sign in with `organizer@petpet.dev` / `password123`.
Expected: redirected into the portal, no network errors in the browser console referencing `petpet-service.onrender.com`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-client.ts .env.example
git commit -m "feat: route apiClient through the mock backend behind NEXT_PUBLIC_USE_MOCK_BACKEND"
```

---

### Task 6: useCapabilities hook

**Files:**
- Create: `src/hooks/use-capabilities.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `@/hooks/use-auth` (existing — returns `{ user, isAuthenticated, ... }`, where `user.id` is the backend `uuid`); `store`, `SUPERADMIN_EMAILS` from `@/lib/mocks/mock-store` (Task 1).
- Produces: `useCapabilities(): { isSuperAdmin: boolean; organizationIds: string[]; isOrganizer: boolean; sponsorId: string | null; isSponsor: boolean }`. Consumed by Task 8 (nav) and Task 9/10 (home pages).

- [ ] **Step 1: Write the hook**

```typescript
// src/hooks/use-capabilities.tsx
"use client";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { store, SUPERADMIN_EMAILS } from "@/lib/mocks/mock-store";

export interface Capabilities {
  isSuperAdmin: boolean;
  organizationIds: string[];
  isOrganizer: boolean;
  sponsorId: string | null;
  isSponsor: boolean;
}

const anonymous: Capabilities = {
  isSuperAdmin: false,
  organizationIds: [],
  isOrganizer: false,
  sponsorId: null,
  isSponsor: false,
};

export function useCapabilities(): Capabilities {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return anonymous;
    const isSuperAdmin = SUPERADMIN_EMAILS.includes(user.email.toLowerCase());
    const organizationIds = store.organizations
      .filter((org) => org.members.some((member) => member.user_uuid === user.id))
      .map((org) => org.uuid);
    const sponsor = store.sponsors.find((item) =>
      item.pics.some((pic) => pic.user_uuid === user.id),
    );
    return {
      isSuperAdmin,
      organizationIds,
      isOrganizer: organizationIds.length > 0,
      sponsorId: sponsor?.uuid ?? null,
      isSponsor: Boolean(sponsor),
    };
  }, [user]);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-capabilities.tsx
git commit -m "feat: add useCapabilities hook deriving super admin, organizer, and sponsor status"
```

---

### Task 7: Landing page and intent-based post-auth redirect

**Files:**
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/app/(marketing)/page.tsx`
- Modify: `src/app/page.tsx` (delete the redirect-only version; the `(marketing)` route group now owns `/`)
- Modify: `src/lib/constants/routes.ts`
- Modify: `src/hooks/use-auth.tsx:97-150` (the `login` and `register` functions)
- Modify: `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx` (pass through the `intent` query param as a hidden link, so "Need an account? Sign up" keeps the chosen destination)

**Interfaces:**
- Consumes: `ROUTES` from `@/lib/constants/routes`.
- Produces: `ROUTES.landing`, `ROUTES.competitorHome`, `ROUTES.sponsorHome` — used by Task 9 and Task 10.

- [ ] **Step 1: Add the new route constants**

In `src/lib/constants/routes.ts`, add inside the `ROUTES` object (alongside `dashboard: "/dashboard"`):

```typescript
  landing: "/",
  competitorHome: "/my-competitions",
  sponsorHome: "/sponsor-home",
```

- [ ] **Step 2: Write the landing page**

```typescript
// src/app/(marketing)/layout.tsx
import "../(portal)/portal.css";
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

```typescript
// src/app/(marketing)/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { PawPrint, Trophy, Handshake } from "lucide-react";

export const metadata: Metadata = { title: "Petpet Competition Portal" };

const entries = [
  {
    key: "competitor",
    icon: PawPrint,
    title: "Ikut Kompetisi",
    description: "Daftarkan hewanmu dan ikuti kompetisi yang sedang dibuka.",
    href: "/sign-in?intent=competitor",
  },
  {
    key: "organizer",
    icon: Trophy,
    title: "Kelola Event / Kompetisi",
    description: "Bikin dan kelola event atau kompetisi untuk organisasimu.",
    href: "/sign-in?intent=organizer",
  },
  {
    key: "sponsor",
    icon: Handshake,
    title: "Jadi Sponsor",
    description: "Daftarkan brand-mu dan ajukan sponsorship ke event yang kamu mau.",
    href: "/sign-in?intent=sponsor",
  },
];

export default function LandingPage() {
  return (
    <main className="grid min-h-screen place-items-center p-8">
      <section className="page-stack" style={{ maxWidth: 960 }}>
        <h1>Petpet Competition Portal</h1>
        <p className="muted">Pilih peranmu untuk mulai.</p>
        <div className="form-grid">
          {entries.map((entry) => (
            <Link key={entry.key} href={entry.href} className="form-section">
              <entry.icon size={28} aria-hidden="true" />
              <h2>{entry.title}</h2>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Delete the old redirect-only root page**

Delete `src/app/page.tsx` (its content — `redirect("/sign-in")` — is fully replaced by `src/app/(marketing)/page.tsx`, which Next.js's App Router serves at the same `/` path from a route group).

- [ ] **Step 4: Read the intent through sign-in and sign-up**

In `src/app/sign-in/page.tsx`, change the "Need an account?" link (currently `<Link href="/sign-up">Sign up</Link>`) to carry the intent through, and read the intent server-side to pass it to the client form:

```typescript
// src/app/sign-in/page.tsx — replace the default export
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const signUpHref = intent ? `/sign-up?intent=${encodeURIComponent(intent)}` : "/sign-up";
  return (
    <main className={styles.page}>
      {/* ...unchanged story section... */}
      <section className={styles.formPanel} aria-labelledby="login-heading">
        <div className={styles.formWrap}>
          <div className={styles.formIcon}><PawPrint size={28} aria-hidden="true" /></div>
          <p className={styles.eyebrow}>WELCOME TO PETPET</p>
          <h2 id="login-heading">Welcome back</h2>
          <p className={styles.subtitle}>Sign in to manage your next great event.</p>
          <LoginForm intent={intent} />
          <p className={styles.help}>Need an account? <Link href={signUpHref}>Sign up</Link></p>
        </div>
        <footer className={styles.footer}>Petpet Competition Portal</footer>
      </section>
    </main>
  );
}
```

(Keep the existing `styles`/`Link`/`PawPrint` imports and the `<section className={styles.story}>` block exactly as they are today — only the exported function signature and the two marked lines change.)

In `src/app/sign-in/login-form.tsx`, accept the `intent` prop and pass it to `login`:

```typescript
export function LoginForm({ intent }: { intent?: string }) {
  const { login } = useAuth();
  // ...unchanged state...
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await login(email, password, intent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
      setPending(false);
    }
  }
  // ...unchanged JSX...
}
```

Apply the same two changes (accept `intent`, forward it) to `src/app/sign-up/page.tsx` and `src/app/sign-up/sign-up-form.tsx`, calling `register({ ... }, intent)` instead of `register({ ... })`.

- [ ] **Step 5: Make login/register redirect by intent**

In `src/hooks/use-auth.tsx`, change the `AuthContextValue` interface and the two functions:

```typescript
  login: (email: string, password: string, intent?: string) => Promise<void>;
  // ...
  register: (payload: SignUpPayload, intent?: string) => Promise<void>;
```

```typescript
  function destinationFor(intent?: string): string {
    if (intent === "organizer") return "/event-management/create";
    if (intent === "sponsor") return "/sponsor-home";
    return "/my-competitions";
  }
  async function login(email: string, password: string, intent?: string) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await AUTH_SERVICES.login(email, password);
      setAuthToken(response.data.access_token, response.data.expires_in);
      const profile = await AUTH_SERVICES.me();
      setState(authenticated(profile.data, response.data.access_token));
      router.replace(destinationFor(intent));
      router.refresh();
    } catch (cause) {
      removeAuthToken();
      setState({
        ...anonymous,
        error: cause instanceof Error ? cause.message : "Login failed.",
      });
      throw cause;
    }
  }
```

Apply the same `router.replace(destinationFor(intent))` change to `register` (replacing its current `router.replace("/competition")`), passing the `intent` parameter through. Leave `loginWithSso` pointed at `/competition` — SSO doesn't carry an intent in this plan.

- [ ] **Step 6: Verify manually**

Run: `npm run typecheck`
Expected: passes.

Run: `npm run dev -- --port 3001`, open `http://localhost:3001/`, click "Ikut Kompetisi", sign in with `competitor@petpet.dev` / `password123`.
Expected: lands on `/my-competitions` (a 404 is fine for now — that route is built in Task 9 — the important thing is the redirect target, confirmed by the URL bar).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx "src/app/(marketing)" src/lib/constants/routes.ts src/hooks/use-auth.tsx src/app/sign-in src/app/sign-up
git commit -m "feat: add landing page with three entry points and intent-based post-auth redirect"
```

---

### Task 8: Nav filtering by capability

**Files:**
- Modify: `src/components/layouts/sidebar/nav-data.ts`
- Modify: `src/components/layouts/portal-shell.tsx:1-80` (the `Navigation` component and its caller)

**Interfaces:**
- Consumes: `useCapabilities()` from Task 6.
- Produces: `navigation` items now carry a `capability` field; `Navigation` filters on it. No change to what `PortalShell` exports.

- [ ] **Step 1: Tag each nav group with the capability that unlocks it**

Rewrite `src/components/layouts/sidebar/nav-data.ts`:

```typescript
import {
  CalendarDays,
  Flag,
  Users,
  PawPrint,
  Handshake,
  ChartNoAxesCombined,
} from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";

export type NavCapability = "superAdmin" | "organizer" | "competitor" | "sponsor";

export const navigation = [
  {
    label: "User",
    icon: Users,
    capability: "superAdmin" as NavCapability,
    items: [{ label: "User Management", href: ROUTES.userManagement }],
  },
  {
    label: "Event",
    icon: CalendarDays,
    capability: "organizer" as NavCapability,
    items: [
      { label: "Event Management", href: ROUTES.eventManagement.root },
      { label: "Organization Management", href: ROUTES.organizationManagement },
      { label: "Event Registration", href: ROUTES.eventManagement.eventRegistration },
      { label: "Committee Registration", href: ROUTES.eventManagement.committeeRegistration },
      { label: "Partner Registration", href: ROUTES.eventManagement.partnerRegistration },
      { label: "Doorprize Drawing", href: ROUTES.eventManagement.doorprizeDrawing },
      { label: "Event Participant", href: ROUTES.eventManagement.eventParticipant },
    ],
  },
  {
    label: "Competition",
    icon: Flag,
    href: ROUTES.competition,
    capability: "organizer" as NavCapability,
  },
  {
    label: "My Competitions",
    icon: PawPrint,
    href: ROUTES.competitorHome,
    capability: "competitor" as NavCapability,
  },
  {
    label: "Pet",
    icon: PawPrint,
    capability: "competitor" as NavCapability,
    items: [
      { label: "Pet Management", href: ROUTES.petManagement },
      { label: "Add New Pet", href: ROUTES.pets.create },
    ],
  },
  {
    label: "Sponsor",
    icon: Handshake,
    href: ROUTES.sponsorHome,
    capability: "sponsor" as NavCapability,
  },
  {
    label: "Brands",
    icon: Handshake,
    capability: "organizer" as NavCapability,
    items: [
      { label: "Brand Management", href: ROUTES.sponsorshipBrand },
      { label: "Add New Brand", href: ROUTES.brands.create },
    ],
  },
  {
    label: "Report",
    icon: ChartNoAxesCombined,
    href: ROUTES.report,
    capability: "organizer" as NavCapability,
  },
];
```

- [ ] **Step 2: Filter groups in `Navigation`, with Super Admin seeing everything**

In `src/components/layouts/portal-shell.tsx`, add the import and change the `Navigation` function (currently `src/components/layouts/portal-shell.tsx:23-80`):

```typescript
import { useCapabilities } from "@/hooks/use-capabilities";

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const capabilities = useCapabilities();
  const visible = navigation.filter((group) => {
    if (capabilities.isSuperAdmin) return true;
    if (group.capability === "organizer") return capabilities.isOrganizer;
    if (group.capability === "sponsor") return capabilities.isSponsor;
    if (group.capability === "superAdmin") return false;
    return true; // "competitor" groups are always visible
  });
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {visible.map((group) => {
        /* ...unchanged body, using `group` from `visible` instead of `navigation`... */
      })}
    </nav>
  );
}
```

(Keep the rest of the function — the `if (group.href) return (...)` branch and the `<details>` branch — exactly as it is today; only the source array changes from `navigation.map` to `visible.map`, and the two new lines/import are added above it.)

- [ ] **Step 3: Verify manually**

Run: `npm run typecheck`
Expected: passes.

Run: `npm run dev -- --port 3001`. Sign in as `competitor@petpet.dev` — the sidebar should show only "My Competitions" and "Pet". Sign out, sign in as `organizer@petpet.dev` — sidebar should additionally show "Event", "Competition", "Brands", "Report" but not "User" or "Sponsor". Sign in as `admin@petpet.dev` — sidebar should show every group.

- [ ] **Step 4: Commit**

```bash
git add src/components/layouts/sidebar/nav-data.ts src/components/layouts/portal-shell.tsx
git commit -m "feat: filter portal navigation by signed-in account capability"
```

---

### Task 9: Competitor home page

**Files:**
- Create: `src/app/(portal)/my-competitions/page.tsx`
- Create: `src/app/(portal)/my-competitions/_components/competitor-home.tsx`

**Interfaces:**
- Consumes: `EVENT_SERVICES`, `COMPETITION_SERVICES` (existing, now mock-backed), `collectRows` from `@/services/common`, `useAuth()`, `ENTRY_SERVICES`, `PET_SERVICES`.
- Produces: nothing consumed by later tasks — this is a leaf page.

- [ ] **Step 1: Write the competitor home component**

```typescript
// src/app/(portal)/my-competitions/_components/competitor-home.tsx
"use client";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
import { useAuth } from "@/hooks/use-auth";
import { EVENT_SERVICES } from "@/services/event-management";
import { COMPETITION_SERVICES } from "@/services/competition";
import { ENTRY_SERVICES } from "@/services/event-operations";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";

type IdRow = Row & { id: string };
const withId = (row: Row): IdRow => ({ ...row, id: String(row.uuid) });

export function CompetitorHome() {
  const { user } = useAuth();
  const [events, setEvents] = useState<IdRow[]>([]);
  const [entries, setEntries] = useState<IdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loadedEvents = await collectRows(EVENT_SERVICES.list);
        const competitionsByEvent = await Promise.all(
          loadedEvents.map((event) =>
            collectRows((params) => COMPETITION_SERVICES.list(String(event.uuid), params)),
          ),
        );
        const competitions = competitionsByEvent.flat();
        const entriesByCompetition = await Promise.all(
          competitions.map((competition) =>
            collectRows((params) => ENTRY_SERVICES.list(String(competition.uuid), params)),
          ),
        );
        const myEntries = entriesByCompetition
          .flat()
          .filter((entry) => entry.owner_uuid === user?.id);
        if (active) {
          setEvents(loadedEvents.map(withId));
          setEntries(myEntries.map(withId));
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load competitions.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading) return <p role="status">Loading competitions...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <div className="page-stack">
      <PageHeading title="Cari Event & Kompetisi" description="Kompetisi yang sedang dibuka." />
      <DataTable
        label="Events"
        rows={events}
        columns={[
          { key: "name", label: "Event", value: (row) => String(row.name ?? "") },
          { key: "start_at", label: "Mulai", value: (row) => String(row.start_at ?? "") },
          { key: "status", label: "Status", value: (row) => String(row.status ?? "") },
        ]}
      />
      <PageHeading title="Entry Saya" />
      <DataTable
        label="Entries"
        rows={entries}
        columns={[
          { key: "bib_number", label: "Bib", value: (row) => String(row.bib_number ?? "-") },
          { key: "payment_status", label: "Pembayaran", value: (row) => String(row.payment_status ?? "") },
          { key: "status", label: "Status", value: (row) => String(row.status ?? "") },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```typescript
// src/app/(portal)/my-competitions/page.tsx
import { CompetitorHome } from "./_components/competitor-home";
export default function Page() {
  return <CompetitorHome />;
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run typecheck`
Expected: passes.

Run: `npm run dev -- --port 3001`, sign in as `competitor@petpet.dev`, open `/my-competitions`.
Expected: sees "Jakarta Pet Festival 2026" in the events table and one entry (bib `001`) in the entries table.

Then register a brand-new account from the landing page ("Ikut Kompetisi" → sign up with a fresh email) — this account has no organization and no sponsor profile.
Expected: `/my-competitions` still renders (empty entries table, no crash), and the sidebar shows only the Competitor nav groups.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/my-competitions"
git commit -m "feat: add competitor home page listing open events and the account's own entries"
```

---

### Task 10: Sponsor onboarding, sponsor home, and organizer approval view

**Files:**
- Create: `src/app/(portal)/sponsor-home/page.tsx`
- Create: `src/app/(portal)/sponsor-home/_components/sponsor-home.tsx`
- Modify: `src/components/common/api-workspace.tsx` (add a pending-applications block to the event detail view, alongside the existing "Competition committee"/"Competition participants" sections at `src/components/common/api-workspace.tsx:895-994`)

**Interfaces:**
- Consumes: `SPONSOR_SERVICES`, `EVENT_SPONSOR_SERVICES`, `useAuth()`, `useCapabilities()`, `collectRows`.
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Write the sponsor home component**

```typescript
// src/app/(portal)/sponsor-home/_components/sponsor-home.tsx
"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { SPONSOR_SERVICES } from "@/services/sponsorship-brand";
import { EVENT_SERVICES } from "@/services/event-management";
import { EVENT_SPONSOR_SERVICES } from "@/services/event-operations";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";

type IdRow = Row & { id: string };
const withId = (row: Row): IdRow => ({ ...row, id: String(row.uuid) });

export function SponsorHome() {
  const { user } = useAuth();
  const capabilities = useCapabilities();
  const [brandName, setBrandName] = useState("");
  const [pending, setPending] = useState(false);
  const [events, setEvents] = useState<IdRow[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);

  async function loadApplications(sponsorId: string) {
    const loadedEvents = await collectRows(EVENT_SERVICES.list);
    const links = (
      await Promise.all(
        loadedEvents.map((event) =>
          collectRows((params) => EVENT_SPONSOR_SERVICES.list(String(event.uuid), params)),
        ),
      )
    )
      .flat()
      .filter((link) => link.sponsor_uuid === sponsorId);
    setEvents(loadedEvents.map(withId));
    setApplications(links);
  }

  useEffect(() => {
    if (capabilities.sponsorId) void loadApplications(capabilities.sponsorId);
  }, [capabilities.sponsorId]);

  async function createProfile() {
    if (!user || !brandName.trim()) return;
    setPending(true);
    try {
      const created = await SPONSOR_SERVICES.create({ brand_name: brandName.trim() });
      await SPONSOR_SERVICES.addPic(created.data.uuid, user.id);
      toast.success("Sponsor profile created");
      await loadApplications(created.data.uuid);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to create sponsor profile.");
    } finally {
      setPending(false);
    }
  }

  async function apply(eventId: string) {
    if (!capabilities.sponsorId) return;
    try {
      await EVENT_SPONSOR_SERVICES.create(eventId, {
        sponsor_id: capabilities.sponsorId,
        sponsorship_level: "BRONZE",
      });
      toast.success("Application sent — waiting for organizer approval");
      await loadApplications(capabilities.sponsorId);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to apply.");
    }
  }

  if (!capabilities.sponsorId) {
    return (
      <div className="page-stack">
        <PageHeading title="Jadi Sponsor" description="Buat profil brand-mu dulu." />
        <Field label="Nama brand">
          <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} disabled={pending} />
        </Field>
        <Button onClick={createProfile} disabled={pending || !brandName.trim()}>
          {pending ? "Menyimpan..." : "Buat profil sponsor"}
        </Button>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeading title="Event yang Dibuka untuk Sponsor" />
      <DataTable
        label="Events"
        rows={events}
        columns={[
          { key: "name", label: "Event", value: (row) => String(row.name ?? "") },
          {
            key: "status",
            label: "Status pengajuan",
            value: (row) =>
              applications.find((application) => application.event_uuid === row.uuid)?.status ??
              "-",
          },
        ]}
        actions={(row) =>
          applications.some((application) => application.event_uuid === row.uuid) ? null : (
            <Button size="sm" onClick={() => apply(String(row.uuid))}>
              Ajukan sponsor
            </Button>
          )
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```typescript
// src/app/(portal)/sponsor-home/page.tsx
import { SponsorHome } from "./_components/sponsor-home";
export default function Page() {
  return <SponsorHome />;
}
```

- [ ] **Step 3: Add the pending-applications block to the organizer's event detail view**

In `src/components/common/api-workspace.tsx`, inside the `{collection === "events" && (...)}` block (currently `src/components/common/api-workspace.tsx:901-915`), add a pending-sponsor-applications list after the existing "Publish event" action:

```typescript
          {collection === "events" && (
            <div className="form-actions">
              <Link className="link-button" href={path + "/" + record.id + "/competitions"}>
                Manage competitions
              </Link>
              <ApiAction action={() => EVENT_SERVICES.publish(record.id)} label="Publish event" confirm />
            </div>
          )}
          {collection === "events" && (
            <PendingSponsorApplications eventId={record.id} />
          )}
```

Add this component in the same file, above `export function ApiWorkspace`:

```typescript
function PendingSponsorApplications({ eventId }: { eventId: string }) {
  const [links, setLinks] = useState<(Row & { id: string })[]>([]);
  const load = useCallback(async () => {
    const rows = await collectRows((params) => EVENT_SPONSOR_SERVICES.list(eventId, params));
    setLinks(rows.map((row) => ({ ...row, id: String(row.uuid) })));
  }, [eventId]);
  useEffect(() => {
    void load();
  }, [load]);
  const pending = links.filter((link) => link.status === "pending");
  if (pending.length === 0) return null;
  return (
    <section className="form-section page-stack">
      <h2>Pengajuan sponsor</h2>
      <DataTable
        label="Sponsor applications"
        rows={pending}
        columns={[
          { key: "sponsor_uuid", label: "Sponsor", value: (row) => String(row.sponsor_uuid ?? "") },
          { key: "sponsorship_level", label: "Level", value: (row) => String(row.sponsorship_level ?? "") },
        ]}
        actions={(row) => (
          <ApiAction
            action={async () => {
              await EVENT_SPONSOR_SERVICES.delete(eventId, String(row.uuid));
              await load();
              return null;
            }}
            label="Tolak"
          />
        )}
      />
    </section>
  );
}
```

Add `useCallback` to the existing `import { useEffect, useState, ... } from "react"` at the top of the file, and add `import { EVENT_SPONSOR_SERVICES } from "@/services/event-operations";` and `import { collectRows } from "./common";` if not already present (check first — `collectRows` is already imported at `src/components/common/api-workspace.tsx:19`, so only `EVENT_SPONSOR_SERVICES` and `useCallback` are new).

(This block only removes an application on reject, since the mock router in Task 4 has no "approve" endpoint for event-sponsor links — approval is simply leaving the link as-is; a follow-up plan can add a real approve action once this is reconnected to a backend that supports it.)

- [ ] **Step 4: Verify manually**

Run: `npm run typecheck`
Expected: passes.

Run: `npm run dev -- --port 3001`. Sign in as `sponsor@petpet.dev` (already seeded with a sponsor profile) at `/sponsor-home` — apply to "Jakarta Pet Festival 2026". Sign out, sign in as `organizer@petpet.dev`, open that event's detail page in Event Management.
Expected: a "Pengajuan sponsor" section lists the pending application; clicking "Tolak" removes it.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(portal)/sponsor-home" src/components/common/api-workspace.tsx
git commit -m "feat: add sponsor onboarding/home and organizer sponsor-application review"
```

---

### Task 11: Scope the Event Management list to the Organizer's own organization

**Files:**
- Modify: `src/components/common/api-workspace.tsx:480-538` (the `ApiWorkspace` component's `serviceList`/`list` setup)

**Interfaces:**
- Consumes: `useCapabilities()` from Task 6.
- Produces: no exported interface change — this narrows what `ApiWorkspace` fetches for the `events` collection.

The spec calls for Organizer views to be scoped to the account's own
organization (the current portal shows every event to everyone). The
mock `GET /events` handler already accepts an `organization_id` filter
(Task 3); this task makes `ApiWorkspace` send it for non-Super-Admin
accounts.

- [ ] **Step 1: Pass `organization_id` into the events list call**

In `src/components/common/api-workspace.tsx`, add the import:

```typescript
import { useCapabilities } from "@/hooks/use-capabilities";
```

Inside `ApiWorkspace` (`src/components/common/api-workspace.tsx:480-497`), add the hook call near the other hooks:

```typescript
  const capabilities = useCapabilities();
```

Change the `serviceList` map (currently `src/components/common/api-workspace.tsx:521-528`) so `events` is scoped:

```typescript
  const serviceList: Partial<
    Record<Supported, (params: ListParams) => Promise<ListResponse>>
  > = {
    users: USER_SERVICES.list,
    pets: PET_SERVICES.list,
    brands: SPONSOR_SERVICES.list,
    events: (params) =>
      EVENT_SERVICES.list(
        capabilities.isSuperAdmin || capabilities.organizationIds.length === 0
          ? params
          : { ...params, organization_id: capabilities.organizationIds[0] },
      ),
  };
```

(An Organizer who belongs to more than one organization only gets the
first one filtered here — the API only accepts a single
`organization_id`. Showing the union of several organizations' events
is out of scope for this plan; the seed data in Task 1 gives each demo
Organizer exactly one organization, so this is not exercised yet.)

- [ ] **Step 2: Verify manually**

Run: `npm run typecheck`
Expected: passes.

Run: `npm run dev -- --port 3001`, sign in as `organizer@petpet.dev`, open Event Management.
Expected: sees "Jakarta Pet Festival 2026" (their own organization's event). Sign in as `admin@petpet.dev` instead.
Expected: still sees every event (Super Admin bypasses the filter).

- [ ] **Step 3: Commit**

```bash
git add src/components/common/api-workspace.tsx
git commit -m "feat: scope Event Management list to the organizer's own organization"
```
