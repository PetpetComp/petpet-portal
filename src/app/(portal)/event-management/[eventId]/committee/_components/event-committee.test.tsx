import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEventInvitations,
  getEventStaff,
  inviteStaff,
  revokeAssignment,
  revokeInvitation,
} from "@/domains/staff/api";
import { searchUsers } from "@/domains/users/api";
import { ApiError } from "@/lib/api-client";
import { EventCommittee } from "./event-committee";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/events/api", async () => {
  const { eventFixture } = await import("@/test/event-fixtures");
  return { getEvent: vi.fn().mockResolvedValue(eventFixture()) };
});
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({
        id: "c1",
        name: "Paw Sprint 100M",
        typeId: "race",
      }),
      competitionFixture({
        id: "c2",
        name: "Best Costume",
        typeId: "contest",
      }),
    ]),
    listCompetitionTypes: vi.fn().mockResolvedValue([
      { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      {
        id: "contest",
        code: "BEAUTY",
        name: "Beauty",
        resultMode: "JUDGED_SCORE",
      },
    ]),
  };
});
vi.mock("@/domains/staff/api", async () => {
  const { FALLBACK_ASSIGNMENT_ROLES, roleFromApi } =
    await import("@/domains/staff/types");
  const member = (over: Record<string, unknown>) => ({
    userId: "u",
    email: null,
    canRevoke: true,
    ...over,
  });
  return {
    getAssignmentRoles: vi
      .fn()
      .mockResolvedValue(FALLBACK_ASSIGNMENT_ROLES.map(roleFromApi)),
    getEventStaff: vi.fn().mockResolvedValue([
      member({
        id: "m0",
        name: "Bima Saputra",
        email: "bima@x.dev",
        competitionId: null,
        role: "EVENT_MANAGER",
      }),
      member({
        id: "m1",
        name: "Sari Wulandari",
        email: "sari@x.dev",
        competitionId: "c1",
        role: "COMPETITION_PIC",
      }),
      member({
        id: "m2",
        name: "Farhan Hidayat",
        email: "farhan@x.dev",
        competitionId: "c1",
        role: "JUDGE",
        canRevoke: false,
      }),
    ]),
    getEventInvitations: vi.fn().mockResolvedValue([
      {
        id: "i1",
        eventId: "e1",
        competitionId: "c1",
        email: "new.judge@x.dev",
        inviteeName: null,
        role: "HEAD_JUDGE",
        expiresAt: "2026-10-17T00:00:00+00:00",
        canRevoke: true,
      },
    ]),
    inviteStaff: vi.fn().mockResolvedValue({}),
    revokeAssignment: vi.fn().mockResolvedValue(null),
    revokeInvitation: vi.fn().mockResolvedValue(null),
  };
});
vi.mock("@/domains/users/api", () => ({
  searchUsers: vi.fn().mockResolvedValue({
    items: [
      {
        id: "u9",
        name: "Rani Kusuma",
        email: "rani@x.dev",
        phone: null,
        isMember: true,
      },
    ],
    total: 1,
  }),
  countUsers: vi.fn(),
}));

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EventCommittee eventId="e1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("EventCommittee", () => {
  it("shows Event team first, members with role labels, and the pending invitation", async () => {
    renderTab();
    expect(await screen.findByText("Bima Saputra")).toBeInTheDocument();
    const groups = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"));
    expect(groups).toEqual(["Event team", "Paw Sprint 100M", "Best Costume"]);

    const team = screen.getByRole("region", { name: "Event team" });
    expect(within(team).getByText("Event manager")).toBeInTheDocument();

    const race = screen.getByRole("region", { name: "Paw Sprint 100M" });
    expect(within(race).getByText("Competition PIC")).toBeInTheDocument();
    expect(within(race).getByText("2 people · 1 pending")).toBeInTheDocument();
    expect(within(race).getByText("new.judge@x.dev")).toBeInTheDocument();
    expect(within(race).getByText("Pending")).toBeInTheDocument();
    expect(within(race).getByText("Head judge")).toBeInTheDocument();
  });

  it("hides Remove where the API does not allow it", async () => {
    renderTab();
    await screen.findByText("Sari Wulandari");
    expect(
      screen.getByRole("button", { name: "Remove Sari Wulandari" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Remove Farhan Hidayat" }),
    ).toBeNull();
  });

  it("keeps a collapsed competition closed until opened, then shows the empty text", async () => {
    const user = userEvent.setup();
    renderTab();
    const costume = await screen.findByRole("region", { name: "Best Costume" });
    expect(within(costume).queryByText("No one is assigned yet.")).toBeNull();
    await user.click(
      within(costume).getByRole("button", { name: /Best Costume.*Open/ }),
    );
    expect(
      within(costume).getByText("No one is assigned yet."),
    ).toBeInTheDocument();
  });

  it("asks before removing a member, then calls the API", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: "Remove Sari Wulandari" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Remove Sari Wulandari/),
    ).toBeInTheDocument();
    expect(revokeAssignment).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(revokeAssignment).toHaveBeenCalledWith("m1"));
  });

  it("asks before revoking an invitation, then calls the API", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", {
        name: "Revoke invitation for new.judge@x.dev",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith("i1"));
  });

  it("invites by email to the competition whose Invite button was used", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: "Invite to Paw Sprint 100M" }),
    );
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByLabelText(/1. Where/)).toHaveValue("c1");
    const roleSelect = within(drawer).getByLabelText(/2. Role/);
    // Competition target: no Event manager in the list.
    expect(
      within(roleSelect).queryByRole("option", { name: "Event manager" }),
    ).toBeNull();
    await user.selectOptions(roleSelect, "JUDGE");
    await user.click(
      within(drawer).getByRole("button", { name: "Invite by email" }),
    );
    await user.type(within(drawer).getByLabelText(/Email/), "judge@x.dev");
    await user.click(
      within(drawer).getByRole("button", { name: "Send invitation" }),
    );
    await waitFor(() =>
      expect(inviteStaff).toHaveBeenCalledWith({
        event_id: "e1",
        competition_id: "c1",
        email: "judge@x.dev",
        assignment_role: "JUDGE",
      }),
    );
  });

  it("preselects Event manager for the event team and invites a searched user", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: "Invite to Event team" }),
    );
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByLabelText(/2. Role/)).toHaveValue(
      "EVENT_MANAGER",
    );
    await user.type(
      within(drawer).getByLabelText(/Name, email or phone/),
      "ra",
    );
    await user.click(await within(drawer).findByText("Rani Kusuma"));
    expect(searchUsers).toHaveBeenCalledWith("ra", "o1");
    await user.click(
      within(drawer).getByRole("button", { name: "Send invitation" }),
    );
    await waitFor(() =>
      expect(inviteStaff).toHaveBeenCalledWith({
        event_id: "e1",
        email: "rani@x.dev",
        assignment_role: "EVENT_MANAGER",
      }),
    );
  });

  it("validates before sending and shows server 422 messages under the field", async () => {
    const user = userEvent.setup();
    vi.mocked(inviteStaff).mockRejectedValueOnce(
      new ApiError(422, "Invalid.", {
        email: ["An invitation for this email and role is already pending."],
      }),
    );
    renderTab();
    await user.click(
      await screen.findByRole("button", { name: "Invite member" }),
    );
    const drawer = await screen.findByRole("dialog");
    await user.click(
      within(drawer).getByRole("button", { name: "Send invitation" }),
    );
    expect(
      await within(drawer).findByText("Choose where this person will work."),
    ).toBeInTheDocument();
    expect(within(drawer).getByText("Choose a role.")).toBeInTheDocument();
    expect(inviteStaff).not.toHaveBeenCalled();

    await user.selectOptions(
      within(drawer).getByLabelText(/1. Where/),
      "event",
    );
    await user.click(
      within(drawer).getByRole("button", { name: "Invite by email" }),
    );
    await user.type(within(drawer).getByLabelText(/Email/), "pic@x.dev");
    await user.click(
      within(drawer).getByRole("button", { name: "Send invitation" }),
    );
    expect(
      await within(drawer).findByText(/already pending/),
    ).toBeInTheDocument();
  });

  it("does not crash on the current backend shape (no email, no actions)", async () => {
    vi.mocked(getEventStaff).mockResolvedValueOnce([
      {
        id: "m9",
        userId: "u9",
        name: "Old Shape",
        email: null,
        competitionId: "c1",
        role: "JUDGE",
        canRevoke: false,
      },
    ]);
    vi.mocked(getEventInvitations).mockRejectedValueOnce(
      new Error("You don't have permission to perform this action."),
    );
    renderTab();
    expect(await screen.findByText("Old Shape")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(
      await screen.findByText(/Pending invitations could not be loaded/),
    ).toBeInTheDocument();
  });
});
