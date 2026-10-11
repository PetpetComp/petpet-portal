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
  /** MOCK ONLY: no such endpoints in the backend yet (draft contract drawing). */
  drawing: {
    /** GET reads the drawing, POST locks it. */
    detail: (uuid: string) => `/competitions/${id(uuid)}/drawing`,
    swap: (uuid: string) => `/competitions/${id(uuid)}/drawing/swap`,
  },
  /**
   * Run Match (Live Mode, Race). Paths marked "backend" exist in petpet-service already (routes/api
   * heats, race-sessions, finish-captures, penalties, heat-entries, entries). The rest is MOCK ONLY
   * (contract 13 section 13): the match list and detail (joins), and the atomic confirm.
   */
  matches: {
    /** MOCK ONLY: GET match list of a competition. */
    list: (competitionUuid: string) =>
      `/competitions/${id(competitionUuid)}/matches`,
    /** MOCK ONLY: GET one match (heat) with lanes, sessions and flags. */
    detail: (heatUuid: string) => `/matches/${id(heatUuid)}`,
    /** MOCK ONLY: POST atomic confirm of the match result. */
    confirm: (heatUuid: string) => `/heats/${id(heatUuid)}/confirm`,
    /** Backend: POST creates a race session (also used for rematch). */
    sessions: (heatUuid: string) => `/heats/${id(heatUuid)}/sessions`,
    /** Backend: PATCH `call_status` (did not start). */
    heatEntry: (heatEntryUuid: string) => `/heat-entries/${id(heatEntryUuid)}`,
  },
  race: {
    /** Backend: POST starts a READY session. */
    startSession: (sessionUuid: string) => `/sessions/${id(sessionUuid)}/start`,
    /** Backend: POST stops a RUNNING session (body `stop_reason`). */
    stopSession: (sessionUuid: string) => `/sessions/${id(sessionUuid)}/stop`,
    /** Backend: POST captures one finish tap. */
    finishes: (sessionUuid: string) => `/sessions/${id(sessionUuid)}/finishes`,
    /** Backend: PATCH assigns a capture to an entry. */
    assignFinish: (captureUuid: string) =>
      `/finishes/${id(captureUuid)}/assign`,
    /** Backend: POST voids a capture (undo). */
    voidFinish: (captureUuid: string) => `/finishes/${id(captureUuid)}/void`,
    /** Backend: POST issues a penalty to an entry (Disqualify = unit DISQUALIFICATION). */
    penalties: (entryUuid: string) => `/entries/${id(entryUuid)}/penalties`,
    /** Backend: POST revokes a penalty. */
    revokePenalty: (penaltyUuid: string) =>
      `/penalties/${id(penaltyUuid)}/revoke`,
  },
  /**
   * Time trial (Live Mode). Paths marked "backend" exist in petpet-service already (routes/api
   * rounds, attempts, round-entries; penalties reuse `race.penalties`). The rest is MOCK ONLY
   * (contract 14): the queue read and Skip to next. The queue itself is drawn with the Drawing
   * endpoints (`drawing`), which also accept TIME_TRIAL competitions.
   */
  timetrial: {
    /** MOCK ONLY: GET the ordered queue with attempts, best times and flags. */
    queue: (competitionUuid: string) =>
      `/competitions/${id(competitionUuid)}/queue`,
    /** MOCK ONLY: POST moves a participant to the end of the queue. */
    skip: (competitionUuid: string, entryUuid: string) =>
      `/competitions/${id(competitionUuid)}/queue/${id(entryUuid)}/skip`,
    /** Backend: POST creates an attempt (status WAITING) in a round. */
    attempts: (roundUuid: string) => `/rounds/${id(roundUuid)}/attempts`,
    /** Backend: GET one attempt (with its timer result). */
    attempt: (attemptUuid: string) => `/attempts/${id(attemptUuid)}`,
    /** Backend: POST starts a WAITING attempt. */
    startAttempt: (attemptUuid: string) => `/attempts/${id(attemptUuid)}/start`,
    /** Backend: POST stops a RUNNING attempt (status FINISHED). */
    stopAttempt: (attemptUuid: string) => `/attempts/${id(attemptUuid)}/stop`,
    /** Backend: PATCH sets a manual status (TIMEOUT, DNF, RETRY, FALSE_START, DSQ). */
    attemptStatus: (attemptUuid: string) =>
      `/attempts/${id(attemptUuid)}/status`,
    /** Backend: POST records the official time of an attempt. */
    timerResult: (attemptUuid: string) =>
      `/attempts/${id(attemptUuid)}/timer-result`,
    /** Backend: PATCH changes a participant's round entry status (COMPLETED, DNS, ...). */
    roundEntry: (roundEntryUuid: string) =>
      `/round-entries/${id(roundEntryUuid)}`,
  },
  /**
   * Judging (Live Mode, Contest competitions: BEAUTY and BEST_IN_SHOW). Paths marked "backend"
   * exist in petpet-service already (routes/api/scorecards.php). The judge queue read is
   * MOCK ONLY (contract 15).
   */
  judging: {
    /** MOCK ONLY: GET criteria, participants in check-in order and the caller's scorecards. */
    judging: (competitionUuid: string) =>
      `/competitions/${id(competitionUuid)}/judging`,
    /** Backend: POST creates a DRAFT scorecard; GET lists the scorecards of a round. */
    roundScorecards: (roundUuid: string) =>
      `/rounds/${id(roundUuid)}/scorecards`,
    /** Backend: GET one scorecard; PATCH sets the judge note or status SUBMITTED. */
    scorecard: (scorecardUuid: string) => `/scorecards/${id(scorecardUuid)}`,
    /** Backend: PUT saves criterion scores (upsert per criterion). */
    criterionScores: (scorecardUuid: string) =>
      `/scorecards/${id(scorecardUuid)}/criterion-scores`,
    /** Backend: POST locks a SUBMITTED scorecard. */
    lock: (scorecardUuid: string) => `/scorecards/${id(scorecardUuid)}/lock`,
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
