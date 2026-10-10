import { describe, expect, it } from "vitest";
import type { Competition } from "@/domains/competitions/types";
import type { Entry } from "@/domains/entries/types";
import {
  checkedInText,
  defaultCompetitionId,
  scanTarget,
} from "./participants";

const competition = (id: string, status: Competition["status"]) =>
  ({ id, status }) as Competition;

const entry = (id: string, code: string | null, checkIn = true) =>
  ({
    id,
    participantCode: code,
    actions: {
      approve: false,
      reject: false,
      checkIn,
      undoCheckIn: false,
      withdraw: false,
    },
  }) as Entry;

describe("defaultCompetitionId", () => {
  it("prefers a running competition", () => {
    expect(
      defaultCompetitionId([
        competition("a", "DRAFT"),
        competition("b", "SCHEDULED"),
        competition("c", "ONGOING"),
      ]),
    ).toBe("c");
  });
  it("falls back to the next scheduled one, then the first", () => {
    expect(
      defaultCompetitionId([
        competition("a", "COMPLETED"),
        competition("b", "SCHEDULED"),
      ]),
    ).toBe("b");
    expect(defaultCompetitionId([competition("a", "COMPLETED")])).toBe("a");
    expect(defaultCompetitionId([])).toBe("");
  });
});

describe("scanTarget", () => {
  it("returns the single row with that code when the API allows check-in", () => {
    const rows = [entry("1", "PTC-1-001"), entry("2", "PTC-1-002")];
    expect(scanTarget(rows, "PTC-1-002")?.id).toBe("2");
  });
  it("does nothing when check-in is not allowed", () => {
    expect(
      scanTarget([entry("1", "PTC-1-001", false)], "PTC-1-001"),
    ).toBeNull();
  });
  it("does nothing for a name search or an ambiguous code", () => {
    expect(scanTarget([entry("1", "PTC-1-001")], "Chibi")).toBeNull();
    expect(
      scanTarget(
        [entry("1", "PTC-1-001"), entry("2", "PTC-1-001")],
        "PTC-1-001",
      ),
    ).toBeNull();
  });
});

describe("checkedInText", () => {
  it("reads checked-in of approved", () => {
    expect(checkedInText({ total: 40, approved: 31, checkedIn: 12 })).toBe(
      "12 of 31 checked in",
    );
  });
});
