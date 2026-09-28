import { ApiError } from "@/lib/api-client";
import { store, paginate, findOrThrow, nextUuid, DEMO_PASSWORD } from "./mock-store";
import type { MockUser } from "./mock-types";

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
    roles: [] as { code: string; name: string }[],
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
      const user = store.users.find((item) => item.email.toLowerCase() === email);
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
    handler: (_params, _body, query) => paginate(store.users.map(userRecord), query),
  },
  {
    method: "GET",
    pattern: "/users/:uuid",
    handler: (params) => userRecord(findOrThrow(store.users, params.uuid, "User")),
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
];

export function currentMockUser(): MockUser | null {
  return currentSessionUserUuid
    ? (store.users.find((item) => item.uuid === currentSessionUserUuid) ?? null)
    : null;
}

export { routes as mockRoutes, matchPath, requireSession };
