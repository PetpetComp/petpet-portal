# Role-based access flow — design

## Problem

The portal today drops every signed-in account into one full back-office
(event, competition, user, pet, organization, sponsor, and report
management) regardless of who they are. A pet owner who only wants to
enter a competition sees the same admin surface as someone running an
event. There is no entry point for someone who isn't sure whether they
want to compete, run an event, or sponsor one.

## Goal

Give the portal a landing experience and a post-login navigation that
match what the signed-in account actually does, without inventing a
role system the backend doesn't have.

**Revision (2026-09-28):** the whole backend is detached for this
phase, not just the new capability signals. Login, users, pets, events,
competitions, organizations, sponsors, and entries all run against an
in-memory mock data layer. This is a single reversible switch (see
"Mock backend layer" below) — re-connecting to the real API later means
flipping one flag, not undoing the frontend work. Automated tests are
out of scope; the user will handle testing.

## Mock backend layer (full detach)

`src/lib/api-client.ts`'s `request<T>()` function is the one chokepoint
every service already calls through (`apiClient.get/post/patch/delete`
→ `request`). A mock switch is added there:

- `NEXT_PUBLIC_USE_MOCK_BACKEND=true` (new env flag, defaults to `true`
  for this phase) makes `request<T>()` call a new `mockRequest<T>()`
  instead of `fetch`. No service file, hook, or component changes:
  they all keep calling `apiClient.get(ENDPOINTS.events.list)` etc.
  exactly as today.
- `mockRequest` pattern-matches `method + endpoint` against the routes
  in `ENDPOINTS` (including dynamic `:uuid` segments) and reads/writes
  an in-memory store seeded from fixtures. It shapes responses exactly
  like today's `ApiResponse`/`ListResponse`/paginated envelope, so
  `collectRows`, `mapRecord`, and `recordPayload` need no changes.
  State resets on full page reload (same limitation already accepted
  for other v560 editable dummy workflows).
- Covered for this phase: `auth` (login/register/me/logout/roles/
  permissions), `users`, `pets`, `events`, `competitions`,
  `organizations`, `sponsors` (+ pics), `entries`, and
  `events/{id}/sponsors`. Endpoints outside that set (staff
  invitations, master/regions catalogs, registration periods, score
  criteria, photo presign) return a generic
  `{ success: false, message: "Not available in demo mode." }` so niche
  screens fail gracefully instead of crashing, rather than being fully
  modeled — those are unrelated to the role/landing flow this spec
  covers.
- Seed data models four demo personas end-to-end: a Super Admin
  (allowlisted), an Organizer who owns one organization with one
  event, a plain Competitor, and a Sponsor with a brand profile — so
  the full flow below is demoable without any real network call.

## Backend constraints (why the role model looks like this)

Confirmed against the deployed API
(`https://petpet-service.onrender.com`):

- `POST /auth/register` has no role or account-type field. Every
  account is the same shape.
- There is no `POST /organizations`. An organization is created
  implicitly when a user creates an event with `new_organization.*`
  instead of an existing `organization_id`. The creator becomes that
  organization's member.
- Roles are `OWNER` / `ADMIN` / `STAFF`, scoped to one organization
  each. There is no platform-wide role.
- `POST /sponsors` (create a sponsor brand) and
  `POST /sponsors/{id}/pics` (attach a user as PIC) already exist and
  are already used by `SPONSOR_SERVICES`.
- `POST /events/{id}/sponsors` (attach a sponsor to an event) requires
  auth; whether a non-staff sponsor account may call it directly is
  undocumented. Treated as an open question, not assumed.

Because there is no platform-admin endpoint, "admin sees everything"
cannot be a real backend role. It is approximated on the frontend as an
allowlist.

## Role / capability model

Capabilities are derived from data the account holds, not a field
chosen at sign-up. One account can hold more than one capability at
once.

- **Super Admin** — the signed-in account's email/id is in a
  configured allowlist (multiple entries supported, e.g.
  `NEXT_PUBLIC_SUPERADMIN_EMAILS`, comma-separated). Sees and can act
  on every organization, exactly like the portal's current unscoped
  behavior.
- **Organizer** — the account is `OWNER`/`ADMIN`/`STAFF` on at least
  one organization. Scoped to that organization's events,
  competitions, sponsor list, and reports only.
- **Competitor** — the default for every account. Browse published
  events/competitions, manage own pets, view own entries.
