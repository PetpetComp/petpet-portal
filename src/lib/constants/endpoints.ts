const id = (value: string) => encodeURIComponent(value);
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    logout: "/auth/logout",
    me: "/auth/me",
    mePhotoPresign: "/auth/me/photo/presign",
    sso: "/auth/sso",
    roles: "/auth/roles",
    permissions: "/auth/permissions",
  },
  users: {
    list: "/users",
    detail: (uuid: string) => `/users/${id(uuid)}`,
    roles: (uuid: string) => `/users/${id(uuid)}/roles`,
    role: (uuid: string, code: string) =>
      `/users/${id(uuid)}/roles/${id(code)}`,
    photoPresign: (uuid: string) => `/users/${id(uuid)}/photo/presign`,
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
    entries: (uuid: string) => `/events/${id(uuid)}/entries`,
    ownerSearch: (uuid: string) => `/events/${id(uuid)}/owner-search`,
  },
  competitions: {
    detail: (uuid: string) => `/competitions/${id(uuid)}`,
    publish: (uuid: string) => `/competitions/${id(uuid)}/publish`,
    start: (uuid: string) => `/competitions/${id(uuid)}/start`,
    complete: (uuid: string) => `/competitions/${id(uuid)}/complete`,
    closeRegistration: (uuid: string) =>
      `/competitions/${id(uuid)}/close-registration`,
    /** MOCK ONLY: no such endpoint in the backend yet (contract 13 section 9). */
    reopenRegistration: (uuid: string) =>
      `/competitions/${id(uuid)}/reopen-registration`,
    rules: (uuid: string) => `/competitions/${id(uuid)}/rules`,
    periods: (uuid: string) => `/competitions/${id(uuid)}/registration-periods`,
    criteria: (uuid: string) => `/competitions/${id(uuid)}/score-criteria`,
    entries: (uuid: string) => `/competitions/${id(uuid)}/entries`,
    staff: (uuid: string) => `/competitions/${id(uuid)}/staff`,
  },
  /** MOCK ONLY: no such endpoints in the backend yet (draft contract results). */
  results: {
    list: (uuid: string) => `/competitions/${id(uuid)}/results`,
    verify: (uuid: string) => `/competitions/${id(uuid)}/results/verify`,
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
  organizerApplications: {
    list: "/organizer-applications",
    mine: "/organizer-applications/me",
    detail: (uuid: string) => `/organizer-applications/${id(uuid)}`,
    approve: (uuid: string) => `/organizer-applications/${id(uuid)}/approve`,
    reject: (uuid: string) => `/organizer-applications/${id(uuid)}/reject`,
  },
  organizations: {
    list: "/organizations",
    detail: (uuid: string) => `/organizations/${id(uuid)}`,
    members: (uuid: string) => `/organizations/${id(uuid)}/members`,
    member: (uuid: string, userUuid: string) =>
      `/organizations/${id(uuid)}/members/${id(userUuid)}`,
    invitations: (uuid: string) => `/organizations/${id(uuid)}/invitations`,
    invitation: (uuid: string, invitationUuid: string) =>
      `/organizations/${id(uuid)}/invitations/${id(invitationUuid)}`,
    verifications: (uuid: string) => `/organizations/${id(uuid)}/verifications`,
  },
  verifications: {
    list: "/verifications",
    approve: (uuid: string) => `/verifications/${id(uuid)}/approve`,
    reject: (uuid: string) => `/verifications/${id(uuid)}/reject`,
  },
  invitations: {
    detail: (token: string) => `/invitations/${id(token)}`,
    accept: (token: string) => `/invitations/${id(token)}/accept`,
    decline: (token: string) => `/invitations/${id(token)}/decline`,
  },
  master: {
    species: "/master/species",
    petMorphs: "/master/pet-morphs",
    competitionTypes: "/master/competition-types",
    assignmentRoles: "/master/assignment-roles",
    countries: "/master/countries",
    provinces: "/master/provinces",
    cities: "/master/cities",
  },
  entries: {
    detail: (uuid: string) => `/entries/${id(uuid)}`,
    approve: (uuid: string) => `/entries/${id(uuid)}/approve`,
    reject: (uuid: string) => `/entries/${id(uuid)}/reject`,
    /** Simulasi pembayaran (kontrak 13 bagian 2), belum ada di backend asli. */
    markPaid: (uuid: string) => `/entries/${id(uuid)}/mark-paid`,
    checkin: (uuid: string) => `/entries/${id(uuid)}/checkin`,
    undoCheckin: (uuid: string) => `/entries/${id(uuid)}/undo-checkin`,
  },
  staff: {
    invitations: "/staff-invitations",
    invitation: (uuid: string) => `/staff-invitations/${id(uuid)}`,
    assignment: (uuid: string) => `/staff-assignments/${id(uuid)}`,
  },
} as const;
