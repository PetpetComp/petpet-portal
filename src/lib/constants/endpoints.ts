const id = (value: string) => encodeURIComponent(value);
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    logout: "/auth/logout",
    me: "/auth/me",
    roles: "/auth/roles",
    permissions: "/auth/permissions",
  },
  users: {
    list: "/users",
    detail: (uuid: string) => `/users/${id(uuid)}`,
    roles: (uuid: string) => `/users/${id(uuid)}/roles`,
    role: (uuid: string, code: string) =>
      `/users/${id(uuid)}/roles/${id(code)}`,
  },
  pets: { list: "/pets", detail: (uuid: string) => `/pets/${id(uuid)}` },
  events: {
    list: "/events",
    detail: (uuid: string) => `/events/${id(uuid)}`,
    publish: (uuid: string) => `/events/${id(uuid)}/publish`,
    competitions: (uuid: string) => `/events/${id(uuid)}/competitions`,
    sponsors: (uuid: string) => `/events/${id(uuid)}/sponsors`,
    sponsor: (uuid: string, linkId: string) =>
      `/events/${id(uuid)}/sponsors/${id(linkId)}`,
    staff: (uuid: string) => `/events/${id(uuid)}/staff`,
  },
  competitions: {
    detail: (uuid: string) => `/competitions/${id(uuid)}`,
    closeRegistration: (uuid: string) =>
      `/competitions/${id(uuid)}/close-registration`,
    rules: (uuid: string) => `/competitions/${id(uuid)}/rules`,
    periods: (uuid: string) => `/competitions/${id(uuid)}/registration-periods`,
    criteria: (uuid: string) => `/competitions/${id(uuid)}/score-criteria`,
    entries: (uuid: string) => `/competitions/${id(uuid)}/entries`,
    staff: (uuid: string) => `/competitions/${id(uuid)}/staff`,
  },
  periods: { detail: (uuid: string) => `/registration-periods/${id(uuid)}` },
  criteria: { detail: (uuid: string) => `/score-criteria/${id(uuid)}` },
  sponsors: {
    list: "/sponsors",
    detail: (uuid: string) => `/sponsors/${id(uuid)}`,
    pics: (uuid: string) => `/sponsors/${id(uuid)}/pics`,
    pic: (uuid: string, userId: string) =>
      `/sponsors/${id(uuid)}/pics/${id(userId)}`,
  },
  organizations: { list: "/organizations" },
  entries: {
    detail: (uuid: string) => `/entries/${id(uuid)}`,
    approve: (uuid: string) => `/entries/${id(uuid)}/approve`,
    reject: (uuid: string) => `/entries/${id(uuid)}/reject`,
    checkin: (uuid: string) => `/entries/${id(uuid)}/checkin`,
  },
  staff: {
    invitations: "/staff-invitations",
    invitation: (uuid: string) => `/staff-invitations/${id(uuid)}`,
    assignment: (uuid: string) => `/staff-assignments/${id(uuid)}`,
  },
} as const;