- **Sponsor** — an additional capability, not exclusive: the account
  has created a sponsor profile (and is its PIC). Adds a sponsor home
  (browse events open for sponsorship, apply, track own applications).

No "choose your account type" step exists at sign-up. The landing
page's three entry points only pick where the user lands *after*
auth — they don't write a role.

## Capability data comes from the mock store, not a separate fixture

`useCapabilities()` reads straight off the mock store's own records —
no parallel ad-hoc fixture file:

- Organization membership: each mock organization record carries a
  `members: { user_uuid, role: "OWNER" | "ADMIN" | "STAFF" }[]` list,
  mirroring the real member shape. A user is an Organizer if they
  appear in any organization's `members`.
- Sponsor profile: a user is a Sponsor if any mock sponsor record's
  `pics` list contains their `user_uuid` (same shape `SPONSOR_SERVICES`
  already reads).
- Sponsor-to-event applications: the mock `events/{id}/sponsors` link
  gets one mock-only extra field, `status: "pending" | "approved" |
  "rejected"`, defaulting existing/seeded links to `"approved"` and new
  self-service applications to `"pending"`. This field doesn't exist on
  the real API — it's flagged here so reconnecting later means dropping
  it, not adding it.

## Landing page (signed out)

Replaces the current generic sign-up copy with three entry points:

1. **"Ikut Kompetisi"** → sign in/up → Competitor home.
2. **"Kelola Event/Kompetisi (Organisasi)"** → sign in/up → if the
   account has no organization yet, straight into the event-creation
   wizard (which creates the org); if it already belongs to one,
   straight into that organization's back-office.
3. **"Jadi Sponsor"** → sign in/up → sponsor-profile onboarding
   (brand name, contact) → Sponsor home.

The destination is carried through the existing sign-in/sign-up
redirect mechanism (a `next`/intent param), not a new database field.

## Post-login navigation

One shell (`PortalShell`), sections filtered by capability instead of
a fixed nav list:

- **Competitor** (always): Cari Event/Kompetisi, Pet Saya, Entry Saya.
- **Organisasi** (if org member): existing Event Management,
  Competition ops, Sponsor list, Report — filtered to the user's own
  `organization_id` via the mock store's membership list.
- **Sponsor** (if sponsor profile exists): Profil Sponsor, Event yang
  Diikuti/Diajukan.
- **Super Admin** (if allowlisted): everything unscoped, i.e. today's
  full nav (User Management, Organization Management across orgs, all
  events/competitions/sponsors/reports).

A new `useCapabilities()` hook centralizes this derivation (super
admin check, org memberships, sponsor profile) and is consumed by both
`PortalShell` (nav filtering) and `AuthGuard`/route entry points
(default redirect after login).

## Sponsor → event application

"Ajukan jadi sponsor" on an event calls `POST /events/{id}/sponsors`
exactly like the real flow will, but against the mock store, which
records it with `status: "pending"` instead of auto-approving. The
event's organizer view lists pending applications for their own events
and can mark them approved/rejected (a small mock-only status update,
not a real endpoint). This keeps the UI shape identical to what the
real flow will need later — only the backend question of whether a
non-staff account may call `POST /events/{id}/sponsors` directly stays
open for whenever the real API is reconnected.

## Data scoping for Organizer

List endpoints are not organization-scoped server-side today (the
current portal already shows everything to anyone), and the mock store
mirrors that on purpose. Organizer views filter client-side: look up
the user's organization ids from the mock membership list, then filter
fetched records by `organization_id` before rendering. This is a UX
narrowing, not real authorization — noted as a known gap for whenever
backend scoping exists.

## Ownership (new pieces, following the existing v560 ownership rules)

- `src/lib/mocks/mock-backend.ts` (or a small folder) — the in-memory
  store, seed data, and `mockRequest<T>()` router described above.
- `src/lib/api-client.ts` — one added branch in `request<T>()` to call
  `mockRequest` when the mock flag is on.
- `src/hooks/use-capabilities.tsx` — derives Super Admin / Organizer /
  Competitor / Sponsor from auth state + the mock store's own records.
- `src/app/page.tsx` (or a new `(marketing)` route) — the three-entry
  landing page replacing the current redirect-only root.
- `src/components/layouts/portal-shell.tsx` — nav filtered through
  `useCapabilities()`.
- New route groups for Competitor home and Sponsor home, following the
  existing `(portal)` folder convention.
