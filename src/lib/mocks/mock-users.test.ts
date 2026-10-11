import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { store } from "./mock-store";
import type { MockUser } from "./mock-types";
import {
  PERMISSION_COUNT,
  assignRoleRecord,
  createUserRecord,
  deactivateUserRecord,
  getUserRecord,
  listCityRecords,
  listCountryRecords,
  listPermissionRecords,
  listProvinceRecords,
  listRoleRecords,
  listUserRecords,
  revokeRoleRecord,
  updateUserRecord,
} from "./mock-users";

const admin = store.users.find(
  (u) => u.email === "admin@petpet.dev",
) as MockUser;
const organizer = store.users.find(
  (u) => u.email === "organizer@petpet.dev",
) as MockUser;
const competitor = store.users.find(
  (u) => u.email === "competitor@petpet.dev",
) as MockUser;

const query = (params: Record<string, string> = {}) =>
  new URLSearchParams(params);

// Tes di bawah mengubah user (role, status, profil) dan menambah user baru:
// kembalikan data seed setelah tiap tes.
const snapshot = store.users.map((u) => ({
  ...u,
  roles: u.roles ? [...u.roles] : undefined,
  profile: u.profile ? { ...u.profile } : undefined,
}));
afterEach(() => {
  store.users = snapshot.map((u) => ({
    ...u,
    roles: u.roles ? [...u.roles] : undefined,
    profile: u.profile ? { ...u.profile } : undefined,
  }));
});

/** Menjalankan fungsi dan mengembalikan ApiError yang dilempar (gagal bila tidak melempar). */
function failure(run: () => unknown): ApiError {
  try {
    run();
  } catch (cause) {
    if (cause instanceof ApiError) return cause;
    throw cause;
  }
  throw new Error("Expected an ApiError");
}

const validBody = {
  username: "new.person",
  email: "new.person@example.com",
  first_name: "New",
  last_name: "Person",
  phone: "081234567890",
  roles: ["USER"],
};

/** Mengambil satu user hasil seed berdasarkan username (gagal bila tidak ada). */
function seedUser(username: string): MockUser {
  const user = store.users.find((u) => u.username === username);
  if (!user) throw new Error(`Seed user not found: ${username}`);
  return user;
}

describe("listUserRecords", () => {
  it("returns items with meta in the backend shape", () => {
    const page = listUserRecords(admin, query({ per_page: "5" }));
    expect(page.items).toHaveLength(5);
    expect(page.meta).toMatchObject({ current_page: 1, per_page: 5 });
    const first = page.items[0] as Record<string, unknown>;
    expect(Object.keys(first)).toEqual(
      expect.arrayContaining([
        "uuid",
        "username",
        "email",
        "first_name",
        "last_name",
        "phone",
        "status",
        "email_verified",
        "profile",
        "roles",
      ]),
    );
    expect(first.status).toBe("ACTIVE");
  });

  it("uses 15 rows per page when per_page is missing", () => {
    expect(listUserRecords(admin, query()).meta.per_page).toBe(15);
  });

  it("filters by q across name, username and email", () => {
    const page = listUserRecords(admin, query({ q: "alya" }));
    expect(page.items.map((u) => u.username)).toContain("alya.maulana");
    expect(page.items.every((u) => /alya/i.test(JSON.stringify(u)))).toBe(true);
  });

  it("filters by status and role", () => {
    const inactive = listUserRecords(admin, query({ status: "INACTIVE" }));
    expect(inactive.items.length).toBeGreaterThan(0);
    expect(inactive.items.every((u) => u.status === "INACTIVE")).toBe(true);
    const admins = listUserRecords(admin, query({ role: "SUPER_ADMIN" }));
    expect(admins.items.map((u) => u.email)).toEqual(["admin@petpet.dev"]);
  });

  it("filters by email, phone and city (mock only)", () => {
    expect(
      listUserRecords(admin, query({ email: "dian.kusuma" })).items,
    ).toHaveLength(1);
    expect(
      listUserRecords(admin, query({ phone: "0812111100" })).items.length,
    ).toBeGreaterThan(0);
    const surabaya = listUserRecords(admin, query({ city: "surabaya" }));
    expect(surabaya.items.length).toBeGreaterThan(0);
    expect(surabaya.items.every((u) => u.profile.city === "Surabaya")).toBe(
      true,
    );
  });

  it("sorts by name ascending by default and reverses with direction=desc", () => {
    const asc = listUserRecords(admin, query({ per_page: "100" })).items;
    const desc = listUserRecords(
      admin,
      query({ per_page: "100", direction: "desc" }),
    ).items;
    expect(desc.map((u) => u.uuid)).toEqual(asc.map((u) => u.uuid).reverse());
    const names = asc.map((u) => u.first_name.toLowerCase());
    expect(names).toEqual([...names].sort());
  });

  it("rejects an unknown status, sort or per_page with 422", () => {
    expect(
      failure(() => listUserRecords(admin, query({ status: "X" }))).status,
    ).toBe(422);
    expect(
      failure(() => listUserRecords(admin, query({ sort: "x" }))).status,
    ).toBe(422);
    expect(
      failure(() => listUserRecords(admin, query({ per_page: "101" }))).status,
    ).toBe(422);
  });

  it("is 403 for a caller without user.view, except when searching", () => {
    expect(failure(() => listUserRecords(competitor, query())).status).toBe(
      403,
    );
    expect(listUserRecords(organizer, query({ q: "dian" })).items.length).toBe(
      1,
    );
  });
});

