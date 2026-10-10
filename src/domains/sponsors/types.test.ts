import { describe, expect, it } from "vitest";
import {
  UNKNOWN_BRAND,
  brandFromApi,
  brandInitials,
  groupByLevel,
  joinSponsors,
  levelLabel,
  linkFromApi,
  unlinkedBrands,
  type ApiEventSponsor,
  type Brand,
  type EventSponsor,
  type EventSponsorLink,
} from "./types";

const apiLink: ApiEventSponsor = {
  uuid: "l1",
  event_uuid: "e1",
  sponsor_uuid: "b1",
  sponsorship_level: "GOLD",
  campaign_text: null,
  display_order: 2,
  start_at: null,
  end_at: null,
  status: "ACTIVE",
};

const link = (
  id: string,
  brandId: string,
  level: string,
): EventSponsorLink => ({
  id,
  eventId: "e1",
  brandId,
  level,
  campaignText: null,
  displayOrder: 0,
});

const brand = (
  id: string,
  name: string,
  phone: string | null = null,
): Brand => ({
  id,
  name,
  phone,
  email: null,
});

const sponsor = (
  linkId: string,
  brandName: string,
  level: string,
  displayOrder = 0,
): EventSponsor => ({
  linkId,
  brandId: `b-${linkId}`,
  level,
  brandName,
  phone: null,
  displayOrder,
});

describe("sponsor mappers", () => {
  it("maps an event-sponsor link from the API shape", () => {
    expect(linkFromApi(apiLink)).toEqual({
      id: "l1",
      eventId: "e1",
      brandId: "b1",
      level: "GOLD",
      campaignText: null,
      displayOrder: 2,
    });
  });

  it("maps a brand from the API shape", () => {
    expect(
      brandFromApi({
        uuid: "b1",
        brand_name: "KibbleWorks",
        phone: "0812",
        email: null,
        website_url: null,
        status: "ACTIVE",
        pics: [],
      }),
    ).toEqual({ id: "b1", name: "KibbleWorks", phone: "0812", email: null });
  });
});

describe("joinSponsors", () => {
  it("adds the brand name and phone to each link", () => {
    const rows = joinSponsors(
      [link("l1", "b1", "GOLD")],
      [brand("b1", "KibbleWorks", "0812")],
    );
    expect(rows).toEqual([
      {
        linkId: "l1",
        brandId: "b1",
        level: "GOLD",
        brandName: "KibbleWorks",
        phone: "0812",
        displayOrder: 0,
      },
    ]);
  });

  it("keeps a link whose brand is missing, with a placeholder name", () => {
    const [row] = joinSponsors([link("l1", "gone", "GOLD")], []);
    expect(row.brandName).toBe(UNKNOWN_BRAND);
    expect(row.phone).toBeNull();
  });
});

describe("groupByLevel", () => {
  it("orders groups Platinum to Media partner and drops empty tiers", () => {
    const groups = groupByLevel([
      sponsor("1", "Media One", "MEDIA_PARTNER"),
      sponsor("2", "Gold One", "GOLD"),
      sponsor("3", "Plat One", "PLATINUM"),
    ]);
    expect(groups.map((g) => g.level)).toEqual([
      "PLATINUM",
      "GOLD",
      "MEDIA_PARTNER",
    ]);
  });

  it("sorts inside a group by display order, then by name", () => {
    const [group] = groupByLevel([
      sponsor("1", "Zeta", "GOLD", 0),
      sponsor("2", "Alpha", "GOLD", 0),
      sponsor("3", "First", "GOLD", -1),
    ]);
    expect(group.sponsors.map((s) => s.brandName)).toEqual([
      "First",
      "Alpha",
      "Zeta",
    ]);
  });

  it("puts a tier the portal does not know at the end instead of hiding it", () => {
    const groups = groupByLevel([
      sponsor("1", "Odd", "DIAMOND"),
      sponsor("2", "Gold One", "GOLD"),
    ]);
    expect(groups.map((g) => g.level)).toEqual(["GOLD", "DIAMOND"]);
  });

  it("returns no groups for no sponsors", () => {
    expect(groupByLevel([])).toEqual([]);
  });
});

describe("unlinkedBrands", () => {
  it("keeps only brands not yet linked, sorted by name", () => {
    const result = unlinkedBrands(
      [brand("b1", "Zed"), brand("b2", "Alpha"), brand("b3", "Mid")],
      [link("l1", "b3", "GOLD")],
    );
    expect(result.map((b) => b.name)).toEqual(["Alpha", "Zed"]);
  });
});

describe("labels and initials", () => {
  it("labels known tiers and shows unknown ones as they are", () => {
    expect(levelLabel("MEDIA_PARTNER")).toBe("Media partner");
    expect(levelLabel("DIAMOND")).toBe("DIAMOND");
  });

  it("builds initials from the first two words", () => {
    expect(brandInitials("Happy Tail Nutrition")).toBe("HT");
    expect(brandInitials("kibbleworks")).toBe("K");
    expect(brandInitials("   ")).toBe("?");
  });
});
