import { ApiError } from "@/lib/api-client";
import {
  store,
  paginate,
  findOrThrow,
  nextUuid,
  DEMO_PASSWORD,
} from "./mock-store";
import type { MockUser } from "./mock-types";
import { mockAccess } from "./mock-access";

function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index++) {
    const segment = patternSegments[index];
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = decodeURIComponent(pathSegments[index]);
    } else if (segment !== pathSegments[index]) {
      return null;
    }
  }
  return params;
}

function userRecord(user: MockUser) {
  return {
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name ?? null,
    phone: user.phone ?? null,
    status: user.status,
    ...mockAccess(user),
  };
}

let currentSessionUserUuid: string | null = null;

function requireSession(): MockUser {
  if (!currentSessionUserUuid)
    throw new ApiError(401, "Session expired. Please sign in again.");
  return findOrThrow(store.users, currentSessionUserUuid, "User");
}

type Route = {
  method: string;
  pattern: string;
  handler: (
    params: Record<string, string>,
    body: Record<string, unknown> | undefined,
    query: URLSearchParams,
  ) => unknown;
};

const routes: Route[] = [
  {
    method: "POST",
    pattern: "/auth/login",
    handler: (_params, body) => {
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(body?.password ?? "");
      const user = store.users.find(
        (item) => item.email.toLowerCase() === email,
      );
      if (!user || user.password !== password)
        throw new ApiError(401, "Invalid email or password.");
      currentSessionUserUuid = user.uuid;
      return {
        access_token: "mock." + nextUuid(),
        token_type: "Bearer",
        expires_in: 60 * 60 * 8,
        user: userRecord(user),
      };
    },
  },
  {
    method: "POST",
    pattern: "/auth/register",
    handler: (_params, body) => {
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      if (store.users.some((item) => item.email.toLowerCase() === email))
        throw new ApiError(422, "That email is already registered.");
      const user: MockUser = {
        uuid: nextUuid(),
        username: String(body?.username ?? email.split("@")[0]),
        email,
        password: String(body?.password ?? DEMO_PASSWORD),
        first_name: String(body?.first_name ?? "New"),
        last_name: body?.last_name ? String(body.last_name) : undefined,
        status: "Active",
      };
      store.users.push(user);
      currentSessionUserUuid = user.uuid;
      return {
        access_token: "mock." + nextUuid(),
        token_type: "Bearer",
        expires_in: 60 * 60 * 8,
        user: userRecord(user),
      };
    },
  },
  {
    method: "GET",
    pattern: "/auth/me",
    handler: () => userRecord(requireSession()),
  },
  {
    method: "POST",
    pattern: "/auth/logout",
    handler: () => {
      currentSessionUserUuid = null;
      return null;
    },
  },
  { method: "GET", pattern: "/auth/roles", handler: () => [] },
  { method: "GET", pattern: "/auth/permissions", handler: () => [] },
  {
    method: "GET",
    pattern: "/users",
    handler: (_params, _body, query) =>
      paginate(store.users.map(userRecord), query),
  },
  {
    method: "GET",
    pattern: "/users/:uuid",
    handler: (params) =>
      userRecord(findOrThrow(store.users, params.uuid, "User")),
  },
  {
    method: "GET",
    pattern: "/pets",
    handler: (_params, _body, query) => paginate(store.pets, query),
  },
  {
    method: "GET",
    pattern: "/pets/:uuid",
    handler: (params) => findOrThrow(store.pets, params.uuid, "Pet"),
  },
  {
    method: "POST",
    pattern: "/pets",
    handler: (_params, body) => {
      const owner = requireSession();
      const pet = {
        uuid: nextUuid(),
        owner_uuid: owner.uuid,
        name: String(body?.name ?? ""),
        species_id: body?.species_id ? String(body.species_id) : undefined,
        status: "Active",
        ...body,
      };
      store.pets.push(pet as (typeof store.pets)[number]);
      return pet;
    },
  },
  {
    method: "PATCH",
    pattern: "/pets/:uuid",
    handler: (params, body) => {
      const pet = findOrThrow(store.pets, params.uuid, "Pet");
      Object.assign(pet, body);
      return pet;
    },
  },
  {
    method: "DELETE",
    pattern: "/pets/:uuid",
    handler: (params) => {
      store.pets = store.pets.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
  {
    method: "GET",
    pattern: "/organizations",
    handler: (_params, _body, query) => paginate(store.organizations, query),
  },
  {
    method: "POST",
    pattern: "/organizations",
    handler: (_params, body) => {
      const owner = requireSession();
      const org = {
        uuid: nextUuid(),
        name: String(body?.name ?? ""),
        email: body?.email ? String(body.email) : undefined,
        phone: body?.phone ? String(body.phone) : undefined,
        address: body?.address ? String(body.address) : undefined,
        pics: [
          { uuid: nextUuid(), name: owner.first_name, user_uuid: owner.uuid },
        ],
      };
      store.organizations.push(org);
      return org;
    },
  },
  {
    method: "GET",
    pattern: "/organizations/:uuid",
    handler: (params) =>
      findOrThrow(store.organizations, params.uuid, "Organization"),
  },
  {
    method: "PATCH",
    pattern: "/organizations/:uuid",
    handler: (params, body) => {
      const org = findOrThrow(store.organizations, params.uuid, "Organization");
      const { pic_ids, ...rest } = body ?? {};
      Object.assign(org, rest);
      if (Array.isArray(pic_ids)) {
        org.pics = pic_ids.map((userId) => {
          const existing = org.pics.find((pic) => pic.user_uuid === userId);
          if (existing) return existing;
          const user = store.users.find((item) => item.uuid === userId);
          return {
            uuid: nextUuid(),
            name: user?.first_name ?? "PIC",
            user_uuid: String(userId),
          };
        });
      }
      return org;
    },
  },
  {
    method: "GET",
    pattern: "/events",
    handler: (_params, _body, query) => {
      const organizationId = query.get("organization_id");
      const filtered = organizationId
        ? store.events.filter(
            (event) => event.organization_uuid === organizationId,
          )
        : store.events;
      return paginate(filtered, query);
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid",
    handler: (params) => findOrThrow(store.events, params.uuid, "Event"),
  },
  {
    method: "POST",
    pattern: "/events",
    handler: (_params, body) => {
      const owner = requireSession();
      let organizationUuid = body?.organization_id
        ? String(body.organization_id)
        : "";
      const newOrganization = body?.new_organization as
        | { name?: string; email?: string; phone?: string; address?: string }
        | undefined;
      if (!organizationUuid && newOrganization?.name) {
        organizationUuid = nextUuid();
        store.organizations.push({
          uuid: organizationUuid,
          name: newOrganization.name,
          email: newOrganization.email,
          phone: newOrganization.phone,
          address: newOrganization.address,
          pics: [
            { uuid: nextUuid(), name: owner.first_name, user_uuid: owner.uuid },
          ],
        });
      }
      if (!organizationUuid)
        throw new ApiError(
          422,
          "Choose an organization or enter a new organization name.",
        );
      const event = {
        uuid: nextUuid(),
        organization_uuid: organizationUuid,
        name: String(body?.name ?? ""),
        status: "Draft",
        ...body,
      };
      store.events.push(event as (typeof store.events)[number]);
      return event;
    },
  },
  {
    method: "PATCH",
    pattern: "/events/:uuid",
    handler: (params, body) => {
      const event = findOrThrow(store.events, params.uuid, "Event");
      Object.assign(event, body);
      return event;
    },
  },
  {
    method: "DELETE",
    pattern: "/events/:uuid",
    handler: (params) => {
      store.events = store.events.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
  {
    method: "POST",
    pattern: "/events/:uuid/publish",
    handler: (params) => {
      const event = findOrThrow(store.events, params.uuid, "Event");
      event.status = "Published";
      return event;
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid/competitions",
    handler: (params, _body, query) =>
      paginate(
        store.competitions.filter((item) => item.event_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/competitions",
    handler: (params, body) => {
      const competition = {
        uuid: nextUuid(),
        event_uuid: params.uuid,
        name: String(body?.name ?? ""),
        registration_closed_at: null,
        status: "Open",
        ...body,
        // The real API answers with *_uuid keys for what it receives as *_id.
        competition_type_uuid: body?.competition_type_id as string | undefined,
        species_uuid: body?.species_id as string | undefined,
      };
      store.competitions.push(
        competition as (typeof store.competitions)[number],
      );
      return competition;
    },
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid",
    handler: (params) =>
      findOrThrow(store.competitions, params.uuid, "Competition"),
  },
  {
    method: "PATCH",
    pattern: "/competitions/:uuid",
    handler: (params, body) => {
      const competition = findOrThrow(
        store.competitions,
        params.uuid,
        "Competition",
      );
      Object.assign(competition, body);
      return competition;
    },
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/close-registration",
    handler: (params) => {
      const competition = findOrThrow(
        store.competitions,
        params.uuid,
        "Competition",
      );
      competition.registration_closed_at = new Date().toISOString();
      return competition;
    },
  },
  // Staff/committee assignments aren't modeled in this demo phase; these
  // three read endpoints return an empty list instead of a generic 404 so
  // the portal's "some data could not be loaded" banner doesn't fire on
  // every page for a feature that simply has nothing to show yet.
  {
    method: "GET",
    pattern: "/staff-invitations",
    handler: (_params, _body, query) => paginate([], query),
  },
  {
    method: "GET",
    pattern: "/master/competition-types",
    // The real API returns master data as a plain array, not a page.
    handler: () => store.competitionTypes,
  },
  {
    method: "GET",
    pattern: "/master/species",
    handler: () => store.species,
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/registration-periods",
    handler: (params, _body, query) =>
      paginate(
        store.registrationPeriods.filter(
          (p) => p.competition_uuid === params.uuid,
        ),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/registration-periods",
    handler: (params, body) => {
      const period = {
        uuid: nextUuid(),
        competition_uuid: params.uuid,
        ...body,
      };
      store.registrationPeriods.push(period);
      return period;
    },
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/score-criteria",
    handler: (params, _body, query) =>
      paginate(
        store.scoreCriteria.filter((c) => c.competition_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/score-criteria",
    handler: (params, body) => {
      const criterion = {
        uuid: nextUuid(),
        competition_uuid: params.uuid,
        ...body,
      };
      store.scoreCriteria.push(criterion);
      return criterion;
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid/staff",
    handler: (_params, _body, query) => paginate([], query),
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/staff",
    handler: (_params, _body, query) => paginate([], query),
  },
  {
    method: "GET",
    pattern: "/sponsors",
    handler: (_params, _body, query) => paginate(store.sponsors, query),
  },
  {
    method: "GET",
    pattern: "/sponsors/:uuid",
    handler: (params) => findOrThrow(store.sponsors, params.uuid, "Sponsor"),
  },
  {
    method: "POST",
    pattern: "/sponsors",
    handler: (_params, body) => {
      const sponsor = {
        uuid: nextUuid(),
        brand_name: String(body?.brand_name ?? ""),
        status: "Active",
        pics: [] as { uuid: string; name: string; user_uuid: string }[],
        ...body,
      };
      store.sponsors.push(sponsor as (typeof store.sponsors)[number]);
      return sponsor;
    },
  },
  {
    method: "PATCH",
    pattern: "/sponsors/:uuid",
    handler: (params, body) => {
      const sponsor = findOrThrow(store.sponsors, params.uuid, "Sponsor");
      Object.assign(sponsor, body);
      return sponsor;
    },
  },
  {
    method: "POST",
    pattern: "/sponsors/:uuid/pics",
    handler: (params, body) => {
      const sponsor = findOrThrow(store.sponsors, params.uuid, "Sponsor");
      const user = findOrThrow(
        store.users,
        String(body?.user_id ?? ""),
        "User",
      );
      sponsor.pics.push({
        uuid: nextUuid(),
        name: user.first_name,
        user_uuid: user.uuid,
      });
      return sponsor;
    },
  },
  {
    method: "DELETE",
    pattern: "/sponsors/:uuid/pics/:userId",
    handler: (params) => {
      const sponsor = findOrThrow(store.sponsors, params.uuid, "Sponsor");
      sponsor.pics = sponsor.pics.filter(
        (pic) => pic.user_uuid !== params.userId,
      );
      return null;
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid/sponsors",
    handler: (params, _body, query) =>
      paginate(
        store.eventSponsors.filter((item) => item.event_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/sponsors",
    handler: (params, body) => {
      const link = {
        uuid: nextUuid(),
        event_uuid: params.uuid,
        sponsor_uuid: String(body?.sponsor_id ?? ""),
        sponsorship_level: String(body?.sponsorship_level ?? "BRONZE"),
        campaign_text: body?.campaign_text
          ? String(body.campaign_text)
          : undefined,
        status: "pending" as const,
      };
      store.eventSponsors.push(link);
      return link;
    },
  },
  {
    method: "DELETE",
    pattern: "/events/:eventId/sponsors/:linkId",
    handler: (params) => {
      store.eventSponsors = store.eventSponsors.filter(
        (item) => item.uuid !== params.linkId,
      );
      return null;
    },
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/entries",
    handler: (params, _body, query) =>
      paginate(
        store.entries.filter((item) => item.competition_uuid === params.uuid),
        query,
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/entries",
    handler: (params, body) => {
      const owner = requireSession();
      const entry = {
        uuid: nextUuid(),
        competition_uuid: params.uuid,
        owner_uuid: owner.uuid,
        payment_status: "Pending",
        checkin_status: "Pending",
        status: "Pending",
        ...body,
      };
      store.entries.push(entry as (typeof store.entries)[number]);
      return entry;
    },
  },
  {
    method: "DELETE",
    pattern: "/entries/:uuid",
    handler: (params) => {
      store.entries = store.entries.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/approve",
    handler: (params) => {
      const entry = findOrThrow(store.entries, params.uuid, "Entry");
      entry.status = "Approved";
      return entry;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/reject",
    handler: (params) => {
      const entry = findOrThrow(store.entries, params.uuid, "Entry");
      entry.status = "Rejected";
      return entry;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/checkin",
    handler: (params) => {
      const entry = findOrThrow(store.entries, params.uuid, "Entry");
      entry.checkin_status = "Checked in";
      return entry;
    },
  },
];

export function currentMockUser(): MockUser | null {
  return currentSessionUserUuid
    ? (store.users.find((item) => item.uuid === currentSessionUserUuid) ?? null)
    : null;
}

export { routes as mockRoutes, matchPath, requireSession };

export async function mockRequest<T>(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const [path, search] = endpoint.split("?");
  const query = new URLSearchParams(search ?? "");
  const route = routes.find(
    (candidate) =>
      candidate.method === method &&
      matchPath(candidate.pattern, path) !== null,
  );
  if (!route) throw new ApiError(404, "Not available in demo mode.");
  const params = matchPath(route.pattern, path) ?? {};
  const data = route.handler(params, body, query);
  return { success: true, message: "OK", data } as T;
}
