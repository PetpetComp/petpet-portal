import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runCompetitionAction,
  saveCompetitionSettings,
} from "@/domains/competitions/api";
import { CompetitionSettings } from "./competition-settings";

const auth = vi.hoisted(() => ({ canUpdate: true }));
const flags = vi.hoisted(() => ({ reopen: true }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ canOnEvent: () => auth.canUpdate }),
}));
vi.mock("@/domains/events/api", async () => {
  const { eventFixture } = await import("@/test/event-fixtures");
  return { getEvent: vi.fn().mockResolvedValue(eventFixture()) };
});
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  const at = (day: number, h: number) =>
    new Date(2026, 6, day, h).toISOString();
  return {
    getCompetition: vi.fn(async () =>
      competitionFixture({
        id: "c1",
        eventId: "e1",
        typeId: "race",
        speciesId: "sp1",
        status: "SCHEDULED",
        registrationOpen: false,
        registrationClosed: true,
        registrationClosedAt: new Date(2026, 8, 4, 10, 30).toISOString(),
        registrationClosedReason: "CLOSED_BY_ORGANIZER",
        actions: {
          publish: false,
          start: false,
          complete: false,
          closeRegistration: false,
          reopenRegistration: flags.reopen,
          cancel: false,
        },
      }),
    ),
    listCompetitionTypes: vi
      .fn()
      .mockResolvedValue([
        { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      ]),
    listSpecies: vi
      .fn()
      .mockResolvedValue([{ id: "sp1", name: "Sugar Glider" }]),
    listCompetitionRules: vi.fn().mockResolvedValue([
      {
        id: "r1",
        version: 1,
        countdownEnabled: true,
        countdownSeconds: 3,
        concurrentParticipantLimit: null,
        timeLimitMs: 90000,
        attemptLimit: 1,
        checkpointTotal: null,
        laneTotal: 5,
        qualifierLimit: null,
        bestResultMethod: null,
        rankingRule: ["POSITION_ASC"],
        tieBreakRule: null,
        timeoutResult: null,
        isActive: true,
      },
    ]),
    listRegistrationPeriods: vi.fn().mockResolvedValue([
      {
        id: "p1",
        competitionId: "c1",
        type: "EARLY_BIRD",
        price: 70000,
        quota: null,
        startAt: at(12, 8),
        endAt: at(26, 23),
        status: "ACTIVE",
      },
      {
        id: "p2",
        competitionId: "c1",
        type: "ONLINE",
        price: 85000,
        quota: null,
        startAt: at(27, 0),
        endAt: at(30, 23),
        status: "ACTIVE",
      },
    ]),
    listScoreCriteria: vi.fn().mockResolvedValue([]),
    saveCompetitionSettings: vi.fn().mockResolvedValue(undefined),
    runCompetitionAction: vi.fn().mockResolvedValue({}),
    closeRegistrationPeriod: vi.fn().mockResolvedValue({}),
  };
});

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CompetitionSettings eventId="e1" competitionId="c1" />
    </QueryClientProvider>,
  );
}

describe("CompetitionSettings", () => {
  beforeEach(() => {
    auth.canUpdate = true;
    flags.reopen = true;
    vi.mocked(saveCompetitionSettings).mockClear();
    vi.mocked(runCompetitionAction).mockClear();
  });

  it("shows the rules and the registration channels filled from the server", async () => {
    renderSettings();
    expect(
      await screen.findByRole("heading", { name: "Race rules" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lanes per match")).toHaveValue(5);
    expect(screen.getByLabelText(/Cut-off time/)).toHaveValue("01:30");
    expect(screen.getByLabelText("Type")).toHaveValue("Race");
    await waitFor(() =>
      expect(screen.getByLabelText("Animal")).toHaveValue("Sugar Glider"),
    );
    expect(screen.getByLabelText("Early bird price")).toHaveValue(70000);
    expect(screen.getByLabelText("Online price")).toHaveValue(85000);
    expect(
      screen.getByText(
        "Saving creates a new rule version; past heats keep theirs.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps Save changes off until something changes, then saves only the new rule version", async () => {
    const user = userEvent.setup();
    renderSettings();
    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    const lanes = screen.getByLabelText("Lanes per match");
    await user.clear(lanes);
    await user.type(lanes, "6");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() =>
      expect(saveCompetitionSettings).toHaveBeenCalledTimes(1),
    );
    const [id, changes] = vi.mocked(saveCompetitionSettings).mock.calls[0];
    expect(id).toBe("c1");
    expect(changes.rule).toMatchObject({
      lane_total: 6,
      time_limit_ms: 90000,
      ranking_rule: ["POSITION_ASC"],
    });
    expect(changes.periodUpdates).toEqual([]);
    expect(changes.periodCreates).toEqual([]);
  });

  it("blocks saving a cut-off that is not mm:ss", async () => {
    const user = userEvent.setup();
    renderSettings();
    const cutoff = await screen.findByLabelText(/Cut-off time/);
    await user.clear(cutoff);
    await user.type(cutoff, "abc");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText("Use mm:ss, for example 01:30"),
    ).toBeInTheDocument();
    expect(saveCompetitionSettings).not.toHaveBeenCalled();
  });

  it("shows the closed banner and reopens registration after confirming", async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(await screen.findByText("Registration closed")).toBeInTheDocument();
    expect(
      screen.getByText(/Closed on 4 Sep 2026, 10:30\./),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Reopen registration" }),
    );
    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(runCompetitionAction).toHaveBeenCalledWith(
        "c1",
        "reopenRegistration",
      ),
    );
  });

  it("hides Reopen when the API does not offer it", async () => {
    flags.reopen = false;
    renderSettings();
    expect(await screen.findByText("Registration closed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reopen registration" }),
    ).toBeNull();
  });

  it("is read-only without the update permission", async () => {
    auth.canUpdate = false;
    renderSettings();
    expect(
      await screen.findByText(
        "You can view these settings but not change them.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lanes per match")).toBeDisabled();
    expect(screen.getByLabelText("Early bird price")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add channel" })).toBeNull();
  });

  it("offers Add channel only while a channel type is free", async () => {
    const user = userEvent.setup();
    renderSettings();
    const add = await screen.findByRole("button", { name: "Add channel" });
    expect(add).toBeEnabled();
    await user.click(add);
    expect(
      await screen.findByRole("combobox", { name: "Channel type of row 3" }),
    ).toHaveValue("ON_SITE");
    await waitFor(() => expect(add).toBeDisabled());
  });
});
