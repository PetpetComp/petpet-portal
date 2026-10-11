import { describe, expect, it } from "vitest";
import {
  EMPTY_BRAND_FORM,
  brandSchema,
  brandToBody,
  formFromBrand,
  isHttpUrl,
  serverErrorsToFormErrors,
} from "./schema";
import { fromApi } from "./types";

const valid = { ...EMPTY_BRAND_FORM, brandName: "  PawFuel  " };

describe("brandSchema", () => {
  it("accepts a name alone and trims it", () => {
    const parsed = brandSchema.parse(valid);
    expect(parsed.brandName).toBe("PawFuel");
  });

  it("requires a brand name", () => {
    const result = brandSchema.safeParse({ ...valid, brandName: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Brand name is required.");
  });

  it("limits lengths like the backend (name 200, phone 30)", () => {
    expect(
      brandSchema.safeParse({ ...valid, brandName: "x".repeat(201) }).success,
    ).toBe(false);
    expect(
      brandSchema.safeParse({ ...valid, phone: "1".repeat(31) }).success,
    ).toBe(false);
    expect(
      brandSchema.safeParse({ ...valid, phone: "1".repeat(30) }).success,
    ).toBe(true);
  });

  it("allows an empty email and website but rejects invalid ones", () => {
    expect(brandSchema.safeParse(valid).success).toBe(true);
    expect(brandSchema.safeParse({ ...valid, email: "nope" }).success).toBe(
      false,
    );
    expect(
      brandSchema.safeParse({ ...valid, email: "ok@brand.com" }).success,
    ).toBe(true);
    expect(
      brandSchema.safeParse({ ...valid, websiteUrl: "brand.com" }).success,
    ).toBe(false);
    expect(
      brandSchema.safeParse({ ...valid, websiteUrl: "https://brand.com" })
        .success,
    ).toBe(true);
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(isHttpUrl("http://a.com")).toBe(true);
    expect(isHttpUrl("https://a.com/path?q=1")).toBe(true);
    expect(isHttpUrl("ftp://a.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("a.com")).toBe(false);
  });
});

describe("brandToBody", () => {
  it("sends empty optional fields as null so Edit can clear them", () => {
    expect(brandToBody(brandSchema.parse(valid))).toEqual({
      brand_name: "PawFuel",
      phone: null,
      email: null,
      website_url: null,
    });
  });

  it("maps filled fields to snake_case", () => {
    const body = brandToBody(
      brandSchema.parse({
        brandName: "PawFuel",
        phone: " 0812 ",
        email: "a@b.com",
        websiteUrl: "https://b.com",
      }),
    );
    expect(body).toEqual({
      brand_name: "PawFuel",
      phone: "0812",
      email: "a@b.com",
      website_url: "https://b.com",
    });
  });
});

describe("formFromBrand", () => {
  it("turns null columns into empty strings for the inputs", () => {
    const brand = fromApi({
      uuid: "b1",
      brand_name: "PawFuel",
      phone: null,
      email: null,
      website_url: null,
      status: "ACTIVE",
      pics: [],
    });
    expect(formFromBrand(brand)).toEqual({
      brandName: "PawFuel",
      phone: "",
      email: "",
      websiteUrl: "",
    });
  });
});

describe("serverErrorsToFormErrors", () => {
  it("maps API field names to form field names and joins messages", () => {
    expect(
      serverErrorsToFormErrors({
        brand_name: ["The brand name field is required."],
        website_url: ["Bad URL.", "Really bad."],
        something_else: ["ignored"],
      }),
    ).toEqual({
      brandName: "The brand name field is required.",
      websiteUrl: "Bad URL. Really bad.",
    });
  });

  it("returns an empty object when there are no errors", () => {
    expect(serverErrorsToFormErrors(undefined)).toEqual({});
  });
});
