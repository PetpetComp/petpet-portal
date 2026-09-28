# Align frontend role/organization model to the real backend RBAC — design

## Problem

This session built the frontend's role model (Super Admin / Organizer /
Competitor / Sponsor) and its mock backend against assumptions made
before the real backend source was available: any signed-up user can
instantly create an organization (via event creation), organization
membership is tracked as a flat "PIC" list with no role distinction,
and there's no concept of event-scoped staff roles (judge, committee,
etc.) beyond a single generic "committee" collection.

Reading the actual backend (`pet-competition-service`, Laravel) shows
a materially different, already-built model:

- A full RBAC system (`roles`, `permissions`, `user_roles`,
  `role_permissions`) with four seeded roles: `SUPER_ADMIN`, `USER`
  (default for every registration — view-only, no `event.create`),
  `ORGANIZATION_OWNER`, `ORGANIZER`.
- Organizations are not self-service. `POST /events` with
  `new_organization` (the "quick-create" path this session's wizard
  uses) requires the `event.create` permission — plain `USER`s don't
  have it. The intended path is `POST /organizer-applications`
  (proposed org name + contact info) reviewed by someone holding
  `organization.manage`, who approves or rejects; approval creates
  the organization and makes the applicant its `OWNER` member.
- Organization membership (`organization_members`) has real roles —
  `OWNER` / `ADMIN` / `STAFF` — confirmed against
  `PATCH /organizations/{uuid}/members/{userUuid}`. There's a
  separate `pics` field on the organization itself (contact people,
  added in a later migration) — distinct from membership roles, not a
  stand-in for them the way this session's mock used it.
- Event/competition-scoped staff roles already exist end-to-end
  (`staff_assignments`, `staff_invitations`,
  `ChecksStaffAssignment`): `EVENT_MANAGER`, `COMPETITION_PIC`,
  `TIMER_OPERATOR`, `MARSHAL`, `JUDGE`, `HEAD_JUDGE`. The frontend's
  existing Committee Registration form (`api-workspace.tsx`'s
  `committee` collection) already offers exactly this role list — it
  was built against the real contract without knowing it.

## Goal

Bring the frontend's role/organization flow in line with what the
real backend actually expects, while staying on the mock backend
layer (per the user's standing direction: backend integration is a
later, separate step). The mock store and router gain the same
shapes and rules the real API has, so when the real backend is
reconnected later, it's a flag flip, not a rewrite.

Out of scope: touching the real backend at all (explicitly ruled out
earlier this session); building an admin UI for `staff_assignments`
beyond what already exists; anything about Judge/Committee's actual
scoring or check-in screens (only the *assignment* model is in scope
here).

## Changes

### 1. "Become an organizer" is an application, not instant creation

- Landing page's "Kelola Event / Kompetisi" intent still leads to
  sign-up, but the post-signup destination for a `USER` with no
  organization changes from the event-creation wizard to a new
  **"Ajukan jadi Organizer"** form: proposed organization name,
  organization type, description, contact email/phone, address —
  matching `organizer-applications`' real request body.
- New mock endpoints: `POST /organizer-applications`,
  `GET /organizer-applications/me`, `DELETE /organizer-applications/{uuid}`,
  and (Super Admin only) `GET /organizer-applications`,
  `POST /organizer-applications/{uuid}/approve`,
  `POST /organizer-applications/{uuid}/reject`. Approval creates a
  mock organization and an `OWNER` membership for the applicant,
  mirroring `OrganizerApplicationService::approve`.
- While an application is `SUBMITTED`/`UNDER_REVIEW`, the applicant
  sees a pending-status screen instead of the form. If `REJECTED`,
  they see the reviewer's note and can re-apply.
- New Super Admin nav item **"Organizer Applications"** — a queue
  (pending count badge, approve/reject) reusing the FilterDrawer
  pattern already built for other lists.
