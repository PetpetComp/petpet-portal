# Pet Competition Portal — Scaffold & Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js project skeleton, config, reusable component library, layout shell, mock-backed data layer, and empty domain route folders for the Pet Competition Portal.

**Architecture:** App Router with a route group per area (`(auth)`, `(portal)`), colocated `_components/` per domain, and `services` / `types` / `lib` / `hooks` at `src/` root (mirrors the team's reference CMS). `components/` is split three ways: `ui/` primitives (Radix + `cva`), `common/` composed generic widgets, `layouts/` the portal shell. All `services/*` return mock data now, shaped in real API return types, with the real `apiClient` call written and commented out.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2.8, TypeScript (strict), Tailwind CSS v4, `radix-ui` (unified package), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`. Vitest + Testing Library are configured but **no test files are written in this plan** (owner decision).

**Spec:** `docs/superpowers/specs/2026-09-07-portal-scaffold-and-component-library-design.md`

## Global Constraints

- Next.js **16.3.4** — this is a modified Next. `middleware.js` is **deprecated and renamed to `proxy.js`**; use `src/proxy.ts` with an exported `proxy` function. Route props use the global helpers `PageProps<'/path'>` / `LayoutProps<'/path'>` (no import); for route-group layouts that do not map to a single URL path, type props as `{ children: React.ReactNode }`.
- React **19.2.8**, TypeScript **strict**, path alias `@/*` -> `src/*` (already set — do not change).
- Tailwind CSS **v4**: `src/app/globals.css` uses `@import "tailwindcss";` + `@theme { ... }`. No `tailwind.config.js`. PostCSS already configured (`@tailwindcss/postcss`).
- `radix-ui` unified import style: `import { Dialog, DropdownMenu, Select } from "radix-ui";` then namespace usage `<Dialog.Root>`, `<Dialog.Portal>`, etc.
- **No new runtime dependency.** Cookie access uses local helpers in `lib/utils.ts`, not `js-cookie`.
- Env var for API base: `NEXT_PUBLIC_API_BASE_URL`.
- Component conventions: named exports; `forwardRef` when wrapping a DOM element; merge `className` via `cn()`; variants via `cva`; add `"use client"` only when the file uses hooks, state, effects, or Radix client primitives.
- Every task ends by running the stated verification command(s) and committing. Commit messages: Conventional Commits, present tense. End every commit message body with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Working branch is `dev`. Do not touch `main`. If `next dev` re-adds the agent-rules block to `AGENTS.md`, commit it with the current task rather than reverting.

---

## Task 1: Tooling & config

**Files:**

- Modify: `package.json` (scripts block)
- Create: `.prettierrc`
- Create: `vitest.config.mts`
- Create: `src/test/setup.ts`
- Create: `.env.example`
- Create: `.env.local`

**Interfaces:**

- Consumes: nothing.
- Produces: npm scripts `typecheck`, `test`, `format`; a working `vitest` config; `NEXT_PUBLIC_API_BASE_URL` available at runtime.

- [ ] **Step 1: Add npm scripts**

In `package.json`, replace the `"scripts"` object with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "format": "prettier --write ."
  },
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

- [ ] **Step 3: Create `vitest.config.mts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create `.env.example`**

```
# Base URL of the Pet Competition backend API
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

- [ ] **Step 6: Create `.env.local`**

```
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run format`
Expected: `typecheck` passes (still the CNA files), `lint` passes, `format` rewrites files and exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json .prettierrc vitest.config.mts src/test/setup.ts .env.example
git commit -m "chore: add typecheck/test/format scripts, prettier, vitest config"
```

(`.env.local` is gitignored — do not add it.)

---

## Task 2: Design tokens, root layout, providers, utils

**Files:**

- Modify: `src/app/globals.css` (full replace)
- Modify: `src/app/layout.tsx` (full replace)
- Create: `src/components/providers.tsx`
- Create: `src/lib/utils.ts`
- Create: `src/app/not-found.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `cn(...inputs: ClassValue[]): string`
  - `getCookie(name: string): string | undefined`
  - `setCookie(name: string, value: string, days?: number): void`
  - `removeCookie(name: string): void`
  - `<Providers>{children}</Providers>` client component (mounts `SidebarProvider` + sonner `<Toaster />`)
  - CSS custom properties / Tailwind theme colors: `primary`, `primary-foreground`, `background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `danger`, `danger-foreground`, `success`, `warning`, plus `--radius`.

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-background: #f6f8fb;
  --color-foreground: #1f2937;

  --color-card: #ffffff;
  --color-card-foreground: #1f2937;

  --color-muted: #f0f4f8;
  --color-muted-foreground: #667085;

  --color-border: #e4e8ef;
  --color-input: #d0d5dd;
  --color-ring: #7f75ff;

  --color-primary: #5f5be8;
  --color-primary-foreground: #ffffff;

  --color-danger: #d84d4d;
  --color-danger-foreground: #ffffff;

  --color-success: #1f9d6e;
  --color-warning: #d99614;

  --radius: 0.625rem;

  --font-sans:
    var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
}

body {
  margin: 0;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)",
    ),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function removeCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
```

- [ ] **Step 3: Create `src/components/providers.tsx`**

```tsx
"use client";

import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/layouts/sidebar/sidebar-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {children}
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
```

> Note: `sidebar-context` is created in Task 8. This file will fail typecheck until then. Do NOT run typecheck as the Task 2 gate — use `build` after Task 8, or temporarily stub. To keep Task 2 independently verifiable, create the stub now:

- [ ] **Step 4: Create stub `src/components/layouts/sidebar/sidebar-context.tsx`**

```tsx
"use client";

import { createContext, useContext, useState } from "react";

type SidebarContextValue = {
  isOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  setIsOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx)
    throw new Error("useSidebarContext must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isMobile: false,
        setIsOpen,
        toggleSidebar: () => setIsOpen((v) => !v),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
```

(Task 8 replaces this file with the mobile-aware version.)

- [ ] **Step 5: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pet Competition Portal",
  description: "Operations portal for pet competition events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create `src/app/not-found.tsx`**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm font-semibold tracking-wide">
        404
      </p>
      <h1 className="text-foreground text-xl font-bold">Page not found</h1>
      <Link href="/" className="text-primary text-sm font-medium underline">
        Back to dashboard
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: Delete `src/app/page.tsx`**

The CNA landing page is replaced by the portal dashboard in Task 10. Remove it:

```bash
git rm src/app/page.tsx
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck`
Expected: PASS (the sidebar-context stub satisfies `providers.tsx`).
Run: `npm run build`
Expected: FAIL — `src/app` now has no `page.tsx` for `/`. This is expected; `/` is added in Task 10. Confirm the failure is ONLY the missing root page, nothing else.

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/not-found.tsx src/components/providers.tsx src/components/layouts/sidebar/sidebar-context.tsx
git add -u src/app/page.tsx
git commit -m "feat: add design tokens, root layout, providers, cn/cookie utils"
```

---

## Task 3: Types & constants

**Files:**

- Create: `src/types/common.ts`
- Create: `src/types/auth.ts`
- Create: `src/types/user.ts`
- Create: `src/types/pet.ts`
- Create: `src/types/event.ts`
- Create: `src/types/competition.ts`
- Create: `src/types/sponsor.ts`
- Create: `src/lib/constants/routes.ts`
- Create: `src/lib/constants/endpoints.ts`
- Create: `src/lib/constants/status.ts`

**Interfaces:**

- Produces:
  - `ApiResponse<T> = { success: boolean; message: string; data: T }`
  - `Paginated<T> = ApiResponse<{ items: T[]; meta: Meta }>`
  - `Meta`, `SortDir = "asc" | "desc"`, `SelectItem = { value: string; label: string }`
  - Entity interfaces: `User`, `Pet`, `EventItem`, `Competition`, `SponsorBrand`, `AuthUser`, `SignInPayload`
  - `ROUTES` — nested const object of path strings
  - `ENDPOINTS` — nested const object of path strings
  - `STATUS_BADGE_MAP: Record<string, BadgeVariant>` and enums `EventStatus`, `PaymentStatus`

- [ ] **Step 1: Create `src/types/common.ts`**

```ts
export type SortDir = "asc" | "desc";

export type SelectItem = { value: string; label: string };

export interface Meta {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type Paginated<T> = ApiResponse<{ items: T[]; meta: Meta }>;

export interface AuditFields {
  createdDate: string;
  createdBy: string;
  updatedDate: string;
  updatedBy: string;
}
```

- [ ] **Step 2: Create `src/types/auth.ts`**

```ts
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
}

export interface SignInPayload {
  username: string;
  password: string;
}

export interface Session {
  token: string;
  user: AuthUser;
}
```

- [ ] **Step 3: Create `src/types/user.ts`**

```ts
import type { AuditFields } from "@/types/common";

export type Gender = "Male" | "Female";

export interface User extends AuditFields {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender | "";
  dob: string;
  address: string;
  city: string;
  province: string;
  nation: string;
}
```

- [ ] **Step 4: Create `src/types/pet.ts`**

```ts
import type { AuditFields, Gender } from "@/types/common";
import type { Gender as _Gender } from "@/types/user";

