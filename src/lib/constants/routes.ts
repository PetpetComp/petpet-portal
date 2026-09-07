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
