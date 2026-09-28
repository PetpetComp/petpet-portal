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
role system the backend doesn't have. Backend integration for the new
capability signals (organization membership, sponsor profile,
sponsor-to-event requests) is deferred; this phase builds the frontend
flow against dummy fixtures, following the same pattern already used
for drawing/race-control/contest data in `architecture-v560.md`.

Out of scope: new backend endpoints, wiring real API calls for
capability data, and automated tests (the user will handle testing).

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

## Dummy data for this phase

New fixtures under `src/lib/mocks` (following the existing
`event-operations.ts` fixture pattern):

- Organization membership per user: `{ userId, organizationId, role: "OWNER" | "ADMIN" | "STAFF" }[]`.
- Sponsor profile per user: `{ userId, sponsorId }` presence check.
- Sponsor-to-event applications: `{ sponsorId, eventId, status: "pending" | "approved" | "rejected" }[]`,
  mutated client-side through `PortalDataProvider` session state (not
  persisted server-side, resets on reload — same limitation already
  documented for other v560 editable dummy workflows).

Real accounts keep using the existing real `useAuth`/`AUTH_SERVICES`
login. Only the capability signals above are dummy until the backend
adds them.

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
  `organization_id` via the dummy membership fixture.
- **Sponsor** (if sponsor profile exists): Profil Sponsor, Event yang
  Diikuti/Diajukan.
- **Super Admin** (if allowlisted): everything unscoped, i.e. today's
  full nav (User Management, Organization Management across orgs, all
  events/competitions/sponsors/reports).

A new `useCapabilities()` hook centralizes this derivation (super
admin check, org memberships, sponsor profile) and is consumed by both
`PortalShell` (nav filtering) and `AuthGuard`/route entry points
(default redirect after login).

## Sponsor → event application (dummy)

"Ajukan jadi sponsor" on an event writes a pending application to the
dummy applications fixture instead of calling
`POST /events/{id}/sponsors`. The event's organizer view lists pending
applications for their own events and can mark them
approved/rejected (dummy state only). This keeps the same shape the
real flow will need later — swapping the fixture writes for real
service calls is the only expected change once the backend question
above is resolved.

## Data scoping for Organizer

List endpoints are not organization-scoped server-side today (the
current portal already shows everything to anyone). Organizer views
filter client-side: look up the user's organization ids from the
membership fixture, then filter fetched/mocked records by
`organization_id` before rendering. This is a UX narrowing, not real
authorization — noted as a known gap for when backend scoping exists.

## Ownership (new pieces, following the existing v560 ownership rules)

- `src/lib/mocks/capabilities.ts` — new dummy fixtures described above.
- `src/hooks/use-capabilities.tsx` — derives Super Admin / Organizer /
  Competitor / Sponsor from auth state + fixtures.
- `src/app/page.tsx` (or a new `(marketing)` route) — the three-entry
  landing page replacing the current redirect-only root.
- `src/components/layouts/portal-shell.tsx` — nav filtered through
  `useCapabilities()`.
- New route groups for Competitor home and Sponsor home, following the
  existing `(portal)` folder convention.
