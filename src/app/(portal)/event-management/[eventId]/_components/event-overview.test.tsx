import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { EventOverview } from "./event-overview";

vi.mock("@/domains/events/api", () => ({
  getEvent: vi.fn().mockResolvedValue({
    id: "e1",
    organizationId: "o1",
    name: "Paw Race",
    tagline: "",
    venueName: "",
    venueAddress: "",
    startAt: "",
    endAt: "",
    status: "Draft",
  }),
  countEventStaff: vi.fn().mockResolvedValue(3),
  countEventSponsors: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/domains/competitions/api", () => ({
  listEventCompetitions: vi.fn().mockResolvedValue([
    {
      id: "c1",
      eventId: "e1",
      name: "Paw Sprint",
      arenaName: "",
      capacity: 40,
      startAt: "",
      endAt: "",
      registrationClosed: false,
      status: "",
    },
    {
      id: "c2",
      eventId: "e1",
      name: "Costume",
      arenaName: "",
      capacity: null,
      startAt: "",
      endAt: "",
      registrationClosed: true,
      status: "",
    },
  ]),
}));

describe("EventOverview", () => {
  it("summarises competitions, committee and setup progress", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <EventOverview eventId="e1" />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText("1 open for registration"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Paw Sprint")).toBeInTheDocument();

    const setup = screen.getByRole("heading", { name: "Setup" }).parentElement!;
    const step = (name: string) => within(setup).getByText(name).parentElement!;
    expect(
      await within(step("Committee invited")).findByLabelText("Done"),
    ).toBeInTheDocument();
    expect(
      within(step("Sponsors linked")).getByLabelText("Not yet"),
    ).toBeInTheDocument();
    expect(
      within(step("Event published")).getByLabelText("Not yet"),
    ).toBeInTheDocument();
  });
});
