import {
  House,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  PawPrint,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
} from "lucide-react";
import { PERMISSION as P, type Permission } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";

export interface NavItem {
  label: string;
  href: string;
  permission?: Permission;
}
export interface NavGroup {
  label: string;
  icon: typeof Users;
  href?: string;
  items?: NavItem[];
  /** Hidden unless the user holds this permission. No permission = every signed-in user. */
  permission?: Permission;
  /** Hidden unless the user has at least one staff assignment (committee, judge, ...). */
  requiresAssignment?: boolean;
  /** Heading shown above the first group of a section. */
  section?: "Main" | "Data" | "Insight" | "Transitional";
}

/**
 * Order and sections follow the Event Workspace design (docs/08).
 * "Event tools" holds the old per-feature pages; each one disappears when its
 * replacement ships inside the event workspace (F1 to F3).
 */
export const navigation: NavGroup[] = [
  { label: "Home", icon: House, href: ROUTES.home, section: "Main" },
  {
    label: "My assignments",
    icon: ClipboardList,
    href: ROUTES.assignments,
    requiresAssignment: true,
    section: "Main",
  },
  {
    label: "Events",
    icon: CalendarDays,
    href: ROUTES.eventManagement.root,
    permission: P.EVENT_UPDATE,
    section: "Main",
  },
  {
    label: "Users",
    icon: Users,
    href: ROUTES.userManagement,
    permission: P.USER_VIEW,
    section: "Data",
  },
  {
    label: "Pets",
    icon: PawPrint,
    href: ROUTES.petManagement,
    section: "Data",
  },
  {
    label: "Brands",
    icon: Tag,
    href: ROUTES.sponsorshipBrand,
    permission: P.MASTER_MANAGE,
    section: "Data",
  },
  {
    label: "Organizations",
    icon: Building2,
    href: ROUTES.organizationManagement,
    // Terbuka untuk semua akun: akun biasa membuka halaman ini untuk "Apply as organizer".
    section: "Data",
  },
  {
    // GET /auth/permissions butuh user.view, jadi menu ini memakai izin yang sama.
    label: "Roles & access",
    icon: ShieldCheck,
    href: ROUTES.rolesAccess,
    permission: P.USER_VIEW,
    section: "Data",
  },
  {
    label: "Reports",
    icon: ChartNoAxesCombined,
    href: ROUTES.report,
    permission: P.EVENT_UPDATE,
    section: "Insight",
  },
  {
    label: "Event tools",
    icon: Wrench,
    section: "Transitional",
    items: [
      {
        label: "Event Participant",
        href: ROUTES.eventManagement.eventParticipant,
        permission: P.EVENT_UPDATE,
      },
      {
        label: "Doorprize Drawing",
        href: ROUTES.eventManagement.doorprizeDrawing,
        permission: P.EVENT_UPDATE,
      },
    ],
  },
];

/**
 * Drops what the user may not open; a group with no visible item disappears.
 * `hasAssignments` = the user holds at least one staff assignment; groups marked
 * `requiresAssignment` (My assignments) stay hidden without it. Called from `portal-shell.tsx`.
 */
export function visibleNavigation(
  groups: NavGroup[],
  can: (permission: Permission) => boolean,
  hasAssignments = false,
): NavGroup[] {
  const ok = (p?: Permission) => !p || can(p);
  return groups
    .filter(
      (g) => ok(g.permission) && (!g.requiresAssignment || hasAssignments),
    )
    .map((g) =>
      g.items ? { ...g, items: g.items.filter((i) => ok(i.permission)) } : g,
    )
    .filter((g) => g.href || g.items?.length);
}
