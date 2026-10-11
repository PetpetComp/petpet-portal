export const ROUTES = {
  auth: {
    signIn: "/sign-in",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
  },
  home: "/home",
  /** My assignments (HP): kompetisi hari ini milik staf/juri, pintu masuk ke Live Mode. */
  assignments: "/assignments",
  dashboard: "/dashboard",
  landing: "/",
  competitorHome: "/my-competitions",
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
    /** Halaman Edit competition (di luar grup tab, seperti Edit event). */
    competitionEdit: (eventId: string, competitionId: string) =>
      `/event-management/${encodeURIComponent(eventId)}/competitions/${encodeURIComponent(competitionId)}/edit`,
    doorprizeDrawing: "/event-management/doorprize-drawing",
    eventParticipant: "/event-management/event-participant",
  },
  /** Live Mode (layar penuh per kompetisi): Drawing -> Matches -> Results. */
  live: (competitionId: string) => `/live/${encodeURIComponent(competitionId)}`,
  liveDrawing: (competitionId: string) =>
    `/live/${encodeURIComponent(competitionId)}/drawing`,
  liveMatches: (competitionId: string) =>
    `/live/${encodeURIComponent(competitionId)}/matches`,
  /** Layar Run Match satu match (tab Matches tetap aktif). */
  liveMatch: (competitionId: string, matchId: string) =>
    `/live/${encodeURIComponent(competitionId)}/matches/${encodeURIComponent(matchId)}`,
  liveJudging: (competitionId: string) =>
    `/live/${encodeURIComponent(competitionId)}/judging`,
  liveResults: (competitionId: string) =>
    `/live/${encodeURIComponent(competitionId)}/results`,
  organizationManagement: "/organization-management",
  organizations: {
    create: "/organization-management/create",
    detail: (id: string) =>
      `/organization-management/${encodeURIComponent(id)}`,
    events: (id: string) =>
      `/organization-management/${encodeURIComponent(id)}/events`,
    invitations: (id: string) =>
      `/organization-management/${encodeURIComponent(id)}/invitations`,
    profile: (id: string) =>
      `/organization-management/${encodeURIComponent(id)}/profile`,
  },
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
  rolesAccess: "/roles-access",
  report: "/report",
} as const;
