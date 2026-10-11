import { describe, expect, it } from "vitest";
import {
  brandListParams,
  brandPageFromApi,
  brandStatusLabel,
  cardContactLines,
  fromApi,
  isBrandActive,
  type ApiBrand,
} from "./types";

const apiBrand = (over: Partial<ApiBrand> = {}): ApiBrand => ({
  uuid: "b1",
  brand_name: "Happy Tail Nutrition",
  phone: "081270000002",
  email: "hello@happytail.dev",
  website_url: "https://happytail.dev",
  status: "ACTIVE",
  pics: [{ user_uuid: "u1", name: "Wulan Anggraini", email: "wulan@x.dev" }],
  ...over,
});

describe("fromApi", () => {
  it("maps snake_case fields and PICs to the screen shape", () => {
    expect(fromApi(apiBrand())).toEqual({
      id: "b1",
      name: "Happy Tail Nutrition",
      phone: "081270000002",
      email: "hello@happytail.dev",
      websiteUrl: "https://happytail.dev",
      status: "ACTIVE",
      pics: [{ userId: "u1", name: "Wulan Anggraini", email: "wulan@x.dev" }],
      campaign: null,
      handle: null,
    });
  });

  it("reads campaign and handle when the server sends them", () => {
    const brand = fromApi(
      apiBrand({ campaign: "Power Every Paw", instagram_id: "pawfuel" }),
    );
    expect(brand.campaign).toBe("Power Every Paw");
    expect(brand.handle).toBe("pawfuel");
  });

  it("treats a missing pics field as no PICs instead of crashing", () => {
    const row = apiBrand() as Partial<ApiBrand>;
    delete row.pics;
    expect(fromApi(row as ApiBrand).pics).toEqual([]);
  });
});

describe("brandPageFromApi", () => {
  it("converts meta to camelCase and maps every item", () => {
    const page = brandPageFromApi({
      items: [apiBrand(), apiBrand({ uuid: "b2" })],
      meta: { current_page: 2, per_page: 8, total: 11, last_page: 2 },
    });
    expect(page.items.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(page.meta).toEqual({
      currentPage: 2,
      perPage: 8,
      total: 11,
      lastPage: 2,
    });
  });
});

describe("brandListParams", () => {
  it("drops an empty or blank search and maps paging names", () => {
    expect(brandListParams({ q: "  ", page: 1, perPage: 8 })).toEqual({
      q: undefined,
      page: 1,
      per_page: 8,
    });
  });

  it("trims the search text", () => {
    expect(brandListParams({ q: " paw ", page: 3, perPage: 16 }).q).toBe("paw");
  });
});

describe("status helpers", () => {
  it("labels known statuses and passes unknown ones through", () => {
    expect(brandStatusLabel("ACTIVE")).toBe("Active");
    expect(brandStatusLabel("INACTIVE")).toBe("Inactive");
    expect(brandStatusLabel("PAUSED")).toBe("PAUSED");
  });

  it("only ACTIVE counts as active", () => {
    expect(isBrandActive(fromApi(apiBrand()))).toBe(true);
    expect(isBrandActive(fromApi(apiBrand({ status: "INACTIVE" })))).toBe(
      false,
    );
  });
});

describe("cardContactLines", () => {
  it("shows the handle with @ and the phone when both exist", () => {
    const brand = fromApi(apiBrand({ instagram_id: "happytailnutriti" }));
    expect(cardContactLines(brand)).toEqual({
      left: "@happytailnutriti",
      right: "081270000002",
    });
  });

  it("falls back to the email when the server sends no handle", () => {
    expect(cardContactLines(fromApi(apiBrand())).left).toBe(
      "hello@happytail.dev",
    );
  });

  it("returns nulls when there is no contact data at all", () => {
    const brand = fromApi(apiBrand({ phone: null, email: null }));
    expect(cardContactLines(brand)).toEqual({ left: null, right: null });
  });
});