describe("getUserRecord", () => {
  it("returns one user, 404 when missing, 403 without user.view", () => {
    const user = seedUser("alya.maulana");
    expect(getUserRecord(admin, user.uuid).username).toBe("alya.maulana");
    expect(failure(() => getUserRecord(admin, "nope")).status).toBe(404);
    expect(failure(() => getUserRecord(competitor, user.uuid)).status).toBe(
      403,
    );
  });
});

describe("createUserRecord", () => {
  it("creates an unverified ACTIVE user with the given roles", () => {
    const created = createUserRecord(admin, validBody);
    expect(created).toMatchObject({
      username: "new.person",
      status: "ACTIVE",
      email_verified: false,
    });
    expect(created.roles?.map((r) => r.code)).toEqual(["USER"]);
    expect(getUserRecord(admin, created.uuid).email).toBe(
      "new.person@example.com",
    );
  });

  it("returns 422 with a message per invalid field", () => {
    const error = failure(() => createUserRecord(admin, { roles: ["NOPE"] }));
    expect(error.status).toBe(422);
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining(["username", "email", "first_name", "roles"]),
    );
  });

  it("rejects a taken username or email (case-insensitive)", () => {
    const error = failure(() =>
      createUserRecord(admin, {
        ...validBody,
        username: "ADMIN",
        email: "Admin@petpet.dev",
      }),
    );
    expect(error.errors?.username).toBeDefined();
    expect(error.errors?.email).toBeDefined();
  });

  it("is 403 without user.manage", () => {
    expect(failure(() => createUserRecord(competitor, validBody)).status).toBe(
      403,
    );
  });
});

describe("updateUserRecord", () => {
  it("updates name, phone and profile, and keeps username and email", () => {
    const user = seedUser("alya.maulana");
    const updated = updateUserRecord(admin, user.uuid, {
      first_name: "Alya2",
      phone: "081299990000",
      gender: "FEMALE",
      city: "Bandung",
      province: "Jawa Barat",
      username: "ignored",
    });
    expect(updated).toMatchObject({
      first_name: "Alya2",
      phone: "081299990000",
      username: "alya.maulana",
    });
    expect(updated.profile).toMatchObject({
      city: "Bandung",
      gender: "FEMALE",
    });
  });

  it("lets an emptied field stay empty instead of falling back to the sample data", () => {
    const user = seedUser("alya.maulana");
    expect(getUserRecord(admin, user.uuid).profile.city).toBe("Malang");
    const updated = updateUserRecord(admin, user.uuid, { city: null });
    expect(updated.profile.city).toBeNull();
  });

  it("rejects an invalid gender and an empty first name with 422", () => {
    const user = seedUser("alya.maulana");
    expect(
      failure(() => updateUserRecord(admin, user.uuid, { gender: "X" })).errors
        ?.gender,
    ).toBeDefined();
    expect(
      failure(() => updateUserRecord(admin, user.uuid, { first_name: "" }))
        .errors?.first_name,
    ).toBeDefined();
  });

  it("is 403 for a caller without user.manage", () => {
    const user = seedUser("alya.maulana");
    expect(
      failure(() =>
        updateUserRecord(competitor, user.uuid, { first_name: "X" }),
      ).status,
    ).toBe(403);
  });
});

