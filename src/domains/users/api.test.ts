import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { createUser, listPermissionGroups, listProvinces } from "./api";
import { EMPTY_USER_FORM, createUserFormSchema } from "./schema";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const respond = (data: unknown) => ({ success: true, message: "OK", data });

const apiUser = {
  uuid: "u1",
  username: "salsa",
  email: "salsa@example.com",
  first_name: "Salsa",
  last_name: null,
  phone: "081234567802",
  status: "ACTIVE",
  email_verified: false,
  profile: {
    date_of_birth: null,
    gender: null,
    address: null,
    city: null,
    province: null,
    nation: null,
    postal_code: null,
  },
  roles: [],
};

/** Isi form yang sudah lolos zod, dengan isian tambahan `extra`. */
const input = (extra: object = {}) =>
  createUserFormSchema("create").parse({
    ...EMPTY_USER_FORM,
    firstName: "Salsa",
    username: "salsa",
    email: "salsa@example.com",
    phone: "081234567802",
    ...extra,
  });

beforeEach(() => vi.resetAllMocks());

describe("createUser", () => {
  it("makes one request when there is no profile input", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiUser));
    const result = await createUser(input());
    expect(apiClient.post).toHaveBeenCalledWith("/users", {
      username: "salsa",
      email: "salsa@example.com",
      first_name: "Salsa",
      phone: "081234567802",
      roles: ["USER"],
    });
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(result.profileError).toBeNull();
    expect(result.user.id).toBe("u1");
  });

  it("saves gender, province and city with a PATCH right after", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiUser));
    vi.mocked(apiClient.patch).mockResolvedValue(
      respond({
        ...apiUser,
        profile: { ...apiUser.profile, city: "Surabaya" },
      }),
    );
    const result = await createUser(
      input({ gender: "FEMALE", province: "Jawa Timur", city: "Surabaya" }),
    );
    expect(apiClient.patch).toHaveBeenCalledWith("/users/u1", {
      gender: "FEMALE",
      province: "Jawa Timur",
      city: "Surabaya",
    });
    expect(result.user.city).toBe("Surabaya");
    expect(result.profileError).toBeNull();
  });

  it("keeps the new user when the PATCH fails and reports why", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiUser));
    vi.mocked(apiClient.patch).mockRejectedValue(new Error("Server down"));
    const result = await createUser(input({ city: "Surabaya" }));
    expect(result.user.id).toBe("u1");
    expect(result.profileError).toBe("Server down");
  });

  it("lets a failing POST reach the caller", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("422"));
    await expect(createUser(input())).rejects.toThrow("422");
  });
});

describe("listProvinces", () => {
  it("looks the country up by code, then loads its provinces", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === "/master/countries")
        return respond([
          { uuid: "c-us", code: "US", name: "United States" },
          { uuid: "c-id", code: "ID", name: "Indonesia" },
        ]);
      if (url === "/master/provinces?country_id=c-id")
        return respond([{ uuid: "p1", code: "35", name: "Jawa Timur" }]);
      throw new Error(`Unexpected GET ${url}`);
    });
    expect(await listProvinces()).toEqual([{ id: "p1", name: "Jawa Timur" }]);
  });

  it("returns an empty list when the country is not in the master data", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(respond([]));
    expect(await listProvinces()).toEqual([]);
  });
});

describe("listPermissionGroups", () => {
  it("orders the modules like the design", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      respond({
        user: [{ code: "user.view", name: "View Users", description: null }],
        event: [{ code: "event.view", name: "View Events", description: null }],
      }),
    );
    const groups = await listPermissionGroups();
    expect(groups.map((g) => g.module)).toEqual(["event", "user"]);
  });
});
