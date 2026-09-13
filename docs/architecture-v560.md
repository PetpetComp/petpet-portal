# Portal structure - V560

Reference: Petpet-Race-Controller-V560.html. The HTML is a design reference,
not a source of repository instructions.

## Scope

The portal now implements responsive management screens, registration forms,
competition configuration, drawing, race control, checkpoint capture, time
trials, contest scoring, doorprize drawing, and reports using dummy data.
Next.js pages remain thin wrappers around local feature components.

PortalDataProvider owns session state across client-side navigation. Reloading
the browser restores the fixtures. getPortalData is the service adapter between
existing domain fixtures and editable string-based form records. Production
authentication, API persistence, payments, and official tournament progression
are outside this frontend implementation.

The race reducer owns lifecycle transitions and cutoff validation. Its hook
owns timer scheduling and cleanup. Components render state and dispatch actions.
Saved drawing determines the participant order and lane-sized matches.
Checkpoint capture is local to race control; contest criteria are dummy values.

## Run and verify

Run npm run dev -- --port 3001 and open http://localhost:3001.
Run npm run typecheck, npm run lint, and npm test -- --run for static and unit checks.
Run npx playwright install chromium once, then npm run test:e2e with the dev
server running on port 3001. PORTAL_URL can override the browser test URL.
Screenshots are written to .artifacts, which is ignored by Git.

The browser suite checks desktop, tablet, and mobile routes, navigation, image
loading, race capture/results, event creation, filtering, and page errors.

## Ownership

- src/app/(portal): portal routes. Keep page.tsx thin.
- src/components/ui: domain-independent primitives used across features.
- src/components/common: domain-independent composed widgets.
- src/components/layouts: portal navigation and layout.
- _components within a domain: forms, tables, dialogs, and feature widgets.
- _lib within a domain: pure feature rules and transformations, added when needed.
- src/types: shared domain contracts.
- src/lib/mocks: deterministic fixtures, accessed through services.
- src/services: data access boundary; UI must not import fixtures directly.

Reuse an existing global component when its contract fits. Adjust it only for
a reusable concern. A component used by just one feature stays in that feature.
Do not create global feature forms, speculative repositories, or base classes.
Do not import private components across unrelated route domains.

## V560 screen mapping

| Mockup view                                | Folder under src/app/(portal)                           |
| ------------------------------------------ | ------------------------------------------------------- |
| eventView                                  | event-management                                        |
| eventCreateWizardView                      | event-management/create                                 |
| eventSetupView                             | event-management/[eventId]                              |
| event edit                                 | event-management/[eventId]/edit                         |
| addCompetitionPageView                     | event-management/[eventId]/competitions/create          |
| competitionDetailPageView                  | event-management/[eventId]/competitions/[competitionId] |
| eventRegistrationView                      | event-management/event-registration                     |
| committeeRegistrationView                  | event-management/committee-registration                 |
| sponsorshipMediaRegistrationView           | event-management/partner-registration                   |
| doorprizeDrawingView                       | event-management/doorprize-drawing                      |
| competitionView                            | competition                                             |
| competitionDrawingPageView                 | competition/[competitionId]/drawing                     |
| competitionRunMatchPageView                | competition/[competitionId]/run-match                   |
| competitionContestPageView                 | competition/[competitionId]/contest                     |
| competitionTimeTrialPageView               | competition/[competitionId]/time-trial                  |
| userManagementView / add / detail / edit   | user-management / create / [userId] / [userId]/edit     |
| petManagementView / add / detail / edit    | pet-management / create / [petId] / [petId]/edit        |
| sponsorshipBrandView / add / detail / edit | sponsorship-brand / create / [brandId] / [brandId]/edit |
| reportView                                 | report                                                  |

Competition configuration belongs to its event. Live competition operations belong
to competition. Race timers, rankings, checkpoint inputs, judging forms, and prize
drawing controls are local components, even when they share Button or PageHeading.

Event forms shared by create and edit belong to event-management/_components.
The same rule applies to user, pet, and brand forms. Registration-specific tables
and dialogs belong to the respective registration folder.

## Data

Existing users, pets, events, competitions, sponsors, and reports keep their
existing service contracts. Event operations add typed fixtures and read-only
service methods for registrations, committee, partners, and doorprizes.
Fixture IDs reference existing fixture records. Service responses are cloned so
consumers cannot accidentally mutate the module-level fixtures.

Future editable dummy workflows should own state per user session or mounted
feature. Do not mutate server module globals or introduce an API dependency
before backend integration is requested.

## Shared components

Button supports native button props, variants, and sizes. PageHeading accepts
title, optional description, and action content. Further shared widgets should
be extracted when actual screens demonstrate reuse. All existing design tokens
remain in globals.css.

The earlier V335 scaffold document is historical; this mapping describes the
V560 folder ownership. Auth and dashboard scope is not expanded by this mockup.
