import { describe, expect, it } from "vitest";
import { petFeatures } from "./features";

describe("petFeatures", () => {
  it("hides everything the real backend lacks", () => {
    expect(petFeatures(false, true)).toEqual({
      serverFilters: false,
      ownerPicker: false,
      editClassification: false,
    });
  });

  it("enables the contract features on the mock backend", () => {
    expect(petFeatures(true, false)).toEqual({
      serverFilters: true,
      ownerPicker: false,
      editClassification: true,
    });
  });

  it("offers the owner picker only to staff on the mock backend", () => {
    expect(petFeatures(true, true).ownerPicker).toBe(true);
  });
});