export interface Pet extends AuditFields {
  id: string;
  name: string;
  animal: string;
  variant: string;
  ownerUserId: string;
  ownerName: string;
  gender: _Gender | "";
  dob: string;
  heightLength: string;
  weight: string;
}
```

> `AuditFields` is imported from `common`; `Gender` re-uses the `user` definition. Remove the unused `Gender` import from `common` if the linter flags it — `common.ts` does not export `Gender`, so import only `AuditFields`:

```ts
import type { AuditFields } from "@/types/common";
import type { Gender } from "@/types/user";

export interface Pet extends AuditFields {
  id: string;
  name: string;
  animal: string;
  variant: string;
  ownerUserId: string;
  ownerName: string;
  gender: Gender | "";
  dob: string;
  heightLength: string;
  weight: string;
}
```

Use this second version.

- [ ] **Step 5: Create `src/types/event.ts`**

```ts
import type { AuditFields } from "@/types/common";

export type EventStatus = "Pending" | "Open" | "Closed";

export interface EventItem extends AuditFields {
  id: string;
  name: string;
  photo: string;
  startDate: string;
  endDate: string;
  address: string;
  location: string;
  locationUrl?: string;
  organizer: string;
  organizerLogo: string;
  status: EventStatus;
}
```

- [ ] **Step 6: Create `src/types/competition.ts`**

```ts
import type { AuditFields } from "@/types/common";

export type CompetitionType =
  "Race" | "Checkpoint Race" | "Contest" | "Time Trial";

export type PaymentStatus = "Pending" | "Paid" | "Verified";

export interface Competition extends AuditFields {
  id: string;
  eventId: string;
  name: string;
  type: CompetitionType;
  animal: string;
  earlyBirdPrice: number;
  onlinePrice: number;
  otsPrice: number;
  earlyBirdOpen: string;
  earlyBirdClose: string;
  onlineOpen: string;
  onlineClose: string;
  otsOpen: string;
  otsClose: string;
}
```

- [ ] **Step 7: Create `src/types/sponsor.ts`**

```ts
import type { AuditFields } from "@/types/common";

export type SponsorCategory =
  "Platinum" | "Gold" | "Silver" | "Bronze" | "Media Partner";

export interface SponsorAssignment {
  id: string;
  eventId: string;
  category: SponsorCategory;
}

export interface SponsorBrand extends AuditFields {
  id: string;
  name: string;
  logo: string;
  phone: string;
  campaign: string;
  instagramId: string;
  tiktokId: string;
  facebookId: string;
  youtubeId: string;
  threadsId: string;
  xId: string;
  picUserIds: string[];
  assignments: SponsorAssignment[];
}
```

- [ ] **Step 8: Create `src/lib/constants/routes.ts`**

```ts
export const ROUTES = {
  home: "/",
  auth: {
    signIn: "/sign-in",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
  },
  dashboard: "/dashboard",
  eventManagement: {
    root: "/event-management",
    eventRegistration: "/event-management/event-registration",
    committeeRegistration: "/event-management/committee-registration",
    partnerRegistration: "/event-management/partner-registration",
  },
  competition: "/competition",
  userManagement: "/user-management",
  petManagement: "/pet-management",
  sponsorshipBrand: "/sponsorship-brand",
  report: "/report",
} as const;
```

- [ ] **Step 9: Create `src/lib/constants/endpoints.ts`**

```ts
export const ENDPOINTS = {
  auth: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    me: "/auth/me",
  },
  users: {
    list: "/users",
    detail: (id: string) => `/users/${id}`,
  },
  pets: {
    list: "/pets",
    detail: (id: string) => `/pets/${id}`,
  },
  events: {
    list: "/events",
    detail: (id: string) => `/events/${id}`,
    competitions: (eventId: string) => `/events/${eventId}/competitions`,
  },
  competitions: {
    detail: (id: string) => `/competitions/${id}`,
  },
  sponsors: {
    list: "/sponsorship-brands",
    detail: (id: string) => `/sponsorship-brands/${id}`,
  },
  reports: {
    summary: "/reports/summary",
  },
} as const;
```

- [ ] **Step 10: Create `src/lib/constants/status.ts`**

```ts
export type BadgeVariant =
  "neutral" | "success" | "warning" | "danger" | "info";

export const STATUS_BADGE_MAP: Record<string, BadgeVariant> = {
  Pending: "warning",
  Open: "success",
  Closed: "danger",
  Paid: "info",
  Verified: "success",
  Active: "success",
  Inactive: "danger",
};

export function statusToBadgeVariant(status: string): BadgeVariant {
  return STATUS_BADGE_MAP[status] ?? "neutral";
}
```

- [ ] **Step 11: Verify**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/types src/lib/constants
git commit -m "feat: add domain types, route/endpoint/status constants"
```

---

## Task 4: API client, formatters, mocks, services

**Files:**

- Create: `src/lib/api-client.ts`
- Create: `src/lib/format/date.ts`
- Create: `src/lib/format/number.ts`
- Create: `src/lib/mocks/users.ts`
- Create: `src/lib/mocks/pets.ts`
- Create: `src/lib/mocks/events.ts`
- Create: `src/lib/mocks/competitions.ts`
- Create: `src/lib/mocks/sponsors.ts`
- Create: `src/services/index.ts`
- Create: `src/services/common.ts`
- Create: `src/services/auth.ts`
- Create: `src/services/user-management.ts`
- Create: `src/services/pet-management.ts`
- Create: `src/services/event-management.ts`
- Create: `src/services/competition.ts`
- Create: `src/services/sponsorship-brand.ts`
- Create: `src/services/report.ts`

**Interfaces:**

- Consumes: `ApiResponse`, `Paginated`, `Meta` (Task 3); all entity types (Task 3); `getCookie`, `removeCookie` (Task 2); `ENDPOINTS` (Task 3).
- Produces:
  - `apiClient.get/post/put/patch/delete<T>(endpoint, ...)` and `ApiError`
  - `formatDate(iso): string`, `formatDateTime(iso): string`
  - `formatCurrencyIDR(n): string`, `formatNumber(n): string`
  - `mockUsers: User[]`, `mockPets: Pet[]`, `mockEvents: EventItem[]`, `mockCompetitions: Competition[]`, `mockSponsors: SponsorBrand[]`
  - Service objects, each async, e.g. `userService.list(): Promise<Paginated<User>>`, `userService.detail(id): Promise<ApiResponse<User>>`, `authService.signIn(payload): Promise<ApiResponse<Session>>`, `authService.signOut(): Promise<void>`

- [ ] **Step 1: Create `src/lib/api-client.ts`**

```ts
import { getCookie, removeCookie } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const TOKEN_COOKIE = "session";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown> | FormData;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getCookie(TOKEN_COOKIE);
  const isForm = options.body instanceof FormData;

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      body: isForm
        ? (options.body as FormData)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error. Please check your connection.");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const message = typeof data.message === "string" ? data.message : undefined;

  if (res.status === 401) {
    if (token && typeof window !== "undefined") {
      removeCookie(TOKEN_COOKIE);
      window.location.href = "/sign-in";
    }
    throw new ApiError(
      401,
      message ?? "Session expired. Please sign in again.",
    );
  }

  if (res.status === 422) {
    const errors = data.errors as Record<string, string[]> | undefined;
    const detail = errors ? Object.values(errors).flat().join(" ") : undefined;
    throw new ApiError(422, detail ?? message ?? "Validation failed.", errors);
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      message ?? `Request failed (${res.status}).`,
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, "body">) =>
    request<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, "body">) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
```

- [ ] **Step 2: Create `src/lib/format/date.ts`**

```ts
const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : DATE_FMT.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : DATE_TIME_FMT.format(d);
}
```

- [ ] **Step 3: Create `src/lib/format/number.ts`**

```ts
const IDR_FMT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const NUM_FMT = new Intl.NumberFormat("en-US");

export function formatCurrencyIDR(value: number | null | undefined): string {
  return IDR_FMT.format(Number(value ?? 0));
}

export function formatNumber(value: number | null | undefined): string {
  return NUM_FMT.format(Number(value ?? 0));
}
```

- [ ] **Step 4: Create `src/lib/mocks/users.ts`**

```ts
import type { User } from "@/types/user";

const audit = {
  createdDate: "2026-01-12T09:15:00Z",
  createdBy: "system",
  updatedDate: "2026-08-20T14:30:00Z",
  updatedBy: "admin.petpet",
};

export const mockUsers: User[] = [
  {
    id: "USR-2026-0001",
    username: "andi.pratama",
    firstName: "Andi",
    lastName: "Pratama",
    email: "andi.pratama@example.com",
    phone: "081234567801",
    gender: "Male",
    dob: "1995-04-12",
    address: "Jl. Kemang Raya No. 18",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
    nation: "Indonesia",
    ...audit,
  },
  {
    id: "USR-2026-0002",
    username: "salsa.putri",
    firstName: "Salsa",
    lastName: "Putri",
    email: "salsa.putri@example.com",
    phone: "081234567802",
    gender: "Female",
    dob: "1997-09-21",
    address: "Jl. Dharmahusada Indah No. 9",
    city: "Surabaya",
    province: "Jawa Timur",
    nation: "Indonesia",
    ...audit,
  },
  {
    id: "USR-2026-0003",
    username: "bima.setiawan",
    firstName: "Bima",
    lastName: "Setiawan",
    email: "bima.setiawan@example.com",
    phone: "081234567803",
    gender: "Male",
    dob: "1994-02-18",
    address: "Jl. Setiabudi No. 117",
    city: "Bandung",
    province: "Jawa Barat",
    nation: "Indonesia",
    ...audit,
  },
];
```

