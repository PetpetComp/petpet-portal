import { describe, it, expect } from "vitest";
import { isEligibleEvent } from "./event-rules";

describe("isEligibleEvent", () => {
  it("allows Open and Pending events only", () => {
    expect(isEligibleEvent({ id: "E", name: "E", status: "Open" })).toBe(true);
    expect(isEligibleEvent({ id: "E", name: "E", status: "Pending" })).toBe(
      true,
    );
    expect(isEligibleEvent({ id: "E", name: "E", status: "Closed" })).toBe(
      false,
    );
  });
});
