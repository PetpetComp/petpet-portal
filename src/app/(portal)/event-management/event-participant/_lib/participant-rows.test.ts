import { describe, it, expect } from "vitest";
import { buildParticipantRows } from "./participant-rows";

describe("buildParticipantRows", () => {
  const data = {
    registrations: [
      {
        id: "REG-1",
        name: "REG-1",
        eventId: "EVT-1",
        competitionId: "CMP-1",
        petId: "PET-1",
        userId: "USR-1",
        paymentStatus: "Verified",
        registrationFee: "75000",
        priceCategory: "Early Bird",
      },
    ],
    events: [{ id: "EVT-1", name: "Jakarta Pet Festival" }],
    competitions: [{ id: "CMP-1", name: "Small Dog Sprint", type: "Race" }],
    pets: [{ id: "PET-1", name: "Mochi", animal: "Dog", variant: "Pomeranian" }],
    users: [{ id: "USR-1", name: "Andi Pratama" }],
  };

  it("joins registration data across events, competitions, pets, and owners", () => {
    const rows = buildParticipantRows(data);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventName: "Jakarta Pet Festival",
      competitionName: "Small Dog Sprint",
      competitionType: "Race",
      ownerName: "Andi Pratama",
      petName: "Mochi",
      animal: "Dog",
      variant: "Pomeranian",
      paymentAmount: 75000,
      paymentPeriod: "Early Bird",
    });
  });

  it("falls back to placeholders when a joined record is missing", () => {
    const rows = buildParticipantRows({ ...data, pets: [], users: [] });
    expect(rows[0].petName).toBe("-");
    expect(rows[0].ownerName).toBe("-");
  });
});