- [ ] **Step 5: Create `src/lib/mocks/pets.ts`**

```ts
import type { Pet } from "@/types/pet";

const audit = {
  createdDate: "2026-03-14T10:15:00Z",
  createdBy: "andi.pratama",
  updatedDate: "2026-09-01T11:30:00Z",
  updatedBy: "admin.petpet",
};

export const mockPets: Pet[] = [
  {
    id: "PET-00127",
    name: "Mochi",
    animal: "Dog",
    variant: "Pomeranian",
    ownerUserId: "USR-2026-0001",
    ownerName: "Andi Pratama",
    gender: "Male",
    dob: "2023-04-18",
    heightLength: "28 cm",
    weight: "4.2 kg",
    ...audit,
  },
  {
    id: "PET-00132",
    name: "Bruno",
    animal: "Dog",
    variant: "Golden Retriever",
    ownerUserId: "USR-2026-0002",
    ownerName: "Salsa Putri",
    gender: "Male",
    dob: "2022-05-24",
    heightLength: "58 cm",
    weight: "29.4 kg",
    ...audit,
  },
  {
    id: "PET-00300",
    name: "Gizmo 001",
    animal: "Sugar Glider",
    variant: "Classic Grey",
    ownerUserId: "USR-2026-0003",
    ownerName: "Bima Setiawan",
    gender: "Female",
    dob: "2024-02-11",
    heightLength: "24 cm",
    weight: "0.115 kg",
    ...audit,
  },
];
```

- [ ] **Step 6: Create `src/lib/mocks/events.ts`**

```ts
import type { EventItem } from "@/types/event";

const audit = {
  createdDate: "2026-07-15T09:30:00Z",
  createdBy: "Admin Petpet",
  updatedDate: "2026-08-30T14:20:00Z",
  updatedBy: "Lifta Annisa",
};

export const mockEvents: EventItem[] = [
  {
    id: "EVT-2026-0001",
    name: "Jakarta Pet Festival 2026",
    photo: "",
    startDate: "2026-09-05T08:00:00+07:00",
    endDate: "2026-09-06T18:00:00+07:00",
    address: "JIExpo Kemayoran, Jl. Benyamin Suaeb",
    location: "Jakarta",
    organizer: "Petpet Competition Club",
    organizerLogo: "PPC",
    status: "Pending",
    ...audit,
  },
  {
    id: "EVT-2026-0002",
    name: "Surabaya Paw Race 2026",
    photo: "",
    startDate: "2026-09-04T10:00:00+07:00",
    endDate: "2026-09-04T20:00:00+07:00",
    address: "Grand City Convex, Jl. Walikota Mustajab",
    location: "Surabaya",
    organizer: "East Java Pet Sport",
    organizerLogo: "EJP",
    status: "Open",
    ...audit,
  },
  {
    id: "EVT-2026-0003",
    name: "Bandung Happy Paws Championship",
    photo: "",
    startDate: "2026-08-20T08:00:00+07:00",
    endDate: "2026-08-21T17:00:00+07:00",
    address: "Bandung Convention Centre",
    location: "Bandung",
    organizer: "Happy Paws Indonesia",
    organizerLogo: "HPI",
    status: "Closed",
    ...audit,
  },
];
```

- [ ] **Step 7: Create `src/lib/mocks/competitions.ts`**

```ts
import type { Competition } from "@/types/competition";

const audit = {
  createdDate: "2026-06-10T09:15:00Z",
  createdBy: "Nadia Putri",
  updatedDate: "2026-08-15T13:20:00Z",
  updatedBy: "Nadia Putri",
};

export const mockCompetitions: Competition[] = [
  {
    id: "CMP-2026-0001",
    eventId: "EVT-2026-0001",
    name: "Small Dog Sprint",
    type: "Race",
    animal: "Dog",
    earlyBirdPrice: 75000,
    onlinePrice: 90000,
    otsPrice: 105000,
    earlyBirdOpen: "2026-07-01T08:00:00+07:00",
    earlyBirdClose: "2026-07-15T23:59:00+07:00",
    onlineOpen: "2026-07-16T00:00:00+07:00",
    onlineClose: "2026-08-31T23:59:00+07:00",
    otsOpen: "2026-09-05T06:00:00+07:00",
    otsClose: "2026-09-05T08:00:00+07:00",
    ...audit,
  },
  {
    id: "CMP-2026-0002",
    eventId: "EVT-2026-0001",
    name: "Best Costume Contest",
    type: "Contest",
    animal: "Dog",
    earlyBirdPrice: 50000,
    onlinePrice: 65000,
    otsPrice: 80000,
    earlyBirdOpen: "2026-07-01T08:00:00+07:00",
    earlyBirdClose: "2026-07-20T23:59:00+07:00",
    onlineOpen: "2026-07-21T00:00:00+07:00",
    onlineClose: "2026-09-01T20:00:00+07:00",
    otsOpen: "2026-09-05T07:00:00+07:00",
    otsClose: "2026-09-05T10:00:00+07:00",
    ...audit,
  },
];
```

- [ ] **Step 8: Create `src/lib/mocks/sponsors.ts`**

```ts
import type { SponsorBrand } from "@/types/sponsor";

const audit = {
  createdDate: "2026-02-03T09:15:00Z",
  createdBy: "partnership.team",
  updatedDate: "2026-09-01T13:30:00Z",
  updatedBy: "admin.petpet",
};

export const mockSponsors: SponsorBrand[] = [
  {
    id: "BRD-2026-0001",
    name: "PawFuel",
    logo: "",
    phone: "081270000001",
    campaign: "Power Every Paw",
    instagramId: "@pawfuel",
    tiktokId: "@pawfuel",
    facebookId: "PawFuel",
    youtubeId: "@pawfuel",
    threadsId: "@pawfuel",
    xId: "@pawfuel",
    picUserIds: ["USR-2026-0001"],
    assignments: [
      { id: "ASN-0001-01", eventId: "EVT-2026-0001", category: "Platinum" },
    ],
    ...audit,
  },
  {
    id: "BRD-2026-0002",
    name: "Happy Tail Nutrition",
    logo: "",
    phone: "081270000002",
    campaign: "Healthy Pets Happy Families",
    instagramId: "@happytail",
    tiktokId: "@happytail",
    facebookId: "Happy Tail Nutrition",
    youtubeId: "@happytail",
    threadsId: "@happytail",
    xId: "@happytail",
    picUserIds: ["USR-2026-0002"],
    assignments: [
      { id: "ASN-0002-01", eventId: "EVT-2026-0002", category: "Gold" },
    ],
    ...audit,
  },
];
```

- [ ] **Step 9: Create `src/services/common.ts`**

```ts
import type { Meta, Paginated, ApiResponse } from "@/types/common";

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function paginate<T>(items: T[]): Paginated<T> {
  const meta: Meta = {
    currentPage: 1,
    perPage: items.length,
    total: items.length,
    lastPage: 1,
  };
  return { success: true, message: "OK", data: { items, meta } };
}

export function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
```

- [ ] **Step 10: Create `src/services/auth.ts`**

```ts
import type { ApiResponse } from "@/types/common";
import type { Session, SignInPayload } from "@/types/auth";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { delay, ok } from "@/services/common";

const MOCK_SESSION: Session = {
  token: "mock-token",
  user: {
    id: "USR-2026-0001",
    username: "lifta",
    name: "Lifta Annisa",
    email: "lifta@example.com",
    role: "Race PIC",
  },
};

export const authService = {
  signIn: (_payload: SignInPayload): Promise<ApiResponse<Session>> =>
    // return apiClient.post<ApiResponse<Session>>(ENDPOINTS.auth.signIn, { ..._payload });
    delay(ok(MOCK_SESSION, "Signed in")),

  signOut: (): Promise<void> =>
    // return apiClient.post<void>(ENDPOINTS.auth.signOut);
    delay(undefined),

  me: (): Promise<ApiResponse<Session["user"]>> =>
    // return apiClient.get<ApiResponse<Session["user"]>>(ENDPOINTS.auth.me);
    delay(ok(MOCK_SESSION.user)),
};
```

- [ ] **Step 11: Create `src/services/user-management.ts`**

```ts
import type { ApiResponse, Paginated } from "@/types/common";
import type { User } from "@/types/user";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockUsers } from "@/lib/mocks/users";
import { delay, ok, paginate } from "@/services/common";

export const userService = {
  list: (): Promise<Paginated<User>> =>
    // return apiClient.get<Paginated<User>>(ENDPOINTS.users.list);
    delay(paginate(mockUsers)),

  detail: (id: string): Promise<ApiResponse<User>> => {
    // return apiClient.get<ApiResponse<User>>(ENDPOINTS.users.detail(id));
    const user = mockUsers.find((u) => u.id === id) ?? mockUsers[0];
    return delay(ok(user));
  },
};
```

