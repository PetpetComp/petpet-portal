import {
  CalendarDays,
  Flag,
  Users,
  PawPrint,
  Handshake,
  ChartNoAxesCombined,
} from "lucide-react";
import { ROUTES } from "@/lib/constants/routes";
export const navigation = [
  {
    label: "Event",
    icon: CalendarDays,
    items: [
      { label: "Event Management", href: ROUTES.eventManagement.root },
      { label: "Create Event", href: ROUTES.eventManagement.create },
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
    ],
  },
  { label: "Competition", icon: Flag, href: ROUTES.competition },
  {
    label: "User",
    icon: Users,
    items: [
      { label: "User Management", href: ROUTES.userManagement },
      { label: "Add New User", href: ROUTES.users.create },
    ],
  },
  {
    label: "Pet",
    icon: PawPrint,
    items: [
      { label: "Pet Management", href: ROUTES.petManagement },
      { label: "Add New Pet", href: ROUTES.pets.create },
    ],
  },
  {
    label: "Brands",
    icon: Handshake,
    items: [
      { label: "Brand Management", href: ROUTES.sponsorshipBrand },
      { label: "Add New Brand", href: ROUTES.brands.create },
    ],
  },
  { label: "Report", icon: ChartNoAxesCombined, href: ROUTES.report },
];
