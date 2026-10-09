import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("collapses the far pages into ellipses", () => {
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
  });
  it("keeps the edges tight near the start and end", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20]);
  });
});