- [ ] **Step 12: Create `src/services/pet-management.ts`**

```ts
import type { ApiResponse, Paginated } from "@/types/common";
import type { Pet } from "@/types/pet";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockPets } from "@/lib/mocks/pets";
import { delay, ok, paginate } from "@/services/common";

export const petService = {
  list: (): Promise<Paginated<Pet>> =>
    // return apiClient.get<Paginated<Pet>>(ENDPOINTS.pets.list);
    delay(paginate(mockPets)),

  detail: (id: string): Promise<ApiResponse<Pet>> => {
    // return apiClient.get<ApiResponse<Pet>>(ENDPOINTS.pets.detail(id));
    const pet = mockPets.find((p) => p.id === id) ?? mockPets[0];
    return delay(ok(pet));
  },
};
```

- [ ] **Step 13: Create `src/services/event-management.ts`**

```ts
import type { ApiResponse, Paginated } from "@/types/common";
import type { EventItem } from "@/types/event";
import type { Competition } from "@/types/competition";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockEvents } from "@/lib/mocks/events";
import { mockCompetitions } from "@/lib/mocks/competitions";
import { delay, ok, paginate } from "@/services/common";

export const eventService = {
  list: (): Promise<Paginated<EventItem>> =>
    // return apiClient.get<Paginated<EventItem>>(ENDPOINTS.events.list);
    delay(paginate(mockEvents)),

  detail: (id: string): Promise<ApiResponse<EventItem>> => {
    // return apiClient.get<ApiResponse<EventItem>>(ENDPOINTS.events.detail(id));
    const event = mockEvents.find((e) => e.id === id) ?? mockEvents[0];
    return delay(ok(event));
  },

  competitions: (eventId: string): Promise<Paginated<Competition>> => {
    // return apiClient.get<Paginated<Competition>>(ENDPOINTS.events.competitions(eventId));
    return delay(
      paginate(mockCompetitions.filter((c) => c.eventId === eventId)),
    );
  },
};
```

- [ ] **Step 14: Create `src/services/competition.ts`**

```ts
import type { ApiResponse } from "@/types/common";
import type { Competition } from "@/types/competition";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockCompetitions } from "@/lib/mocks/competitions";
import { delay, ok } from "@/services/common";

export const competitionService = {
  detail: (id: string): Promise<ApiResponse<Competition>> => {
    // return apiClient.get<ApiResponse<Competition>>(ENDPOINTS.competitions.detail(id));
    const item =
      mockCompetitions.find((c) => c.id === id) ?? mockCompetitions[0];
    return delay(ok(item));
  },
};
```

- [ ] **Step 15: Create `src/services/sponsorship-brand.ts`**

```ts
import type { ApiResponse, Paginated } from "@/types/common";
import type { SponsorBrand } from "@/types/sponsor";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockSponsors } from "@/lib/mocks/sponsors";
import { delay, ok, paginate } from "@/services/common";

export const sponsorService = {
  list: (): Promise<Paginated<SponsorBrand>> =>
    // return apiClient.get<Paginated<SponsorBrand>>(ENDPOINTS.sponsors.list);
    delay(paginate(mockSponsors)),

  detail: (id: string): Promise<ApiResponse<SponsorBrand>> => {
    // return apiClient.get<ApiResponse<SponsorBrand>>(ENDPOINTS.sponsors.detail(id));
    const brand = mockSponsors.find((b) => b.id === id) ?? mockSponsors[0];
    return delay(ok(brand));
  },
};
```

- [ ] **Step 16: Create `src/services/report.ts`**

```ts
import type { ApiResponse } from "@/types/common";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockEvents } from "@/lib/mocks/events";
import { mockUsers } from "@/lib/mocks/users";
import { mockPets } from "@/lib/mocks/pets";
import { delay, ok } from "@/services/common";

export interface ReportSummary {
  totalEvents: number;
  totalUsers: number;
  totalPets: number;
}

export const reportService = {
  summary: (): Promise<ApiResponse<ReportSummary>> =>
    // return apiClient.get<ApiResponse<ReportSummary>>(ENDPOINTS.reports.summary);
    delay(
      ok({
        totalEvents: mockEvents.length,
        totalUsers: mockUsers.length,
        totalPets: mockPets.length,
      }),
    ),
};
```

- [ ] **Step 17: Create `src/services/index.ts`**

```ts
export * from "./common";
export * from "./auth";
export * from "./user-management";
export * from "./pet-management";
export * from "./event-management";
export * from "./competition";
export * from "./sponsorship-brand";
export * from "./report";
```

- [ ] **Step 18: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS. If lint flags the commented `apiClient` imports as unused, they are inside comments — not a lint error. If it flags `_payload` unused, prefix confirms intentional; adjust eslint disable inline only if it actually errors.

- [ ] **Step 19: Commit**

```bash
git add src/lib/api-client.ts src/lib/format src/lib/mocks src/services
git commit -m "feat: add api client, formatters, mock fixtures, mock-backed services"
```

---

## Task 5: Hooks

**Files:**

- Create: `src/hooks/use-click-outside.ts`
- Create: `src/hooks/use-mobile.ts`
- Create: `src/hooks/use-disclosure.ts`
- Create: `src/hooks/use-debounced-value.ts`
- Create: `src/hooks/use-sortable-table.ts`
- Create: `src/hooks/use-lazy-list.ts`

**Interfaces:**

- Consumes: `SortDir` (Task 3).
- Produces:
  - `useClickOutside<T extends HTMLElement>(ref: RefObject<T | null>, handler: () => void): void`
  - `useIsMobile(breakpointPx?: number): boolean`
  - `useDisclosure(initial?: boolean): { isOpen: boolean; open: () => void; close: () => void; toggle: () => void; setOpen: (v: boolean) => void }`
  - `useDebouncedValue<T>(value: T, delayMs?: number): T`
  - `useSortableTable<T>(rows: T[], initial?: { key?: keyof T; dir?: SortDir }): { sortKey: keyof T | null; sortDir: SortDir; toggleSort: (key: keyof T) => void; sorted: T[] }`
  - `useLazyList<T>(rows: T[], step?: number): { visible: T[]; hasMore: boolean; loadMore: () => void; sentinelRef: RefObject<HTMLDivElement | null> }`

- [ ] **Step 1: Create `src/hooks/use-click-outside.ts`**

```ts
"use client";

import { useEffect, type RefObject } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
): void {
  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [ref, handler]);
}
```

- [ ] **Step 2: Create `src/hooks/use-mobile.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

export function useIsMobile(breakpointPx = 900): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpointPx]);

  return isMobile;
}
```

- [ ] **Step 3: Create `src/hooks/use-disclosure.ts`**

```ts
"use client";

import { useCallback, useState } from "react";

export function useDisclosure(initial = false) {
  const [isOpen, setOpen] = useState(initial);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return { isOpen, open, close, toggle, setOpen };
}
```

- [ ] **Step 4: Create `src/hooks/use-debounced-value.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 5: Create `src/hooks/use-sortable-table.ts`**

```ts
"use client";

import { useMemo, useState } from "react";
import type { SortDir } from "@/types/common";

export function useSortableTable<T>(
  rows: T[],
  initial?: { key?: keyof T; dir?: SortDir },
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? "asc");

  function toggleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : String(av ?? "").toLowerCase();
      const bn = typeof bv === "number" ? bv : String(bv ?? "").toLowerCase();
      if (an < bn) return sortDir === "asc" ? -1 : 1;
      if (an > bn) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return { sortKey, sortDir, toggleSort, sorted };
}
```

- [ ] **Step 6: Create `src/hooks/use-lazy-list.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useLazyList<T>(rows: T[], step = 10) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCount(step);
  }, [rows, step]);

  const hasMore = count < rows.length;

  const loadMore = useCallback(() => {
    setCount((c) => Math.min(c + step, rows.length));
  }, [rows.length, step]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return { visible: rows.slice(0, count), hasMore, loadMore, sentinelRef };
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks
git commit -m "feat: add reusable hooks (disclosure, debounce, sortable table, lazy list)"
```

---

## Task 6: UI primitives — plain

**Files:**

- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/table.tsx`

**Interfaces:**

- Consumes: `cn` (Task 2), `BadgeVariant` (Task 3), `Slot` from `radix-ui`.
- Produces (all named exports):
  - `Button` — props `VariantProps<typeof buttonVariants> & ButtonHTMLAttributes & { asChild?: boolean }`; export `buttonVariants`
  - `Input` — `InputHTMLAttributes`
  - `Textarea` — `TextareaHTMLAttributes`
  - `Badge` — `HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }`
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — `HTMLAttributes<HTMLDivElement>`
  - `Skeleton` — `HTMLAttributes<HTMLDivElement>`
  - `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` — corresponding table element attributes

- [ ] **Step 1: Create `src/components/ui/button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        outline: "border border-input bg-card hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
```

- [ ] **Step 2: Create `src/components/ui/input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring aria-[invalid=true]:border-danger h-10 w-full rounded-[var(--radius)] border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
```

- [ ] **Step 3: Create `src/components/ui/textarea.tsx`**

```tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring aria-[invalid=true]:border-danger min-h-20 w-full rounded-[var(--radius)] border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
```

- [ ] **Step 4: Create `src/components/ui/badge.tsx`**

```tsx
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-danger/15 text-danger",
        info: "bg-primary/15 text-primary",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

- [ ] **Step 5: Create `src/components/ui/card.tsx`**

```tsx
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DivProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "border-border bg-card rounded-[calc(var(--radius)+4px)] border shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: DivProps) {
  return (
    <h3
      className={cn("text-foreground text-base font-bold", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: DivProps) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("flex items-center gap-2 p-5 pt-0", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 6: Create `src/components/ui/skeleton.tsx`**

```tsx
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-muted animate-pulse rounded-[var(--radius)]",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 7: Create `src/components/ui/table.tsx`**

```tsx
import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/60", className)} {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-border border-b last:border-0", className)}
      {...props}
    />
  );
}

