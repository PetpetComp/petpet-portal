import { describe, expect, it } from "vitest";
import {
  permissionGroupsFromApi,
  roleFromApi,
  userFromApi,
  userListParams,
  userPageFromApi,
  type ApiUser,
} from "./types";

const apiUser: ApiUser = {
  uuid: "u1",
  username: "salsa.putri",
  email: "salsa.putri@example.com",
  first_name: "Salsa",
  last_name: "Putri",
  phone: "081234567802",
  status: "ACTIVE",
  email_verified: true,
  profile: {
    date_of_birth: null,
    gender: "FEMALE",
    address: null,
    city: "Surabaya",
    province: "Jawa Timur",
    nation: null,
    postal_code: null,
  },
  roles: [{ uuid: "r1", code: "USER", name: "User" }],
};

describe("userFromApi", () => {
  it("maps snake_case to the screen shape", () => {
    expect(userFromApi(apiUser)).toEqual({
      id: "u1",
      username: "salsa.putri",
      email: "salsa.putri@example.com",
      firstName: "Salsa",
      lastName: "Putri",
      name: "Salsa Putri",
      initials: "SP",
      phone: "081234567802",
      status: "ACTIVE",
      emailVerified: true,
      gender: "FEMALE",
      address: "",
      city: "Surabaya",
      province: "Jawa Timur",
      roles: [{ id: "r1", code: "USER", name: "User" }],
    });
  });

  it("copes with nulls, missing roles and unknown values", () => {
    const user = userFromApi({
      ...apiUser,
      last_name: null,
      phone: null,
      status: "weird",
      roles: undefined,
      profile: { ...apiUser.profile, gender: "OTHER", city: null },
    });
    expect(user).toMatchObject({
      name: "Salsa",
      phone: "",
      status: "INACTIVE",
      gender: "",
      city: "",
      roles: [],
    });
  });

  it("reads the capitalised status the old mock data used", () => {
    expect(userFromApi({ ...apiUser, status: "Active" }).status).toBe("ACTIVE");
  });

  it("falls back to the username when the name is empty", () => {
    const user = userFromApi({ ...apiUser, first_name: "", last_name: null });
    expect(user.name).toBe("salsa.putri");
    expect(user.initials).toBe("S");
  });
});

describe("userPageFromApi", () => {
  it("maps items and meta", () => {
    const page = userPageFromApi({
      items: [apiUser],
      meta: { current_page: 2, per_page: 8, total: 11, last_page: 2 },
    });
    expect(page.items[0].id).toBe("u1");
    expect(page.meta).toEqual({
      currentPage: 2,
      perPage: 8,
      total: 11,
      lastPage: 2,
    });
  });
});

describe("userListParams", () => {
  it("maps names to API params and trims text", () => {
    expect(
      userListParams({
        q: "  sal ",
        email: " a@b ",
        status: "ACTIVE",
        role: "ORGANIZER",
        sort: "email",
        direction: "desc",
        page: 2,
        perPage: 16,
      }),
    ).toEqual({
      q: "sal",
      email: "a@b",
      phone: undefined,
      city: undefined,
      status: "ACTIVE",
      role: "ORGANIZER",
      sort: "email",
      direction: "desc",
      page: 2,
      per_page: 16,
    });
  });
});

describe("roles and permissions mappers", () => {
  it("keeps permissions and users_count optional", () => {
    expect(
      roleFromApi({ uuid: "r", code: "USER", name: "User", description: null }),
    ).toEqual({
      id: "r",
      code: "USER",
      name: "User",
      description: "",
      permissions: null,
      usersCount: null,
    });
    expect(
      roleFromApi({
        uuid: "r",
        code: "USER",
        name: "User",
        description: "x",
        permissions: ["event.view"],
        users_count: 3,
      }),
    ).toMatchObject({ permissions: ["event.view"], usersCount: 3 });
  });

  it("turns the module object into an ordered list", () => {
    expect(
      permissionGroupsFromApi({
        event: [{ code: "event.view", name: "View Events", description: null }],
      }),
    ).toEqual([
      {
        module: "event",
        permissions: [
          { code: "event.view", name: "View Events", description: "" },
        ],
      },
    ]);
  });
});
