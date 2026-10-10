export const ROUTES = {
  auth: {
    signIn: "/sign-in",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
  },
  home: "/home",
  dashboard: "/dashboard",
  landing: "/",
  competitorHome: "/my-competitions",
  sponsorHome: "/sponsor-home",
  eventManagement: {
    root: "/event-management",
    create: "/event-management/create",
    detail: (eventId: string) =>
      `/event-management/${encodeURIComponent(eventId)}`,
    edit: (eventId: string) =>
      `/event-management/${encodeURIComponent(eventId)}/edit`,
    createCompetition: (eventId: string) =>
      `/event-management/${encodeURIComponent(eventId)}/competitions/create`,
    competitionDetail: (eventId: string, competitionId: string) =>
      `/event-management/${encodeURIComponent(eventId)}/competitions/${encodeURIComponent(competitionId)}`,
    doorprizeDrawing: "/event-management/doorprize-drawing",
    eventRegistration: "/event-management/event-registration",
    eventParticipant: "/event-management/event-participant",
  },
  competition: "/competition",
  competitionOperations: {
    drawing: (id: string) => `/competition/${encodeURIComponent(id)}/drawing`,
    runMatch: (id: string) =>
      `/competition/${encodeURIComponent(id)}/run-match`,
    contest: (id: string) => `/competition/${encodeURIComponent(id)}/contest`,
    timeTrial: (id: string) =>
      `/competition/${encodeURIComponent(id)}/time-trial`,
  },
  organizationManagement: "/organization-management",
  myOrganization: "/my-organization",
  userManagement: "/user-management",
  users: {
    create: "/user-management/create",
    detail: (id: string) => `/user-management/${encodeURIComponent(id)}`,
    edit: (id: string) => `/user-management/${encodeURIComponent(id)}/edit`,
  },
  petManagement: "/pet-management",
  pets: {
    create: "/pet-management/create",
    detail: (id: string) => `/pet-management/${encodeURIComponent(id)}`,
    edit: (id: string) => `/pet-management/${encodeURIComponent(id)}/edit`,
  },
  sponsorshipBrand: "/sponsorship-brand",
  brands: {
    create: "/sponsorship-brand/create",
    detail: (id: string) => `/sponsorship-brand/${encodeURIComponent(id)}`,
    edit: (id: string) => `/sponsorship-brand/${encodeURIComponent(id)}/edit`,
  },
  report: "/report",
} as const;