describe("deactivateUserRecord", () => {
  it("sets SUSPENDED and keeps the row", () => {
    const user = seedUser("alya.maulana");
    expect(deactivateUserRecord(admin, user.uuid)).toBeNull();
    expect(getUserRecord(admin, user.uuid).status).toBe("SUSPENDED");
  });

  it("refuses to deactivate yourself with 422", () => {
    const error = failure(() => deactivateUserRecord(admin, admin.uuid));
    expect(error.status).toBe(422);
    expect(error.message).toBe("You cannot deactivate your own account.");
  });

  it("is 404 for a missing user and 403 without user.manage", () => {
    expect(failure(() => deactivateUserRecord(admin, "nope")).status).toBe(404);
    expect(
      failure(() => deactivateUserRecord(competitor, admin.uuid)).status,
    ).toBe(403);
  });
});

describe("assign and revoke role", () => {
  it("assigns a role, idempotently, and returns the user with roles", () => {
    const user = seedUser("alya.maulana");
    const first = assignRoleRecord(admin, user.uuid, { role: "JUDGE" });
    expect(first.roles?.map((r) => r.code).sort()).toEqual(["JUDGE", "USER"]);
    const again = assignRoleRecord(admin, user.uuid, { role: "JUDGE" });
    expect(again.roles).toHaveLength(2);
  });

  it("gives the new role's permissions in /auth/me terms (mockAccess)", async () => {
    const { mockAccess } = await import("./mock-access");
    const user = seedUser("alya.maulana");
    assignRoleRecord(admin, user.uuid, { role: "JUDGE" });
    expect(mockAccess(user).permissions).toContain("scoring.input");
  });

  it("revokes a role", () => {
    const user = seedUser("alya.maulana");
    assignRoleRecord(admin, user.uuid, { role: "JUDGE" });
    const revoked = revokeRoleRecord(admin, user.uuid, "JUDGE");
    expect(revoked.roles?.map((r) => r.code)).toEqual(["USER"]);
  });

  it("returns 422 for an unknown role on assign and 404 on revoke", () => {
    const user = seedUser("alya.maulana");
    expect(
      failure(() => assignRoleRecord(admin, user.uuid, { role: "NOPE" })).errors
        ?.role,
    ).toBeDefined();
    expect(failure(() => assignRoleRecord(admin, user.uuid, {})).status).toBe(
      422,
    );
    expect(
      failure(() => revokeRoleRecord(admin, user.uuid, "NOPE")).status,
    ).toBe(404);
  });

  it("cannot revoke SUPER_ADMIN from the last active super admin (422)", () => {
    const error = failure(() =>
      revokeRoleRecord(admin, admin.uuid, "SUPER_ADMIN"),
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe("The last super admin cannot be removed.");
  });
});

describe("roles and permissions", () => {
  it("lists all six roles with permissions and users_count", () => {
    const { items } = listRoleRecords();
    expect(items.map((r) => r.code).sort()).toEqual([
      "EVENT_PIC",
      "JUDGE",
      "ORGANIZATION_OWNER",
      "ORGANIZER",
      "SUPER_ADMIN",
      "USER",
    ]);
    // Urut nama seperti backend: Event PIC lebih dulu dari Super Admin.
    expect(items[0].code).toBe("EVENT_PIC");
    const superAdmin = items.find((r) => r.code === "SUPER_ADMIN");
    expect(superAdmin?.permissions).toHaveLength(PERMISSION_COUNT);
    expect(superAdmin?.users_count).toBe(1);
    expect(items.find((r) => r.code === "USER")?.permissions).toHaveLength(4);
  });

  it("groups permissions by module, and needs user.view", () => {
    const groups = listPermissionRecords(admin);
    expect(Object.keys(groups)[0]).toBe("competition");
    expect(groups.event.map((p) => p.code)).toEqual([
      "event.create",
      "event.delete",
      "event.publish",
      "event.update",
      "event.view",
    ]);
    expect(Object.values(groups).flat()).toHaveLength(PERMISSION_COUNT);
    expect(failure(() => listPermissionRecords(competitor)).status).toBe(403);
  });
});

describe("regions", () => {
  it("serves countries, provinces and cities as plain arrays", () => {
    const [country] = listCountryRecords();
    expect(country.code).toBe("ID");
    const provinces = listProvinceRecords(query({ country_id: country.uuid }));
    const jatim = provinces.find((p) => p.name === "Jawa Timur");
    expect(jatim).toBeDefined();
    const cities = listCityRecords(query({ province_id: jatim?.uuid ?? "" }));
    expect(cities.map((c) => c.name)).toEqual(["Malang", "Surabaya"]);
  });

  it("is 404 for an unknown country or province", () => {
    expect(
      failure(() => listProvinceRecords(query({ country_id: "x" }))).status,
    ).toBe(404);
    expect(failure(() => listCityRecords(query())).status).toBe(404);
  });
});
