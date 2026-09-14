import { describe, it, expect } from "vitest";
import { isDuplicateCommitteeAssignment } from "./committee-rules";

describe("isDuplicateCommitteeAssignment", () => {
  const committee = [
    { id: "COM-1", name: "COM-1", eventId: "EVT-1", userId: "USR-1", role: "Event PIC" },
  ];
  it("flags the exact same user, event, role, and competition scope", () => {
    expect(
      isDuplicateCommitteeAssignment(committee, {
        id: "COM-2",
        name: "COM-2",
        eventId: "EVT-1",
        userId: "USR-1",
        role: "Event PIC",
      }),
    ).toBe(true);
  });
  it("allows a different role for the same user and event", () => {
    expect(
      isDuplicateCommitteeAssignment(committee, {
        id: "COM-2",
        name: "COM-2",
        eventId: "EVT-1",
        userId: "USR-1",
        role: "Judge",
      }),
    ).toBe(false);
  });
  it("ignores the record being edited", () => {
    expect(
      isDuplicateCommitteeAssignment(committee, {
        id: "COM-1",
        name: "COM-1",
        eventId: "EVT-1",
        userId: "USR-1",
        role: "Event PIC",
      }),
    ).toBe(false);
  });
});
