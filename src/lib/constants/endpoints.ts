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
