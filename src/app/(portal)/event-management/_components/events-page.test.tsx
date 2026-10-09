import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { EventsPage } from "./events-page";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/events/api", () => ({
  listEvents: vi.fn().mockResolvedValue({
    total: 35,
    items: [
      {
        id: "e1",
        organizationId: "o1",
        name: "Surabaya Paw Race 2026",
        tagline: "",
        venueName: "Grand City",
        venueAddress: "",
        startAt: "2026-09-04T10:00:00Z",
        endAt: "2026-09-04T20:00:00Z",
        status: "PUBLISHED",
      },
    ],
  }),
  organizationNames: vi.fn().mockResolvedValue({ o1: "East Java Pet Sport" }),
  deleteEvent: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EventsPage />
    </QueryClientProvider>,
  );
}

describe("EventsPage", () => {
  it("lists events with the organizer name and the API total", async () => {
    renderPage();
    expect(
      await screen.findByText("Surabaya Paw Race 2026"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("cell", { name: "East Java Pet Sport" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/of 35 records/)).toBeInTheDocument();
  });

  it("keeps column filters disabled until the API supports them", async () => {
    renderPage();
    await screen.findByText("Surabaya Paw Race 2026");
    expect(screen.getByLabelText("Filter Event")).toBeDisabled();
    expect(screen.getByLabelText("Filter Status")).toBeDisabled();
  });
});
