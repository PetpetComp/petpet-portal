import { describe, expect, it } from "vitest";
import { remainingUntilCutoff, shouldTimeout, TIMEOUT_STATUS } from "./cutoff";

describe("shouldTimeout", () => {
  it("is false before the cut-off and true from the cut-off on", () => {
    expect(shouldTimeout(119999, 120000)).toBe(false);
    expect(shouldTimeout(120000, 120000)).toBe(true);
    expect(shouldTimeout(130000, 120000)).toBe(true);
  });

  it("never times out without a cut-off", () => {
    expect(shouldTimeout(999999, null)).toBe(false);
    expect(shouldTimeout(999999, 0)).toBe(false);
  });
});

describe("remainingUntilCutoff", () => {
  it("counts down to zero and never below", () => {
    expect(remainingUntilCutoff(30000, 120000)).toBe(90000);
    expect(remainingUntilCutoff(150000, 120000)).toBe(0);
  });

  it("is null without a cut-off", () => {
    expect(remainingUntilCutoff(1000, null)).toBeNull();
  });
});

describe("TIMEOUT_STATUS", () => {
  it("is the manual attempt status the backend accepts", () => {
    expect(TIMEOUT_STATUS).toBe("TIMEOUT");
  });
});
