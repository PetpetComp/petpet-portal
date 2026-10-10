import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { approveEntry, createEntry } from "@/domains/entries/api";
import type { Entry } from "@/domains/entries/types";
import { EventRegistrations } from "./event-registrations";

const { entry } = vi.hoisted(() => ({
  entry: (
    id: string,
    petName: string,
    eligibility: Entry["eligibility"],
  ): Entry => ({
    id,
    competitionId: "c1",
    petId: id,
    petName,
    ownerName: "Rani",
    bib: "",
    fee: 65000,
    eligibility,
    payment: "UNPAID",
    checkin: "NOT_CHECKED_IN",
    withdrawn: false,
  }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/competitions/api", () => ({
  listEventCompetitions: vi.fn().mockResolvedValue([
    {
      id: "c1",
      eventId: "e1",
      typeId: "",
      name: "Paw Sprint",
      arenaName: "",
      capacity: 40,
      startAt: "",
      endAt: "",
      registrationClosed: false,
      registrationOpen: true,
      status: "SCHEDULED",
    },
  ]),
}));
vi.mock("@/domains/entries/api", () => ({
  listEventEntries: vi
    .fn()
    .mockResolvedValue([
      entry("en1", "Bolt", "PENDING"),
      entry("en2", "Luna", "APPROVED"),
    ]),
  approveEntry: vi.fn().mockResolvedValue({}),
  rejectEntry: vi.fn().mockResolvedValue({}),
  createEntry: vi.fn().mockResolvedValue({}),
  searchOwners: vi
    .fn()
    .mockResolvedValue([
      { id: "u1", name: "Rani Kusuma", email: "rani@x.dev" },
    ]),
  listOwnerPets: vi
    .fn()
    .mockResolvedValue([{ id: "p1", name: "Mochi", speciesId: null }]),
  listPeriods: vi.fn().mockResolvedValue([
    {
      id: "per1",
      type: "ON_SITE",
      price: 80000,
      opensAt: "2000-01-01T00:00:00Z",
      closesAt: "2999-01-01T00:00:00Z",
    },
  ]),
}));

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
  it("lists registrations and filters them by review status", async () => {
    const user = userEvent.setup();
    renderTab();
    expect(await screen.findByText("Bolt")).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Pending/ }));
    expect(screen.queryByText("Luna")).toBeNull();
  });

  it("approves a pending registration", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: "Approve Bolt" }),
    );
    await waitFor(() => expect(approveEntry).toHaveBeenCalledWith("en1"));
    expect(screen.queryByRole("button", { name: "Approve Luna" })).toBeNull();
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
    await user.click(await within(drawer).findByText("Mochi"));
    await user.selectOptions(
      within(drawer).getByLabelText(/Competition/),
      "c1",
    );
    expect(
      await within(drawer).findByText("On site price: Rp 80.000"),
    ).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Register" }));
    await waitFor(() =>
      expect(createEntry).toHaveBeenCalledWith("c1", {
        pet_id: "p1",
        registration_period_id: "per1",
      }),
    );
  });
});