- The event-creation wizard's Step 2 "name a new organization" path
  (used by a `USER` with none yet) is removed — organizations are no
  longer created via event creation at all once this ships. The
  wizard's Super-Admin "or create organization named" path is also
  removed for the same reason: even Super Admin follows the
  application path, or picks an existing org. `POST /events` keeps
  accepting `organization_id` only (matches the real
  `EventService::create`'s `organization_id` branch, which needs no
  special permission beyond being that org's `OWNER`/`ADMIN`).

### 2. Organization membership uses real OWNER/ADMIN/STAFF roles

- `MockOrganization.pics` (this session's stand-in) splits into two
  real fields: `members: { user_uuid, role: "OWNER"|"ADMIN"|"STAFF" }[]`
  (drives capability + the member-role endpoints) and `pics` stays as
  the real API's separate contact-person list (unrelated to
  authorization) — the "PIC" UI this session built already reads/
  writes to what should have been `members`; it gets renamed to
  reflect that these are org members with roles, not contacts.
- `useCapabilities()`'s `isOrganizer` becomes: the user appears in
  any organization's `members` array (any role), matching
  `requireOrgRole($org, ['OWNER','ADMIN'])` gating most write actions
  in the real service layer. `organizationIds` stays as-is.
- **My Organization** page (built earlier this session) changes from
  a flat PIC list to a member list with each person's role shown via
  `StatusBadge`, and — for the account's own `OWNER`/`ADMIN` — the
  existing invite-based flow (see below) instead of the ad-hoc
  `OrganizationForm` multi-select-and-create-user reuse. The
  multi-select PIC editor built earlier is dropped from this page
  (it edited the wrong field, `pics`, for this purpose); the reused
  `OrganizationForm` component's PIC picker stays as-is for Super
  Admin's Organization Management screen, since that screen's job —
  editing the org's real contact people — hasn't changed.

### 3. Organization invitations (real flow, new to the frontend)

- New mock endpoints: `POST /organizations/{uuid}/invitations`,
  `GET /organizations/{uuid}/invitations`,
  `DELETE /organizations/{uuid}/invitations/{invitationUuid}`,
  `GET /invitations/{token}`, `POST /invitations/{token}/accept`,
  `POST /invitations/{token}/decline}`.
- My Organization page (for an `OWNER`/`ADMIN`) gets an "Invite
  member" action: email + role (`ADMIN`/`STAFF`) → creates a pending
  invitation, listed with a cancel action.
- A new `/invitations/[token]` page: shows the invited org/role: for
  a signed-in matching-email user, Accept/Decline buttons; for
  everyone else, a message to sign in with the invited email.

### 4. Staff/committee terminology check (likely no code change)

- Confirm the existing Committee Registration form's role choices
  (`EVENT_MANAGER`, `COMPETITION_PIC`, `TIMER_OPERATOR`, `MARSHAL`,
  `JUDGE`, `HEAD_JUDGE`) match `StaffAssignment`'s real role enum
  exactly (spot-check during planning, not a design decision — fix
  the list only if a mismatch turns up).

## Mock layer additions (summary)

New collections in the mock store: `organizerApplications`,
`organizationInvitations`. `MockOrganization.members` replaces the
capability-only field this session invented; `pics` keeps its
existing, narrower meaning. New mock routes for the endpoints listed
in sections 1 and 3.

## Ownership

- `src/lib/mocks/mock-types.ts`, `mock-store.ts`, `mock-request.ts` —
  new collections/routes.
- `src/hooks/use-capabilities.tsx` — `isOrganizer` reads `members`.
- `src/app/(portal)/my-organization/` — member list + invite flow,
  replacing the PIC editor reuse.
- New `src/app/(portal)/organizer-applications/` (Super Admin queue)
  and its "apply" counterpart reachable from sign-up for a
  member-less `USER`.
- New `src/app/invitations/[token]/` (outside the portal shell — an
  invited person may not be signed in yet, same pattern as
  `sign-in`/`sign-up`).
- `src/app/(portal)/event-management/_components/event-create-wizard.tsx`
  — remove the new-organization paths; keep `organization_id` only.
- `src/components/layouts/sidebar/nav-data.ts` — add the Organizer
  Applications nav item (Super Admin).