export function TH({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "text-muted-foreground px-3.5 py-3 text-left text-xs font-bold tracking-wide uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("text-foreground px-3.5 py-3 align-middle", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS. If `Slot.Root` is not the correct member, check `node_modules/radix-ui/dist/slot.d.ts` — the export is a namespace; use `Slot.Root` (Radix unified) or `Slot.Slot`. Adjust the import in `button.tsx` to whichever the d.ts exposes.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/badge.tsx src/components/ui/card.tsx src/components/ui/skeleton.tsx src/components/ui/table.tsx
git commit -m "feat: add plain UI primitives (button, input, badge, card, table, skeleton)"
```

---

## Task 7: UI primitives — Radix-based

**Files:**

- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/checkbox.tsx`
- Create: `src/components/ui/radio-group.tsx`
- Create: `src/components/ui/switch.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/index.ts`

**Interfaces:**

- Consumes: `cn` (Task 2), `radix-ui` namespaces, `lucide-react` icons (`Check`, `ChevronDown`, `Circle`, `X`).
- Produces (named exports):
  - `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`
  - `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`
  - `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
  - `Checkbox`
  - `RadioGroup`, `RadioGroupItem`
  - `Switch`
  - `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
  - `src/components/ui/index.ts` re-exports everything from `ui/*`

- [ ] **Step 1: Create `src/components/ui/dialog.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "border-border bg-card fixed top-1/2 left-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius)+4px)] border p-5 shadow-lg focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-sm focus-visible:ring-2 focus-visible:outline-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex flex-col gap-1", className)} {...props} />
  );
}

export function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-5 flex justify-end gap-2", className)} {...props} />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-foreground text-base font-bold", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
```

> If `data-[state=open]:animate-in` utilities are unavailable (no `tailwindcss-animate` in v4 setup), remove those class tokens — they are cosmetic. Keep the overlay/content classes.

- [ ] **Step 2: Create `src/components/ui/dropdown-menu.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof Primitive.Content>,
  ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "border-border bg-card z-50 min-w-44 rounded-[var(--radius)] border p-1.5 shadow-lg focus:outline-none",
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof Primitive.Item>,
  ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "text-foreground focus:bg-muted flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof Primitive.Separator>,
  ComponentPropsWithoutRef<typeof Primitive.Separator>
>(({ className, ...props }, ref) => (
  <Primitive.Separator
    ref={ref}
    className={cn("bg-border my-1 h-px", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof Primitive.Label>,
  ComponentPropsWithoutRef<typeof Primitive.Label>
>(({ className, ...props }, ref) => (
  <Primitive.Label
    ref={ref}
    className={cn(
      "text-muted-foreground px-2.5 py-1.5 text-xs font-semibold",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";
```

- [ ] **Step 3: Create `src/components/ui/select.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Select as Primitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof Primitive.Trigger>,
  ComponentPropsWithoutRef<typeof Primitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <Primitive.Trigger
    ref={ref}
    className={cn(
      "border-input bg-card text-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-[var(--radius)] border px-3 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    <Primitive.Icon asChild>
      <ChevronDown className="text-muted-foreground h-4 w-4" />
    </Primitive.Icon>
  </Primitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  ElementRef<typeof Primitive.Content>,
  ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      position={position}
      className={cn(
        "border-border bg-card z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius)] border p-1 shadow-lg",
        position === "popper" && "w-[var(--radix-select-trigger-width)]",
        className,
      )}
      {...props}
    >
      <Primitive.Viewport className="p-1">{children}</Primitive.Viewport>
    </Primitive.Content>
  </Primitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  ElementRef<typeof Primitive.Item>,
  ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, children, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "text-foreground focus:bg-muted relative flex cursor-pointer items-center rounded-sm py-2 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <Primitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </Primitive.ItemIndicator>
    </span>
    <Primitive.ItemText>{children}</Primitive.ItemText>
  </Primitive.Item>
));
SelectItem.displayName = "SelectItem";
```

- [ ] **Step 4: Create `src/components/ui/checkbox.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Checkbox as Primitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<
  ElementRef<typeof Primitive.Root>,
  ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root
    ref={ref}
    className={cn(
      "border-input bg-card focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <Primitive.Indicator>
      <Check className="h-3.5 w-3.5" />
    </Primitive.Indicator>
  </Primitive.Root>
));
Checkbox.displayName = "Checkbox";
```

- [ ] **Step 5: Create `src/components/ui/radio-group.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { RadioGroup as Primitive } from "radix-ui";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const RadioGroup = forwardRef<
  ElementRef<typeof Primitive.Root>,
  ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root
    ref={ref}
    className={cn("grid gap-2", className)}
    {...props}
  />
));
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = forwardRef<
  ElementRef<typeof Primitive.Item>,
  ComponentPropsWithoutRef<typeof Primitive.Item>
>(({ className, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "border-input bg-card text-primary focus-visible:ring-ring data-[state=checked]:border-primary flex h-4.5 w-4.5 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <Primitive.Indicator>
      <Circle className="h-2 w-2 fill-current" />
    </Primitive.Indicator>
  </Primitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";
```

- [ ] **Step 6: Create `src/components/ui/switch.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Switch as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<
  ElementRef<typeof Primitive.Root>,
  ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root
    ref={ref}
    className={cn(
      "peer focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <Primitive.Thumb className="bg-card pointer-events-none block h-5 w-5 rounded-full shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </Primitive.Root>
));
Switch.displayName = "Switch";
```

- [ ] **Step 7: Create `src/components/ui/tabs.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Tabs as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = Primitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof Primitive.List>,
  ComponentPropsWithoutRef<typeof Primitive.List>
>(({ className, ...props }, ref) => (
  <Primitive.List
    ref={ref}
    className={cn(
      "bg-muted inline-flex items-center gap-1 rounded-[var(--radius)] p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  ElementRef<typeof Primitive.Trigger>,
  ComponentPropsWithoutRef<typeof Primitive.Trigger>
>(({ className, ...props }, ref) => (
  <Primitive.Trigger
    ref={ref}
    className={cn(
      "text-muted-foreground focus-visible:ring-ring data-[state=active]:bg-card data-[state=active]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  ElementRef<typeof Primitive.Content>,
  ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, ...props }, ref) => (
  <Primitive.Content
    ref={ref}
    className={cn("mt-3 focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
```

- [ ] **Step 8: Create `src/components/ui/tooltip.tsx`**

```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Tooltip as Primitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof Primitive.Content>,
  ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "bg-foreground text-background z-50 rounded-md px-2.5 py-1.5 text-xs shadow-md",
        className,
      )}
      {...props}
    />
  </Primitive.Portal>
));
TooltipContent.displayName = "TooltipContent";
```

- [ ] **Step 9: Create `src/components/ui/index.ts`**

```ts
export * from "./button";
export * from "./input";
export * from "./textarea";
export * from "./badge";
export * from "./card";
export * from "./skeleton";
export * from "./table";
export * from "./dialog";
export * from "./dropdown-menu";
export * from "./select";
export * from "./checkbox";
export * from "./radio-group";
export * from "./switch";
export * from "./tabs";
export * from "./tooltip";
```

- [ ] **Step 10: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS. Likely fix-ups:

- If `ElementRef` / `ComponentPropsWithoutRef` are not exported from `react` in this version, import from `react` still works in 19; if not, use `React.ComponentRef` and `React.ComponentProps`. Adjust consistently across all Task 7 files.
- If a Radix namespace member differs (e.g. `Primitive.Icon` vs `Primitive.SelectIcon`), open the matching `node_modules/radix-ui/dist/<name>.d.ts` and use the exact exported name.
- `h-4.5` / `w-4.5` are valid Tailwind v4 arbitrary-free fractional utilities; if the build rejects them, use `h-[18px] w-[18px]`.

- [ ] **Step 11: Commit**

```bash
git add src/components/ui
git commit -m "feat: add Radix-based UI primitives (dialog, select, dropdown, tabs, etc.)"
```

---

## Task 8: Common composites

**Files:**

- Create: `src/components/common/page-heading.tsx`
- Create: `src/components/common/form-field.tsx`
- Create: `src/components/common/status-badge.tsx`
- Create: `src/components/common/empty-state.tsx`
- Create: `src/components/common/filter-bar.tsx`
- Create: `src/components/common/pagination.tsx`
- Create: `src/components/common/confirm-dialog.tsx`
- Create: `src/components/common/result-dialog.tsx`
- Create: `src/components/common/data-table.tsx`
- Create: `src/components/common/index.ts`

**Interfaces:**

- Consumes: `ui/*` (Task 6, 7), `cn` (Task 2), `useSortableTable` + `useLazyList` (Task 5), `statusToBadgeVariant` + `BadgeVariant` (Task 3).
- Produces (named exports):
  - `PageHeading({ title, description?, actions? })`
  - `FormField({ label, htmlFor?, required?, error?, hint?, children })`
  - `StatusBadge({ status, map? })`
  - `EmptyState({ icon?, title, description?, action? })`
  - `FilterBar({ children, onClear? })`
  - `Pagination({ page, pageCount, onPageChange })`
  - `ConfirmDialog({ open, onOpenChange, title, message, confirmLabel?, tone?, onConfirm, loading? })`
  - `ResultDialog({ open, onOpenChange, tone, title, message, actionLabel?, onAction? })`
  - `DataTable<T>({ columns, rows, getRowId, sort?, onSortChange?, lazy?, lazyStep?, renderEmpty? })` and exported type `Column<T> = { key: string; header: ReactNode; sortKey?: keyof T; cell?: (row: T) => ReactNode; className?: string }`

- [ ] **Step 1: Create `src/components/common/page-heading.tsx`**

```tsx
import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/common/form-field.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-muted-foreground text-xs font-bold tracking-wide uppercase"
      >
        {label}
        {required ? <span className="text-danger ml-0.5">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-danger text-xs font-medium">{error}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/common/status-badge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import {
  statusToBadgeVariant,
  type BadgeVariant,
} from "@/lib/constants/status";

export function StatusBadge({
  status,
  map,
}: {
  status: string;
  map?: Record<string, BadgeVariant>;
}) {
  const variant = map?.[status] ?? statusToBadgeVariant(status);
  return <Badge variant={variant}>{status}</Badge>;
}
```

- [ ] **Step 4: Create `src/components/common/empty-state.tsx`**

```tsx
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="text-foreground text-sm font-bold">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/common/filter-bar.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function FilterBar({
  children,
  onClear,
}: {
  children: ReactNode;
  onClear?: () => void;
}) {
  return (
    <div className="border-border bg-card mb-4 flex flex-wrap items-end gap-3 rounded-[calc(var(--radius)+4px)] border p-4">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
      {onClear ? (
        <Button variant="secondary" size="sm" type="button" onClick={onClear}>
          Clear Filter
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/common/pagination.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-muted-foreground text-sm">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/common/confirm-dialog.tsx`**

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            type="button"
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Create `src/components/common/result-dialog.tsx`**

```tsx
"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ResultDialog({
  open,
  onOpenChange,
  tone,
  title,
  message,
  actionLabel = "Done",
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: "success" | "error";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const Icon = tone === "success" ? CheckCircle2 : XCircle;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-center">
        <div className="mx-auto mb-2">
          <Icon
            className={
              tone === "success"
                ? "text-success h-12 w-12"
                : "text-danger h-12 w-12"
            }
          />
        </div>
        <DialogHeader className="items-center">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-center">
          <Button
            type="button"
            onClick={() => {
              onAction?.();
              onOpenChange(false);
            }}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 9: Create `src/components/common/data-table.tsx`**

```tsx
"use client";

import { type ReactNode } from "react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { useSortableTable } from "@/hooks/use-sortable-table";
import { useLazyList } from "@/hooks/use-lazy-list";
import type { SortDir } from "@/types/common";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  sortKey?: keyof T;
  cell?: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  lazy = false,
  lazyStep = 10,
  renderEmpty,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  lazy?: boolean;
  lazyStep?: number;
  renderEmpty?: () => ReactNode;
}) {
  const { sortKey, sortDir, toggleSort, sorted } = useSortableTable<T>(rows);
  const { visible, hasMore, sentinelRef } = useLazyList<T>(sorted, lazyStep);
  const data = lazy ? visible : sorted;

  if (rows.length === 0) {
    return (
      <>
        {renderEmpty ? renderEmpty() : <EmptyState title="No records found" />}
      </>
    );
  }

  return (
    <div className="border-border bg-card rounded-[calc(var(--radius)+4px)] border">
      <Table>
        <THead>
          <TR>
            {columns.map((col) => {
              const active = col.sortKey && sortKey === col.sortKey;
              return (
                <TH key={col.key} className={col.className}>
                  {col.sortKey ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase"
                      onClick={() => toggleSort(col.sortKey as keyof T)}
                    >
                      {col.header}
                      <SortGlyph active={!!active} dir={sortDir} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TH>
              );
            })}
          </TR>
        </THead>
        <TBody>
          {data.map((row) => (
            <TR key={getRowId(row)}>
              {columns.map((col) => (
                <TD key={col.key} className={cn("text-sm", col.className)}>
                  {col.cell
                    ? col.cell(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "-")}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
      {lazy && hasMore ? (
        <div
          ref={sentinelRef}
          className="text-muted-foreground py-3 text-center text-xs"
        >
          Loading more…
        </div>
      ) : null}
    </div>
  );
}

function SortGlyph({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-muted-foreground">↕</span>;
  return <span className="text-primary">{dir === "asc" ? "↑" : "↓"}</span>;
}
```

- [ ] **Step 10: Create `src/components/common/index.ts`**

```ts
export * from "./page-heading";
export * from "./form-field";
export * from "./status-badge";
export * from "./empty-state";
export * from "./filter-bar";
export * from "./pagination";
export * from "./confirm-dialog";
export * from "./result-dialog";
export * from "./data-table";
```

- [ ] **Step 11: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/components/common
git commit -m "feat: add composite widgets (PageHeading, DataTable, ConfirmDialog, FilterBar, etc.)"
```

---

## Task 9: Layout shell

**Files:**

- Modify (full replace): `src/components/layouts/sidebar/sidebar-context.tsx`
- Create: `src/components/layouts/sidebar/nav-data.ts`
- Create: `src/components/layouts/sidebar/icons.tsx`
- Create: `src/components/layouts/sidebar/menu-item.tsx`
- Create: `src/components/layouts/sidebar/submenu.tsx`
- Create: `src/components/layouts/sidebar/index.tsx`
- Create: `src/components/layouts/navbar/account-menu.tsx`
- Create: `src/components/layouts/navbar/index.tsx`
- Create: `src/components/layouts/default-layout.tsx`

**Interfaces:**

- Consumes: `useIsMobile` (Task 5), `ROUTES` (Task 3), `authService` (Task 4), `ui/*`, `cn`.
- Produces:
  - `useSidebarContext()` -> `{ isOpen, isMobile, toggleSidebar, setIsOpen }`
  - `SidebarProvider` (mobile-aware; replaces Task 2 stub)
  - `NAV_ITEMS: NavItem[]` and type `NavItem = { title: string; href?: string; icon: keyof typeof NAV_ICONS; items?: { title: string; href: string }[] }`
  - `<Sidebar />`, `<Navbar />`, `<DefaultLayout>{children}</DefaultLayout>`

- [ ] **Step 1: Replace `src/components/layouts/sidebar/sidebar-context.tsx`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type SidebarContextValue = {
  isOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  setIsOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx)
    throw new Error("useSidebarContext must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isMobile,
        setIsOpen,
        toggleSidebar: () => setIsOpen((v) => !v),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
```

- [ ] **Step 2: Create `src/components/layouts/sidebar/icons.tsx`**

```tsx
import {
  LayoutDashboard,
  CalendarDays,
  Trophy,
  Users,
  PawPrint,
  Handshake,
  FileBarChart,
} from "lucide-react";

export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  event: CalendarDays,
  competition: Trophy,
  users: Users,
  pets: PawPrint,
  sponsor: Handshake,
  report: FileBarChart,
} as const;

export type NavIconKey = keyof typeof NAV_ICONS;
```

- [ ] **Step 3: Create `src/components/layouts/sidebar/nav-data.ts`**

```ts
import { ROUTES } from "@/lib/constants/routes";
import type { NavIconKey } from "./icons";

export type NavItem = {
  title: string;
  href?: string;
  icon: NavIconKey;
  items?: { title: string; href: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: ROUTES.dashboard, icon: "dashboard" },
  {
    title: "Event Management",
    href: ROUTES.eventManagement.root,
    icon: "event",
    items: [
      {
        title: "Event Registration",
        href: ROUTES.eventManagement.eventRegistration,
      },
      {
        title: "Committee Registration",
        href: ROUTES.eventManagement.committeeRegistration,
      },
      {
        title: "Partner Registration",
        href: ROUTES.eventManagement.partnerRegistration,
      },
    ],
  },
  { title: "Competition", href: ROUTES.competition, icon: "competition" },
  { title: "User Management", href: ROUTES.userManagement, icon: "users" },
  { title: "Pet Management", href: ROUTES.petManagement, icon: "pets" },
  {
    title: "Sponsorship Brand",
    href: ROUTES.sponsorshipBrand,
    icon: "sponsor",
  },
  { title: "Report", href: ROUTES.report, icon: "report" },
];
```

- [ ] **Step 4: Create `src/components/layouts/sidebar/submenu.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Submenu({
  items,
}: {
  items: { title: string; href: string }[];
}) {
  const pathname = usePathname();
  return (
    <ul className="mt-1 flex flex-col gap-0.5 pl-9">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-primary" : "bg-muted-foreground/50",
                )}
              />
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Create `src/components/layouts/sidebar/menu-item.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./icons";
import { Submenu } from "./submenu";
import type { NavItem } from "./nav-data";

export function MenuItem({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const Icon = NAV_ICONS[item.icon];
  const isGroup = !!item.items?.length;
  const active =
    (item.href && pathname === item.href) ||
    (isGroup && item.items!.some((s) => pathname === s.href)) ||
    (item.href && pathname.startsWith(item.href) && item.href !== "/");
  const [open, setOpen] = useState<boolean>(!!active && isGroup);

  const baseClass = cn(
    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold",
    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
  );

  if (isGroup) {
    return (
      <li>
        <button
          type="button"
          className={baseClass}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="flex-1 text-left">{item.title}</span>}
          {!collapsed && (
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-180",
              )}
            />
          )}
        </button>
        {!collapsed && open ? <Submenu items={item.items!} /> : null}
      </li>
    );
  }

  return (
    <li>
      <Link href={item.href ?? "#"} className={baseClass}>
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.title}</span>}
      </Link>
    </li>
  );
}
```

- [ ] **Step 6: Create `src/components/layouts/sidebar/index.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useSidebarContext } from "./sidebar-context";
import { MenuItem } from "./menu-item";
import { NAV_ITEMS } from "./nav-data";

export function Sidebar() {
  const { isOpen, isMobile } = useSidebarContext();
  const collapsed = !isOpen && !isMobile;

  return (
    <aside
      className={cn(
        "border-border bg-card fixed top-[72px] bottom-0 left-0 z-40 border-r p-3 transition-[width,transform]",
        isMobile
          ? cn("w-60", isOpen ? "translate-x-0 shadow-lg" : "-translate-x-full")
          : cn(isOpen ? "w-60" : "w-[76px]"),
      )}
    >
      <nav>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <MenuItem key={item.title} item={item} collapsed={collapsed} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 7: Create `src/components/layouts/navbar/account-menu.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Settings, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authService } from "@/services/auth";
import { removeCookie } from "@/lib/utils";
import { ROUTES } from "@/lib/constants/routes";

export function AccountMenu() {
  const router = useRouter();

  async function handleSignOut() {
    await authService.signOut();
    removeCookie("session");
    router.push(ROUTES.auth.signIn);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="border-border bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full border"
          aria-label="Open account menu"
        >
          <User className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Lifta Annisa · Race PIC</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-danger focus:bg-danger/10"
          onSelect={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut className="h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 8: Create `src/components/layouts/navbar/index.tsx`**

```tsx
"use client";

import { Menu } from "lucide-react";
import { useSidebarContext } from "@/components/layouts/sidebar/sidebar-context";
import { AccountMenu } from "./account-menu";

export function Navbar() {
  const { toggleSidebar } = useSidebarContext();

  return (
    <header className="border-border bg-card/95 sticky top-0 z-50 h-[72px] border-b backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-5 px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="border-border flex h-10 w-10 items-center justify-center rounded-lg border"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-lg font-extrabold">
            <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-xl">
              P
            </span>
            <span>Petpet</span>
          </div>
        </div>
        <AccountMenu />
      </div>
    </header>
  );
}
```

- [ ] **Step 9: Create `src/components/layouts/default-layout.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layouts/navbar";
import { Sidebar } from "@/components/layouts/sidebar";
import { useSidebarContext } from "@/components/layouts/sidebar/sidebar-context";

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, isMobile } = useSidebarContext();

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main
        className={cn(
          "min-w-0 transition-[margin]",
          isMobile ? "ml-0" : isOpen ? "ml-60" : "ml-[76px]",
        )}
      >
        <div className="mx-auto max-w-[1440px] px-6 py-7">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 10: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS. If `onSelect` event type on `DropdownMenuItem` complains, type the param as `(e: Event)` or use `onClick` instead.

- [ ] **Step 11: Commit**

```bash
git add src/components/layouts
git commit -m "feat: add portal shell (sidebar with submenu, navbar, default layout)"
```

---

## Task 10: Auth route group

**Files:**

- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/sign-in/page.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`

**Interfaces:**

- Consumes: `ui/*`, `common/FormField`, `ROUTES`.
- Produces: routes `/sign-in`, `/forgot-password`, `/reset-password` — static markup only, no submit logic.

- [ ] **Step 1: Create `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="border-border bg-card w-full max-w-sm rounded-[calc(var(--radius)+6px)] border p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(auth)/sign-in/page.tsx`**

```tsx
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ROUTES } from "@/lib/constants/routes";

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-foreground text-lg font-bold">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Access the Pet Competition Portal.
        </p>
      </div>
      <form className="flex flex-col gap-4">
        <FormField label="Username" htmlFor="username" required>
          <Input id="username" name="username" autoComplete="username" />
        </FormField>
        <FormField label="Password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </FormField>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
      <Link
        href={ROUTES.auth.forgotPassword}
        className="text-primary text-center text-sm font-medium underline"
      >
        Forgot password?
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(auth)/forgot-password/page.tsx`**

```tsx
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ROUTES } from "@/lib/constants/routes";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-foreground text-lg font-bold">Forgot password</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We will send a reset link to your email.
        </p>
      </div>
      <form className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </FormField>
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
      <Link
        href={ROUTES.auth.signIn}
        className="text-primary text-center text-sm font-medium underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(auth)/reset-password/page.tsx`**

```tsx
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ROUTES } from "@/lib/constants/routes";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-foreground text-lg font-bold">Reset password</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose a new password.
        </p>
      </div>
      <form className="flex flex-col gap-4">
        <FormField label="New password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm" required>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
          />
        </FormField>
        <Button type="submit" className="w-full">
          Reset password
        </Button>
      </form>
      <Link
        href={ROUTES.auth.signIn}
        className="text-primary text-center text-sm font-medium underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS. `npm run build` still fails on missing `/` root page — expected until Task 11.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat: add auth route group (sign-in, forgot/reset password) static pages"
```

---

## Task 11: Portal routes, dashboard, domain placeholders, proxy

**Files:**

- Create: `src/app/(portal)/layout.tsx`
- Create: `src/app/(portal)/dashboard/page.tsx`
- Create: `src/app/(portal)/event-management/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/event-management/event-registration/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/event-management/committee-registration/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/event-management/partner-registration/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/competition/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/user-management/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/pet-management/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/sponsorship-brand/page.tsx` + `_components/.gitkeep`
- Create: `src/app/(portal)/report/page.tsx` + `_components/.gitkeep`
- Create: `src/app/page.tsx` (root redirect)
- Create: `src/proxy.ts`

**Interfaces:**

- Consumes: `DefaultLayout` (Task 9), `PageHeading` + `Card*` (Task 6/8), `reportService` (Task 4), `ROUTES` (Task 3).
- Produces: every portal route renders inside `DefaultLayout`; `/` redirects to `/dashboard`; `proxy` redirects unauthenticated requests to `/sign-in`.

- [ ] **Step 1: Create `src/app/(portal)/layout.tsx`**

```tsx
import { DefaultLayout } from "@/components/layouts/default-layout";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
```

- [ ] **Step 2: Create `src/app/(portal)/dashboard/page.tsx`**

```tsx
import { PageHeading } from "@/components/common/page-heading";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { reportService } from "@/services/report";

export default async function DashboardPage() {
  const { data } = await reportService.summary();
  const tiles = [
    { label: "Total Events", value: data.totalEvents },
    { label: "Total Users", value: data.totalUsers },
    { label: "Total Pets", value: data.totalPets },
  ];

  return (
    <>
      <PageHeading title="Dashboard" description="Portal overview." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-semibold">
                {tile.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground text-3xl font-bold">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create the domain placeholder pages**

Each placeholder page is the same shape. Create one file per row below, at
`src/app/(portal)/<path>/page.tsx`, with `<Title>` and `<Description>` substituted:

| File path                                          | Title                    | Description                                             |
| -------------------------------------------------- | ------------------------ | ------------------------------------------------------- |
| `event-management/page.tsx`                        | `Event Management`       | `Manage events, schedules, organizers, and status.`     |
| `event-management/event-registration/page.tsx`     | `Event Registration`     | `Register participants and pets to event competitions.` |
| `event-management/committee-registration/page.tsx` | `Committee Registration` | `Assign committee members to competitions.`             |
| `event-management/partner-registration/page.tsx`   | `Partner Registration`   | `Register sponsors and media partners to events.`       |
| `competition/page.tsx`                             | `Competition`            | `Run races, drawings, and leaderboards.`                |
| `user-management/page.tsx`                         | `User Management`        | `Manage platform users and contact information.`        |
| `pet-management/page.tsx`                          | `Pet Management`         | `Manage registered pets and ownership.`                 |
| `sponsorship-brand/page.tsx`                       | `Sponsorship Brand`      | `Manage sponsor brands, tiers, and campaigns.`          |
| `report/page.tsx`                                  | `Report`                 | `Reporting module.`                                     |

Template (substitute the two placeholders):

```tsx
import { PageHeading } from "@/components/common/page-heading";
import { EmptyState } from "@/components/common/empty-state";

export default function Page() {
  return (
    <>
      <PageHeading title="<Title>" description="<Description>" />
      <div className="border-border bg-card rounded-[calc(var(--radius)+4px)] border">
        <EmptyState
          title="Coming soon"
          description="This module has not been implemented yet."
        />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create the `_components/.gitkeep` files**

Create an empty file `_components/.gitkeep` next to every page created in Steps 2–3
(9 directories):
`event-management`, `event-management/event-registration`,
`event-management/committee-registration`, `event-management/partner-registration`,
`competition`, `user-management`, `pet-management`, `sponsorship-brand`, `report`.

```bash
mkdir -p "src/app/(portal)/event-management/_components" \
  "src/app/(portal)/event-management/event-registration/_components" \
  "src/app/(portal)/event-management/committee-registration/_components" \
  "src/app/(portal)/event-management/partner-registration/_components" \
  "src/app/(portal)/competition/_components" \
  "src/app/(portal)/user-management/_components" \
  "src/app/(portal)/pet-management/_components" \
  "src/app/(portal)/sponsorship-brand/_components" \
  "src/app/(portal)/report/_components"
find "src/app/(portal)" -type d -name _components -exec touch {}/.gitkeep \;
```

- [ ] **Step 5: Create `src/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";

export default function RootPage() {
  redirect(ROUTES.dashboard);
}
```

- [ ] **Step 6: Create `src/proxy.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get("session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
```

- [ ] **Step 7: Verify — full build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS. `build` output lists routes: `/`, `/sign-in`, `/forgot-password`, `/reset-password`, `/dashboard`, `/event-management` (+3 nested), `/competition`, `/user-management`, `/pet-management`, `/sponsorship-brand`, `/report`.

- [ ] **Step 8: Verify — dev smoke**

Run: `npm run dev`. In a browser:

1. Visit `/` with no `session` cookie -> redirected to `/sign-in`.
2. Set a cookie manually in devtools: `document.cookie = "session=dev; path=/"`. Reload `/` -> lands on `/dashboard` showing three stat tiles (3, 3, 3).
3. Click every sidebar link -> each opens its placeholder page with "Coming soon".
4. Expand "Event Management" -> submenu shows 3 links, each navigates.
5. Toggle sidebar via navbar button -> collapses to icon rail; resize below 900px -> sidebar hides, toggle opens it as overlay.
6. Open the account menu -> Settings + Logout visible; Logout routes to `/sign-in`.

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(portal)" src/app/page.tsx src/proxy.ts
git commit -m "feat: add portal layout, dashboard, domain placeholder routes, auth proxy"
```

---

## Task 12: README + final sweep

**Files:**

- Modify: `README.md`
- Create: `docs/architecture.md`

**Interfaces:**

- Consumes: everything.
- Produces: onboarding docs.

- [ ] **Step 1: Replace `README.md`**

````markdown
# Pet Competition Portal

Operations portal for pet competition events (events, competitions, users, pets,
sponsors, reports). Built with Next.js 16 (App Router), React 19, Tailwind CSS v4.

## Getting started

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL
npm run dev
```
````

The app currently runs on **mock data** (`src/lib/mocks/`). Every `src/services/*`
function returns a mock shaped in the real API return type; the real `apiClient`
call is written and commented out, ready to enable.

## Scripts

| Command             | Purpose               |
| ------------------- | --------------------- |
| `npm run dev`       | Start dev server      |
| `npm run build`     | Production build      |
| `npm run typecheck` | `tsc --noEmit`        |
| `npm run lint`      | ESLint                |
| `npm run format`    | Prettier write        |
| `npm run test`      | Vitest (no tests yet) |

## Structure

See `docs/architecture.md`.

````

- [ ] **Step 2: Create `docs/architecture.md`**

```markdown
# Architecture

## Layout

- `src/app/(auth)/` — sign-in / forgot / reset password (static markup).
- `src/app/(portal)/` — authenticated portal; `layout.tsx` renders `DefaultLayout`
  (navbar + sidebar + content shell). One folder per domain, each with a
  colocated `_components/` for page-specific pieces.
- `src/proxy.ts` — redirects requests without a `session` cookie to `/sign-in`
  (mock auth; `middleware` is renamed `proxy` in Next 16).

## Components

- `src/components/ui/` — primitives (Radix + `cva`). Import via `@/components/ui`.
- `src/components/common/` — generic composed widgets: `DataTable`, `FilterBar`,
  `ConfirmDialog`, `ResultDialog`, `PageHeading`, `StatusBadge`, `FormField`,
  `EmptyState`, `Pagination`. Import via `@/components/common`.
- `src/components/layouts/` — `DefaultLayout`, `Navbar`, `Sidebar` (+ context,
  `nav-data.ts` menu tree).

## Data layer

- `src/lib/api-client.ts` — `fetch` wrapper, `ApiError`, 401/422 handling. Token
  from the `session` cookie (`getCookie` in `src/lib/utils.ts`).
- `src/lib/constants/` — `routes.ts` (nav + redirects), `endpoints.ts`,
  `status.ts` (status -> badge variant).
- `src/services/<domain>.ts` — one per domain; returns mocks now, real call
  commented.
- `src/types/<domain>.ts` — entity interfaces; `common.ts` has `ApiResponse<T>`,
  `Paginated<T>`.
- `src/lib/mocks/<domain>.ts` — fixture arrays.

## Adding a feature page

1. Add the entity type in `src/types/`, endpoint in `src/lib/constants/endpoints.ts`.
2. Add / extend the service in `src/services/`, mock in `src/lib/mocks/`.
3. Build the page in `src/app/(portal)/<domain>/page.tsx` using `DataTable`,
   `FilterBar`, `PageHeading`; put page-only pieces in the sibling `_components/`.
4. Wire the route in `src/lib/constants/routes.ts` and `nav-data.ts` if new.
````

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS.
Run: `git status`
Expected: clean except the two doc files (and the `AGENTS.md` agent-rules block if `next dev` re-added it — stage it too).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: add README quickstart and architecture guide"
```

---

## Self-Review

**1. Spec coverage**

| Spec section                                                                                | Task                                                                   |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| §3 approach C `components/` split                                                           | Tasks 6–9                                                              |
| §4 directory layout                                                                         | Tasks 2–11 (each dir created in its owning task)                       |
| §5 primitives table                                                                         | Tasks 6, 7                                                             |
| §5 composites table                                                                         | Task 8                                                                 |
| §6 layout shell (providers, sidebar ctx, sidebar, navbar, default-layout)                   | Tasks 2 (providers + stub), 9                                          |
| §7 api-client / endpoints / services / mocks / types                                        | Tasks 3, 4                                                             |
| §8 hooks                                                                                    | Task 5                                                                 |
| §9 config (globals.css, layout metadata, .prettierrc, vitest, scripts, .env.example, proxy) | Tasks 1, 2, 11                                                         |
| §10 non-goals                                                                               | Respected — no CRUD, no real auth, no test files, no exact color match |
| §11 verification                                                                            | Task 11 Steps 7–8, Task 12 Step 3                                      |

Gap fixed vs spec: spec said `middleware.ts`; Next 16 requires `src/proxy.ts` — corrected in Global Constraints and Task 11.

**2. Placeholder scan** — no "TBD"/"handle edge cases"/"similar to Task N". Domain pages use an explicit substitution table + full template (acceptable DRY for 9 identical files). Commented `apiClient` lines in services are intentional per spec §7.

**3. Type consistency**

- `ApiResponse<T>` / `Paginated<T>` — defined Task 3, consumed Tasks 4, 11 identically.
- `Column<T>` — defined Task 8, only consumer is feature work (out of scope).
- `useSortableTable` returns `{ sortKey, sortDir, toggleSort, sorted }` — Task 5 def matches Task 8 `DataTable` usage.
- `useLazyList` returns `{ visible, hasMore, loadMore, sentinelRef }` — Task 5 def matches Task 8 usage (`visible`, `hasMore`, `sentinelRef`).
- `useSidebarContext()` shape `{ isOpen, isMobile, toggleSidebar, setIsOpen }` — Task 2 stub and Task 9 replacement match; consumed by `Sidebar`, `Navbar`, `DefaultLayout` (Task 9) with those exact names.
- `authService.signOut()` -> `Promise<void>` — Task 4 def matches Task 9 `AccountMenu` usage.
- `statusToBadgeVariant` + `BadgeVariant` — Task 3 def matches Task 8 `StatusBadge` import.
- `NAV_ICONS` keys (`dashboard/event/competition/users/pets/sponsor/report`) — Task 9 `icons.tsx` matches `nav-data.ts` `icon` fields.
- `ROUTES` shape — Task 3 def matches `nav-data.ts` (Task 9), auth pages (Task 10), root redirect + proxy public paths (Task 11).

No mismatches found.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-portal-scaffold-and-component-library.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
