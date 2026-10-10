import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addEventSponsor,
  changeEventSponsorLevel,
  removeEventSponsor,
} from "@/domains/sponsors/api";
import { EventSponsors } from "./event-sponsors";

/** Hak ubah bisa dimatikan per tes lewat `auth.canEdit`. */
const auth = vi.hoisted(() => ({ canEdit: true }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ canOnEvent: () => auth.canEdit }),
}));
vi.mock("@/domains/events/api", () => ({
  getEvent: vi.fn().mockResolvedValue({ id: "e1", organizationId: "o1" }),
}));
vi.mock("@/domains/sponsors/api", () => {
  const link = (id: string, brandId: string, level: string) => ({
    id,
    eventId: "e1",
    brandId,
    level,
    campaignText: null,
    displayOrder: 0,
  });
  return {
    listEventSponsorLinks: vi
      .fn()
      .mockResolvedValue([
        link("l1", "b1", "GOLD"),
        link("l2", "b2", "PLATINUM"),
        link("l3", "gone", "MEDIA_PARTNER"),
      ]),
    listBrands: vi.fn().mockResolvedValue([
      { id: "b1", name: "FurNutrition", phone: "0813", email: null },
      { id: "b2", name: "KibbleWorks", phone: null, email: null },
      { id: "b9", name: "PawTech", phone: null, email: null },
    ]),
    addEventSponsor: vi.fn().mockResolvedValue({}),
    removeEventSponsor: vi.fn().mockResolvedValue(undefined),
    changeEventSponsorLevel: vi.fn().mockResolvedValue({}),
  };
});

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EventSponsors eventId="e1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.canEdit = true;
  vi.clearAllMocks();
});

describe("EventSponsors", () => {
  it("groups sponsors by tier, highest first, and names a brand that is missing", async () => {
    renderTab();
    expect(await screen.findByText("KibbleWorks")).toBeInTheDocument();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Platinum", "Gold", "Media partner"]);
    expect(screen.getByText("Unknown brand")).toBeInTheDocument();
    expect(screen.getByText("0813")).toBeInTheDocument();
  });

  it("hides add, move and remove when the user may not edit the event", async () => {
    auth.canEdit = false;
    renderTab();
    expect(await screen.findByText("KibbleWorks")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add sponsor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument();
  });

  it("removes a sponsor only after the user confirms", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("FurNutrition");
    await user.click(
      screen.getByRole("button", { name: "Actions for FurNutrition" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(removeEventSponsor).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(removeEventSponsor).toHaveBeenCalledWith("e1", "l1"),
    );
  });

  it("moves a sponsor to another tier", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("FurNutrition");
    await user.click(
      screen.getByRole("button", { name: "Actions for FurNutrition" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Move to Silver" }),
    );
    await waitFor(() =>
      expect(changeEventSponsorLevel).toHaveBeenCalledWith(
        "e1",
        { id: "l1", brandId: "b1", level: "GOLD" },
        "SILVER",
      ),
    );
  });

  it("offers only brands not yet linked and adds the chosen one with its tier", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("FurNutrition");
    await user.click(screen.getByRole("button", { name: "Add sponsor" }));
    const drawer = await screen.findByRole("dialog");
    // b1 dan b2 sudah terhubung, hanya PawTech yang boleh dipilih.
    expect(
      within(drawer).queryByRole("button", { name: /FurNutrition/ }),
    ).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "PawTech" }));
    await user.selectOptions(
      within(drawer).getByLabelText("2. Tier"),
      "BRONZE",
    );
    await user.click(
      within(drawer).getByRole("button", { name: "Add sponsor" }),
    );
    await waitFor(() =>
      expect(addEventSponsor).toHaveBeenCalledWith("e1", "b9", "BRONZE"),
    );
  });
});
