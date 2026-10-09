import { afterEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  mapOrganization,
  organizationPayload,
  ORGANIZATION_SERVICES,
} from "./organization";

afterEach(() => vi.restoreAllMocks());
const draft = {
  name: " ScaleCare ",
  campaign: " Campaign ",
  picIds: ["u1", "u2"],
  photo: "",
};

it("submits multipart photo bytes and every selected PIC", async () => {
  const post = vi
    .spyOn(apiClient, "postForm")
    .mockResolvedValue({ success: true, data: { uuid: "saved" } });
  await ORGANIZATION_SERVICES.create({
    ...draft,
    photo: "data:image/png;base64,aGVsbG8=",
  });
  const [url, payload] = post.mock.calls[0];
  expect(url).toBe("/organizations");
  expect(payload.get("name")).toBe("ScaleCare");
  expect(payload.get("campaign")).toBe("Campaign");
  expect(payload.getAll("pic_ids[]")).toEqual(["u1", "u2"]);
  const photo = payload.get("photo") as File;
  expect(photo.type).toBe("image/png");
  expect(photo.size).toBe(5);
  expect(payload.has("_method")).toBe(false);
});

it("preserves an existing photo URL during update and explicitly removes a cleared photo", () => {
  const preserved = organizationPayload(
    { ...draft, photo: "https://photos.example/photo.png" },
    true,
  );
  expect(preserved.get("_method")).toBe("PATCH");
  expect(preserved.has("photo")).toBe(false);
  expect(preserved.has("remove_photo")).toBe(false);
  expect(organizationPayload(draft, true).get("remove_photo")).toBe("1");
});

it("uses the server UUID endpoint and propagates save failures", async () => {
  const post = vi
    .spyOn(apiClient, "postForm")
    .mockRejectedValue(new Error("Permission denied"));
  await expect(ORGANIZATION_SERVICES.update("org/id", draft)).rejects.toThrow(
    "Permission denied",
  );
  expect(post.mock.calls[0][0]).toBe("/organizations/org%2Fid");
});

it("maps saved photo, campaign and PIC identities without generating IDs", () => {
  expect(
    mapOrganization({
      uuid: "org-server",
      name: "ScaleCare",
      campaign: "Care",
      photo_url: "https://photos.example/logo.png",
      pics: [{ uuid: "pic-server", name: "Citra" }],
    }),
  ).toEqual({
    id: "org-server",
    name: "ScaleCare",
    campaign: "Care",
    photo: "https://photos.example/logo.png",
    pics: [{ id: "pic-server", name: "Citra" }],
  });
});

it("rejects unsupported photo data before sending a request", () => {
  expect(() =>
    organizationPayload({
      ...draft,
      photo: "data:image/svg+xml;base64,aGVsbG8=",
    }),
  ).toThrow("Choose a PNG");
});
