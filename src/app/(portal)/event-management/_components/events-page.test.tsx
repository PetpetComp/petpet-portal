import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents } from "@/domains/events/api";
import { eventFixture, eventPageFixture } from "@/test/event-fixtures";
import { EventsPage } from "./events-page";

// Mode backend bisa diganti per tes lewat objek ini.
const mode = vi.hoisted(() => ({ mock: true }));
vi.mock("@/lib/backend-mode", () => ({
  get USING_MOCK_BACKEND() {
    return mode.mock;
  },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/organizations/api", () => ({
  listOrganizations: vi.fn().mockResolvedValue([
    { id: "o1", name: "East Java Pet Sport" },
    { id: "o2", name: "Solo Exotic Pet Community" },
  ]),
}));
vi.mock("@/domains/events/api", () => ({ listEvents: vi.fn() }));

const SUMMARY = { all: 35, eventDay: 1, upcoming: 2, draft: 3, finished: 29 };

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

beforeEach(() => {
  mode.mock = true;
  vi.mocked(listEvents).mockReset();
  vi.mocked(listEvents).mockResolvedValue(
    eventPageFixture(
      [
        eventFixture(),
        eventFixture({
          id: "e2",
          code: "EVT-2026-0001",
          name: "Jakarta Pet Festival 2026",
          organizationName: "",
          organizationId: "o2",
          phase: "UPCOMING",
        }),
      ],
      SUMMARY,
      35,
    ),
  );
});

describe("EventsPage", () => {
  it("lists events with code, schedule, organizer, status and the server total", async () => {
    renderPage();
    const link = await screen.findByRole("link", {
      name: "Surabaya Paw Race 2026",
    });
    const row = link.closest("[role=row]") as HTMLElement;
    expect(within(row).getByText("EVT-2026-0002")).toBeInTheDocument();
    expect(within(row).getByText("4 Sep 2026")).toBeInTheDocument();
    expect(within(row).getByText("10:00 – 20:00")).toBeInTheDocument();
    expect(within(row).getByText("East Java Pet Sport")).toBeInTheDocument();
    expect(within(row).getByText("Event day")).toBeInTheDocument();
    expect(screen.getByText(/of 35 events/)).toBeInTheDocument();
  });

  it("falls back to the organizations list when the event has no organizer name", async () => {
    renderPage();
    const link = await screen.findByRole("link", {
      name: "Jakarta Pet Festival 2026",
    });
    const row = link.closest("[role=row]") as HTMLElement;
    expect(
      await within(row).findByText("Solo Exotic Pet Community"),
    ).toBeInTheDocument();
  });

  it("shows the tab counts from the server summary", async () => {
    renderPage();
    const all = await screen.findByRole("tab", { name: /All/ });
    await waitFor(() => expect(all).toHaveTextContent("35"));
    expect(screen.getByRole("tab", { name: /Upcoming/ })).toHaveTextContent(
      "2",
    );
  });

  it("sends the status tab to the server instead of filtering one page", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("tab", { name: /Upcoming/ });
    await user.click(screen.getByRole("tab", { name: /Upcoming/ }));
    await waitFor(() =>
      expect(listEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ phase: "UPCOMING", page: 1 }),
      ),
    );
    expect(screen.getByRole("tab", { name: /Upcoming/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("sends the organizer filter to the server and clears it again", async () => {
    const user = userEvent.setup();
    renderPage();
    const select = await screen.findByLabelText("Filter organizer");
    await within(select).findByRole("option", {
      name: "Solo Exotic Pet Community",
    });
    await user.selectOptions(select, "o2");
    await waitFor(() =>
      expect(listEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ organizationId: "o2" }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() =>
      expect(listEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ organizationId: undefined }),
      ),
    );
  });

  it("shows an empty state with a way out when the filters match nothing", async () => {
    vi.mocked(listEvents).mockResolvedValue(eventPageFixture([], SUMMARY, 0));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Search events"), "zzz");
    expect(
      await screen.findByText("No events match these filters."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all events" }),
    ).toBeInTheDocument();
  });

  it("shows an error with a retry when loading fails", async () => {
    vi.mocked(listEvents).mockRejectedValue(new Error("Server is down"));
    renderPage();
    expect(await screen.findByText("Server is down")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("hides the filters the real backend cannot serve yet", async () => {
    mode.mock = false;
    renderPage();
    await screen.findByRole("link", { name: "Surabaya Paw Race 2026" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search events")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter month")).not.toBeInTheDocument();
    // Filter organizer didukung backend asli (organization_id), jadi tetap ada.
    expect(screen.getByLabelText("Filter organizer")).toBeInTheDocument();
  });
});
