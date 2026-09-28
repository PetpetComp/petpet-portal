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
      {
        label: "Event Registration",
        href: ROUTES.eventManagement.eventRegistration,
      },
      {
        label: "Committee Registration",
        href: ROUTES.eventManagement.committeeRegistration,
      },
      {
        label: "Partner Registration",
        href: ROUTES.eventManagement.partnerRegistration,
      },
      {
        label: "Doorprize Drawing",
        href: ROUTES.eventManagement.doorprizeDrawing,
      },
      {
        label: "Event Participant",
        href: ROUTES.eventManagement.eventParticipant,
      },
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
