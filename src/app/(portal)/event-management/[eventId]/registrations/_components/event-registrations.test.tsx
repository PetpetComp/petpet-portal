import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  approveEntry,
  createEntry,
  listEventEntries,
  searchOwners,
} from "@/domains/entries/api";
import { EventRegistrations } from "./event-registrations";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({
        activeRegistrationPeriod: {
          id: "per1",
          type: "ON_SITE",
          price: 80000,
          endsAt: "2026-11-05T05:00:00+00:00",
        },
      }),
      competitionFixture({
        id: "c2",
        name: "Closed Cup",
        registrationOpen: false,
        registrationClosedReason: "CLOSED_BY_ORGANIZER",
      }),
    ]),
  };
});
vi.mock("@/domains/entries/api", async () => {
  const { entryFixture, entriesPage } = await import("@/test/fixtures");
  const reviewable = { approve: true, reject: true };
  return {
    listEventEntries: vi.fn().mockResolvedValue(
      entriesPage(
        [
          entryFixture({
            id: "en1",
            petName: "Bolt",
            actions: { ...entryFixture().actions, ...reviewable },
          }),
          // Pending, but the API says this caller may not review it.
          entryFixture({ id: "en2", petName: "Luna" }),
          entryFixture({ id: "en3", petName: "Kiwi", eligibility: "APPROVED" }),
        ],
        { total: 3, approved: 1, checkedIn: 0 },
      ),
    ),
    approveEntry: vi.fn().mockResolvedValue({}),
    rejectEntry: vi.fn().mockResolvedValue({}),
    createEntry: vi.fn().mockResolvedValue({}),
    searchOwners: vi.fn().mockResolvedValue([
      {
        id: "u1",
        name: "Rani Kusuma",
        email: "rani@x.dev",
        phone: "0812",
        pets: [
          {
            id: "p1",
            name: "Mochi",
            speciesName: "Sugar Glider",
            morphName: "Mosaic",
          },
        ],
      },
    ]),
  };
});

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EventRegistrations eventId="e1" />
    </QueryClientProvider>,
  );
}

describe("EventRegistrations", () => {
  it("asks the API for one page and sends the review filter to it", async () => {
    const user = userEvent.setup();
    renderTab();
    expect(await screen.findByText("Bolt")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(listEventEntries).toHaveBeenLastCalledWith("e1", {
      competitionId: undefined,
      eligibility: undefined,
      payment: undefined,
      status: "REGISTERED",
      q: "",
      sort: "registered_at",
      direction: "desc",
      page: 1,
      perPage: 10,
    });
    await user.click(screen.getByRole("button", { name: "Pending" }));
    await waitFor(() =>
      expect(listEventEntries).toHaveBeenLastCalledWith(
        "e1",
        expect.objectContaining({ eligibility: "PENDING", page: 1 }),
      ),
    );
    await user.selectOptions(
      screen.getByLabelText("Filter Competition"),
      "Closed Cup",
    );
    await waitFor(() =>
      expect(listEventEntries).toHaveBeenLastCalledWith(
        "e1",
        expect.objectContaining({ competitionId: "c2" }),
      ),
    );
  });

  it("shows approve/reject only where the API allows it", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: "Approve Bolt" }),
    );
    await waitFor(() => expect(approveEntry).toHaveBeenCalledWith("en1"));
    expect(screen.getByRole("button", { name: "Reject Bolt" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve Luna" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject Luna" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve Kiwi" })).toBeNull();
  });

  it("registers a pet on the spot through the drawer", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: /Register pet/ }),
    );
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByLabelText(/Owner/), "ra");
    await user.click(await within(drawer).findByText("Rani Kusuma"));
    expect(searchOwners).toHaveBeenCalledWith("e1", "ra");
    await user.click(within(drawer).getByText("Mochi"));
    const select = within(drawer).getByLabelText(/Competition/);
    // Only competitions the API reports as open.
    expect(
      within(select).queryByRole("option", { name: "Closed Cup" }),
    ).toBeNull();
    await user.selectOptions(select, "c1");
    expect(
      within(drawer).getByText(/On the spot price: Rp 80\.000/),
    ).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Register" }));
    await waitFor(() =>
      expect(createEntry).toHaveBeenCalledWith("c1", { pet_id: "p1" }),
    );
  });
});
