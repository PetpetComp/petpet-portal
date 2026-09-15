import { afterEach, describe, expect, it, vi } from "vitest";
import { collectRows } from "./common";
import { USER_SERVICES } from "./user-management";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  mapRecord,
  recordPayload,
  saveRecord,
  deleteRecord,
} from "./backend-records";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("backend record contracts", () => {
  it("maps UUIDs, nested profiles and enum values to UI records", () => {
    const user = mapRecord("users", {
      uuid: "u1",
      first_name: "Lifta",
      last_name: "Annisa",
      status: "ACTIVE",
      profile: { date_of_birth: "2000-01-02", gender: "FEMALE" },
      roles: [{ code: "ADMIN" }],
    });
    expect(user).toMatchObject({
      id: "u1",
      name: "Lifta Annisa",
      dob: "2000-01-02",
      gender: "Female",
      status: "Active",
      roles: "ADMIN",
    });
    expect(
      mapRecord(
        "registrations",
        {
          uuid: "r1",
          competition_uuid: "c1",
          owner_uuid: "u1",
          pet_uuid: "p1",
          payment_status: "UNPAID",
        },
        { eventId: "e1" },
      ),
    ).toMatchObject({
      competitionId: "c1",
      petId: "p1",
      eventId: "e1",
      paymentStatus: "Unpaid",
    });
  });
  it("sends only documented fields and preserves numeric zero", () => {
    expect(
      recordPayload(
        "pets",
        {
          id: "",
          name: "Pet",
          speciesId: "species",
          photo: "ignored",
          weight: "0",
          heightLength: "12.5",
          gender: "Female",
        },
        false,
      ),
    ).toEqual({
      name: "Pet",
      species_id: "species",
      weight_grams: 0,
      height_cm: 12.5,
      gender: "FEMALE",
    });
    expect(() =>
      recordPayload("pets", { id: "", name: "Pet", weight: "11 kg" }, true),
    ).toThrow("non-negative number");
  });
  it("keeps immutable fields out of updates and supports clearing optional values", () => {
    expect(
      recordPayload(
        "users",
        {
          id: "user",
          name: "A",
          firstName: "A",
          email: "no-change@example.test",
          username: "no-change",
          phone: "",
          dob: "2000-01-01",
        },
        true,
      ),
    ).toEqual({ first_name: "A", phone: null, date_of_birth: "2000-01-01" });
  });
  it("uses real organization creation and retains an explicit timezone offset", () => {
    expect(
      recordPayload(
        "events",
        {
          id: "",
          name: "Show",
          newOrganizationName: "Pet Club",
          startDate: "2026-09-20T10:00:00+07:00",
        },
        false,
      ),
    ).toEqual({
      name: "Show",
      start_at: "2026-09-20T03:00:00.000Z",
      new_organization: { name: "Pet Club" },
    });
    expect(() =>
      recordPayload("events", { id: "", name: "Show" }, false),
    ).toThrow("organization");
  });
  it("loads all pages using snake_case pagination metadata", async () => {
    const get = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: { items: [{ uuid: "1" }], meta: { last_page: 2 } },
      })
      .mockResolvedValueOnce({
        data: { items: [{ uuid: "2" }], meta: { last_page: 2 } },
      });
    expect(await collectRows(USER_SERVICES.list)).toEqual([
      { uuid: "1" },
      { uuid: "2" },
    ]);
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      "/users?per_page=100&page=1",
      "/users?per_page=100&page=2",
    ]);
  });
  it("uses the server UUID after creation and propagates failed saves", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: { uuid: "server-id", brand_name: "Brand" },
    });
    expect(
      await saveRecord("brands", { id: "", name: "Brand" }, false),
    ).toMatchObject({ id: "server-id", name: "Brand" });
    expect(post).toHaveBeenCalledWith("/sponsors", { brand_name: "Brand" });
    post.mockRejectedValueOnce(new ApiError(422, "Name is required."));
    await expect(
      saveRecord("brands", { id: "", name: "" }, false),
    ).rejects.toThrow("Name is required.");
  });
  it("does not fake unsupported delete or registration update operations", async () => {
    const del = vi.spyOn(apiClient, "delete");
    await expect(
      deleteRecord("brands", { id: "brand", name: "Brand" }),
    ).rejects.toThrow("not supported");
    expect(del).not.toHaveBeenCalled();
    await expect(
      saveRecord("registrations", { id: "entry", name: "Entry" }, true),
    ).rejects.toThrow("not supported");
  });
  it("surfaces backend validation errors and handles empty deletes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Invalid.",
            errors: { email: ["Email already exists."] },
          }),
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      apiClient.post("/users", { email: "test@example.test" }),
    ).rejects.toThrow("Email already exists.");
    await expect(apiClient.delete("/users/1")).resolves.toBeUndefined();
  });
});
