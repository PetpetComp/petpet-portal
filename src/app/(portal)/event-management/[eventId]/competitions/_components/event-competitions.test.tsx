import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { runCompetitionAction } from "@/domains/competitions/api";
import { EventCompetitions } from "./event-competitions";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  const none = competitionFixture().actions;
  return {
    listCompetitionTypes: vi.fn().mockResolvedValue([]),
    runCompetitionAction: vi.fn().mockResolvedValue({}),
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({
        id: "c1",
        name: "Paw Sprint",
        actions: {
          ...none,
          start: true,
          closeRegistration: true,
          cancel: true,
        },
      }),
      competitionFixture({
        id: "c2",
        name: "Beauty Class",
        status: "ONGOING",
        actions: { ...none, complete: true },
      }),
      competitionFixture({ id: "c3", name: "Fun Run", status: "COMPLETED" }),
    ]),
  };
});

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EventCompetitions eventId="e1" />
    </QueryClientProvider>,
  );
}

/** Opens a row's "Manage" menu and returns the labels of its items. */
async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    await screen.findByRole("button", { name: `Manage ${name}` }),
  );
  const menu = await screen.findByRole("menu");
  return within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

describe("EventCompetitions lifecycle actions", () => {
  it("shows only the actions the API allows", async () => {
    const user = userEvent.setup();
    renderTab();
    expect(await openMenu(user, "Paw Sprint")).toEqual(
      expect.arrayContaining(["Start", "Close registration"]),
    );
    expect(screen.queryByRole("menuitem", { name: "Publish" })).toBeNull();
    await user.keyboard("{Escape}");
    const funRun = screen.getByText("Fun Run").closest("tr")!;
    expect(within(funRun).queryByRole("button")).toBeNull();
  });

  it("starts right away but asks before completing", async () => {
    const user = userEvent.setup();
    renderTab();
    await openMenu(user, "Paw Sprint");
    await user.click(screen.getByRole("menuitem", { name: "Start" }));
    await waitFor(() =>
      expect(runCompetitionAction).toHaveBeenCalledWith("c1", "start"),
    );
    await openMenu(user, "Beauty Class");
    await user.click(screen.getByRole("menuitem", { name: "Complete" }));
    const dialog = await screen.findByRole("dialog");
    expect(runCompetitionAction).not.toHaveBeenCalledWith("c2", "complete");
    await user.click(within(dialog).getByRole("button", { name: "Complete" }));
    await waitFor(() =>
      expect(runCompetitionAction).toHaveBeenCalledWith("c2", "complete"),
    );
  });

  it("asks before cancelling", async () => {
    const user = userEvent.setup();
    renderTab();
    await openMenu(user, "Paw Sprint");
    await user.click(screen.getByRole("menuitem", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/cannot be undone/);
    await user.click(
      within(dialog).getByRole("button", { name: "Cancel competition" }),
    );
    await waitFor(() =>
      expect(runCompetitionAction).toHaveBeenCalledWith("c1", "cancel"),
    );
  });
});
