# Pet Competition Portal — Scaffold & Component Library Design

**Date:** 2026-09-07
**Status:** Approved (approach + structure), pending spec review
**Scope owner:** frontend

## 1. Purpose

Turn the single-file HTML prototype (`petpet-race-controller-v335.html`) into a
maintainable Next.js codebase. This first slice delivers **only** the project
skeleton, configuration, a reusable component library, layout shell, data-layer
scaffolding, and empty route folders for every domain. No feature logic is built
here — feature pages are later, separate slices that consume what this slice
produces.

The prototype is the visual and behavioral reference for components (sortable
tables, lazy-loaded rows, filter bars, confirm/success modals, status badges,
collapsible sidebar with submenus, top navbar with account menu, toast). Visual
fidelity target is **structure with neutral defaults** — components are
functional and consistently styled (shadcn-ish), exact prototype colors are a
later theming pass.

## 2. Constraints & Existing Decisions

- **Framework:** Next.js `16.3.4` (App Router). This is a modified Next — the
  relevant guide in `node_modules/next/dist/docs/` must be read before writing
  route/layout/middleware code. `src/app/layout.tsx` already uses the typed
  `LayoutProps<"/">` global; assume `PageProps<...>` exists too.
- **React** `19.2.8`, **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme`),
  **TypeScript** strict.
- **Installed, use these:** `radix-ui` (unified package — import primitives as
  `import { Dialog } from "radix-ui"`), `class-variance-authority`, `clsx`,
  `tailwind-merge`, `lucide-react`, `sonner` (toasts).
- **Testing deps installed** (`vitest`, `@testing-library/*`, `jsdom`) but test
  files are deferred by owner decision. This slice adds only `vitest.config.ts`
  and `src/test/setup.ts` so `npm run test` is ready.
- **No new runtime dependency** is added. (Reference CMS uses `js-cookie`; we use
  a small `getCookie`/`setCookie` helper instead.)
- **Path alias:** `@/*` -> `src/*` (already configured).
- Working branch is `dev` (not `main`).

## 3. Architecture — Approach C (Hybrid)

Keep the reference CMS's familiarity (route-group-per-domain under `app/`,
colocated `_components/`, `services` / `types` / `lib` / `hooks` at `src/` root)
**but** split `components/` cleanly so primitives and composed app widgets never
mix:

- `components/ui/` — primitives: thin wrappers over Radix + `cva`. One concern
  each, no app knowledge, no data fetching.
- `components/common/` — composed app widgets built from `ui/` primitives:
  `DataTable`, `FilterBar`, `ConfirmDialog`, `ResultDialog`, `PageHeading`,
  `StatusBadge`, `FormField`, `EmptyState`, `Pagination`. Generic over data,
  still no domain knowledge.
- `components/layouts/` — the portal shell: `DefaultLayout`, `Navbar`,
  `Sidebar` (+ context, menu items, submenu, nav data).

Rejected: **A** (mirror reference exactly) mixes primitives and composites in one
`ui-elements/` bucket — the prototype has too many composite patterns for that to
stay readable. **B** (feature-first `src/features/*`) isolates well but diverges
from the team's reference and forces relearning for no gain at this stage.

## 4. Directory Layout

```
src/
  middleware.ts                     # auth gate (mock): no session cookie -> /sign-in

  app/
    layout.tsx                      # root html/body, font vars, <Providers/>
    globals.css                     # Tailwind v4 @import + @theme tokens
    not-found.tsx
    (auth)/
      layout.tsx                    # centered-card shell
      sign-in/page.tsx              # static form markup, no submit logic
      forgot-password/page.tsx
      reset-password/page.tsx
    (portal)/
      layout.tsx                    # <DefaultLayout>{children}</DefaultLayout>
      dashboard/page.tsx            # placeholder: <PageHeading> + card grid
      event-management/
        page.tsx                    # placeholder
        _components/.gitkeep
        event-registration/{page.tsx,_components/.gitkeep}
        committee-registration/{page.tsx,_components/.gitkeep}
        partner-registration/{page.tsx,_components/.gitkeep}
      competition/{page.tsx,_components/.gitkeep}
      user-management/{page.tsx,_components/.gitkeep}
      pet-management/{page.tsx,_components/.gitkeep}
      sponsorship-brand/{page.tsx,_components/.gitkeep}
      report/{page.tsx,_components/.gitkeep}

  components/
    providers.tsx                   # 'use client': <SidebarProvider> + <Toaster/>
    ui/
      button.tsx  input.tsx  textarea.tsx  select.tsx
      checkbox.tsx  radio-group.tsx  switch.tsx
      dialog.tsx  dropdown-menu.tsx  tooltip.tsx  tabs.tsx
      badge.tsx  card.tsx  table.tsx  skeleton.tsx
      index.ts                      # barrel
    common/
      page-heading.tsx
      filter-bar.tsx
      data-table.tsx
      confirm-dialog.tsx
      result-dialog.tsx
      status-badge.tsx
      form-field.tsx
      empty-state.tsx
      pagination.tsx
      index.ts
    layouts/
      default-layout.tsx
      navbar/
        index.tsx
        account-menu.tsx
      sidebar/
        index.tsx
        sidebar-context.tsx
        menu-item.tsx
        submenu.tsx
        nav-data.ts
        icons.tsx

  lib/
    utils.ts                        # cn(), getCookie(), setCookie(), removeCookie()
    api-client.ts                   # fetch wrapper, ApiError, status normalization
    constants/
      endpoints.ts                  # ENDPOINTS map (grouped by domain)
      routes.ts                     # ROUTES path constants (nav + redirects)
      status.ts                     # status enums + label/variant maps
    format/
      date.ts                       # formatDate, formatDateTime
      number.ts                     # formatCurrencyIDR, formatNumber
    mocks/
      users.ts  pets.ts  events.ts  competitions.ts  sponsors.ts

  services/
    index.ts                        # re-exports
    common.ts                       # modules/nav, shared lookups (mock)
    auth.ts                         # signIn/signOut/me (mock)
    user-management.ts
    pet-management.ts
    event-management.ts
    competition.ts
    sponsorship-brand.ts
    report.ts

  hooks/
    use-click-outside.ts
    use-mobile.ts
    use-disclosure.ts               # { isOpen, open, close, toggle }
    use-debounced-value.ts
    use-sortable-table.ts           # { sortKey, sortDir, toggleSort, sorted }
    use-lazy-list.ts                # { visible, hasMore, loadMore, sentinelRef }

  types/
    common.ts                       # ApiResponse<T>, Paginated<T>, Meta, SortDir, SelectItem
    auth.ts  user.ts  pet.ts  event.ts  competition.ts  sponsor.ts

  test/
    setup.ts                        # @testing-library/jest-dom
```

## 5. Component Library — contracts

Each primitive: named export, `forwardRef` where it wraps a DOM element,
`className` merged via `cn()`, variants via `cva`. No `"use client"` unless the
primitive needs interactivity/Radix (most Radix ones do).

| Component | Purpose | Key props / notes |
|---|---|---|
| `Button` | action | `variant`: default/secondary/outline/ghost/destructive; `size`: sm/md/icon; `asChild` via Radix Slot |
| `Input` / `Textarea` | text entry | native props + `className`, error ring via `aria-invalid` |
| `Select` | single choice | Radix Select; `options: SelectItem[]` or composable parts |
| `Checkbox` / `RadioGroup` / `Switch` | toggles | Radix primitives |
| `Dialog` | modal base | Radix Dialog; exports `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` |
| `DropdownMenu` | menus | Radix; used by account menu, row actions |
| `Tooltip`, `Tabs` | — | Radix |
| `Badge` | status/label chip | `variant`: neutral/success/warning/danger/info |
| `Card` | surface | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` |
| `Table` | styled table parts | `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` — styling only |
| `Skeleton` | loading block | `className` sized by caller |

| Composite (`common/`) | Purpose | Contract |
|---|---|---|
| `PageHeading` | page title row | `{ title, description?, actions? }` |
| `FilterBar` | filter controls container | `{ children, onClear? }`; children are `FormField`-wrapped controls |
| `DataTable<T>` | generic list table | `{ columns: Column<T>[], rows: T[], sort?, onSortChange?, lazy?, renderEmpty? }`. `Column<T>` = `{ key, header, sortable?, cell?(row): ReactNode, className? }`. Uses `use-sortable-table` when `sort` uncontrolled, `use-lazy-list` when `lazy`. |
| `ConfirmDialog` | destructive confirm | `{ open, onOpenChange, title, message, confirmLabel?, tone?: 'danger'|'default', onConfirm }` |
| `ResultDialog` | success/error result | `{ open, onOpenChange, tone: 'success'|'error', title, message, actionLabel?, onAction? }` |
| `StatusBadge` | map status -> Badge | `{ status: string, map?: Record<string,BadgeVariant> }`; defaults from `lib/constants/status.ts` |
| `FormField` | label + control + error | `{ label, htmlFor?, required?, error?, hint?, children }` |
| `EmptyState` | no-data placeholder | `{ icon?, title, description?, action? }` |
| `Pagination` | page controls | `{ page, pageCount, onPageChange }` |

## 6. Layout shell

- `providers.tsx` (`"use client"`): wraps `SidebarProvider` and mounts
  `<Toaster />` from `sonner`. Rendered in root `app/layout.tsx`.
- `sidebar-context.tsx`: adapted from reference — `state`, `isOpen`, `setIsOpen`,
  `isMobile`, `toggleSidebar`; collapses on mobile via `use-mobile`.
- `Sidebar`: renders `nav-data.ts` tree. Supports one nesting level (submenu),
  matching prototype's Event Management group. Active state from `usePathname()`.
  Collapsed mode shows icons only.
- `nav-data.ts`: typed tree `{ title, href?, icon, items?: NavItem[] }[]`. Hrefs
  come from `lib/constants/routes.ts`.
- `Navbar`: brand, event pill (static), `AccountMenu` (Radix DropdownMenu:
  Settings / Logout — Logout calls `authService.signOut()` mock then routes to
  `/sign-in`). Mobile sidebar toggle button.
- `DefaultLayout`: fixed navbar + fixed sidebar + `content-shell` with left
  margin bound to sidebar state; `(portal)/layout.tsx` renders it.

## 7. Data layer

- `lib/api-client.ts`: port the reference wrapper. Token read via
  `getCookie('session')` (helper in `lib/utils.ts`, no `js-cookie` dep).
  `BASE_URL` from `process.env.NEXT_PUBLIC_API_BASE_URL`. Same `ApiError` class
  and per-status normalization. On 401 with token: `removeCookie('session')` +
  `window.location.href = '/sign-in'`.
- `lib/constants/endpoints.ts`: `ENDPOINTS` grouped by domain
  (`auth`, `users`, `pets`, `events`, `competitions`, `sponsors`, `reports`).
- `services/*`: one module per domain. **Each function currently returns mock
  data** from `lib/mocks/*` wrapped in the real return type (`ApiResponse<T>` /
  `Paginated<T>`), with a `// TODO: swap to apiClient.get(ENDPOINTS.x)` line and
  the real call written but commented. Async (`Promise.resolve(...)`) so callers
  are already await-shaped.
- `lib/mocks/*`: small typed fixture arrays (5–15 rows) per domain, shapes from
  `types/*`. Derived from prototype's inline seed data where practical.
- `types/*`: entity interfaces + `types/common.ts` with
  `ApiResponse<T> = { success: boolean; message: string; data: T }`,
  `Paginated<T> = ApiResponse<{ items: T[]; meta: Meta }>`,
  `SortDir = 'asc' | 'desc'`, `Meta`, `SelectItem`.

## 8. Hooks

Small, single-purpose, `"use client"`:

- `use-click-outside(ref, handler)` — port from reference.
- `use-mobile()` — `matchMedia` breakpoint boolean; port from reference.
- `use-disclosure(initial?)` — `{ isOpen, open, close, toggle, setOpen }`.
- `use-debounced-value(value, delayMs)` — for filter inputs.
- `use-sortable-table<T>(rows, { key?, dir? })` — `{ sortKey, sortDir, toggleSort(key), sorted }`.
- `use-lazy-list<T>(rows, step=10)` — `{ visible, hasMore, loadMore, sentinelRef }`;
  `IntersectionObserver` on `sentinelRef` calls `loadMore` (mirrors prototype's
  scroll-to-load-10-more behavior).

## 9. Config changes

- `src/app/globals.css`: replace CNA boilerplate with Tailwind v4 `@theme`
  tokens — `--color-primary`, `--color-primary-foreground`, `--color-muted`,
  `--color-muted-foreground`, `--color-border`, `--color-ring`,
  `--color-danger`, `--color-success`, `--color-warning`, `--radius`. Neutral
  palette (slate/indigo family), light-first. Base `body` bg/fg from tokens.
- `src/app/layout.tsx`: keep font setup, set real `metadata`
  (`title: "Pet Competition Portal"`), render `<Providers>` around `children`.
- `.prettierrc` (new): `{ "plugins": ["prettier-plugin-tailwindcss"] }`.
- `vitest.config.ts` (new): jsdom env, `vite-tsconfig-paths`, `@vitejs/plugin-react`,
  `setupFiles: ["src/test/setup.ts"]`.
- `src/test/setup.ts` (new): `import "@testing-library/jest-dom"`.
- `package.json` scripts: add
  `"typecheck": "tsc --noEmit"`, `"test": "vitest"`, `"format": "prettier --write ."`.
- `.env.example` (new): `NEXT_PUBLIC_API_BASE_URL=`.
- `next.config.ts`: unchanged unless docs require typed-routes opt-in.
- `middleware.ts`: matcher excludes `/_next`, static, `/sign-in` and the other
  `(auth)` paths; if no `session` cookie -> redirect to `/sign-in`. Mock only.

## 10. Non-goals (explicit)

- No feature CRUD, no real forms with submission, no charts, no race-timer logic,
  no drawing/leaderboard logic.
- No real authentication, no real API integration.
- No test files (config only).
- No exact prototype color match / dark mode implementation (tokens are laid out
  so it can be added later).
- No i18n.

## 11. Verification

1. `npm run typecheck` — clean.
2. `npm run lint` — clean.
3. `npm run build` — succeeds.
4. `npm run dev` — `/` redirects/loads dashboard placeholder; every sidebar link
   navigates to its placeholder page; sidebar collapse + mobile toggle work;
   account menu opens; a smoke render of `ConfirmDialog` / `DataTable` on the
   dashboard placeholder (temporary) shows they mount, then removed.
5. `git status` clean except intended files; the Next agent-rules block in
   `AGENTS.md` committed as-is if `next dev` re-adds it.

## 12. Open questions

None blocking. Prototype color extraction and per-domain feature slices are
tracked as follow-up work, not part of this spec.
