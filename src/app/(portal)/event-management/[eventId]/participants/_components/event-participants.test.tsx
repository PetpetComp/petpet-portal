import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkInEntry,
  listEventEntries,
  undoCheckIn,
} from "@/domains/entries/api";
import type { EntryListQuery } from "@/domains/entries/types";
import { entriesPage, entryFixture } from "@/test/fixtures";
import { EventParticipants } from "./event-participants";

vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({
        id: "c0",
        name: "Costume Parade",
        status: "DRAFT",
      }),
      competitionFixture({
        id: "c1",
        name: "Beauty Class",
        status: "ONGOING",
      }),
    ]),
  };
});
vi.mock("@/domains/entries/api", () => ({
  listEventEntries: vi.fn(),
  checkInEntry: vi.fn().mockResolvedValue({}),
  undoCheckIn: vi.fn().mockResolvedValue({}),
}));

const actions = entryFixture().actions;
const rows = [
  entryFixture({
    id: "en1",
    petName: "Bolt",
    ownerName: "Rani",
    petMorphName: "Classic Grey",
    participantCode: "PTC-1-001",
    eligibility: "APPROVED",
    actions: { ...actions, checkIn: true },
  }),
  entryFixture({
    id: "en2",
    petName: "Luna",
    participantCode: "PTC-1-002",
    eligibility: "APPROVED",
    actions: { ...actions, checkIn: true },
  }),
  entryFixture({
    id: "en3",
    petName: "Mochi",
    eligibility: "APPROVED",
    checkin: "CHECKED_IN",
    actions: { ...actions, undoCheckIn: true },
  }),
  entryFixture({
    id: "en4",
    petName: "Kiwi",
    eligibility: "APPROVED",
    checkin: "CHECKED_IN",
  }),
];

beforeEach(() => {
  vi.mocked(listEventEntries).mockImplementation(
    async (_eventId: string, query: EntryListQuery) =>
      entriesPage(
        query.q ? rows.filter((r) => r.participantCode === query.q) : rows,
        { total: 6, approved: 4, checkedIn: 2 },
      ),
  );
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EventParticipants eventId="e1" />
    </QueryClientProvider>,
  );
}

describe("EventParticipants", () => {
  it("lists approved participants of the running competition with the summary", async () => {
    renderPage();
    expect(await screen.findByText("Bolt")).toBeInTheDocument();
    expect(screen.getByText("Rani · Classic Grey")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 checked in")).toBeInTheDocument();
    expect(screen.getByLabelText("Competition")).toHaveValue("c1");
    expect(listEventEntries).toHaveBeenCalledWith("e1", {
      competitionId: "c1",
      eligibility: "APPROVED",
      status: "REGISTERED",
      q: "",
      sort: "pet_name",
      direction: "asc",
      page: 1,
      perPage: 12,
    });
  });

  it("checks in straight away when a scanned code matches one participant", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Bolt");
    const input = screen.getByLabelText("Scan QR or search participant");
    await user.type(input, "PTC-1-002{Enter}");
    await waitFor(() => expect(checkInEntry).toHaveBeenCalledWith("en2"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Luna checked in",
    );
    expect(input).toHaveValue("");
  });

  it("only filters when Enter is pressed on a name", async () => {
    const user = userEvent.setup();
    vi.mocked(checkInEntry).mockClear();
    renderPage();
    await screen.findByText("Bolt");
    await user.type(
      screen.getByLabelText("Scan QR or search participant"),
      "Bolt{Enter}",
    );
    await waitFor(() =>
      expect(listEventEntries).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ q: "Bolt" }),
      ),
    );
    expect(checkInEntry).not.toHaveBeenCalled();
  });

  it("checks in from the card button", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Check in Bolt" }),
    );
    await waitFor(() => expect(checkInEntry).toHaveBeenCalledWith("en1"));
  });

  it("asks before undoing a check-in, and only where the API allows it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Checked in: Mochi. Undo" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(undoCheckIn).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Undo check-in" }),
    );
    await waitFor(() => expect(undoCheckIn).toHaveBeenCalledWith("en3"));
    // Kiwi: checked in but no undo allowed -> a plain badge, not a button.
    const kiwi = screen.getByText("Kiwi").closest("li")!;
    expect(within(kiwi).getByText("Checked in")).toBeInTheDocument();
    expect(within(kiwi).queryByRole("button")).toBeNull();
  });
});
