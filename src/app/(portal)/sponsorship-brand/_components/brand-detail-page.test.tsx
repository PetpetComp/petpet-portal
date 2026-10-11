import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBrandPic,
  deactivateBrand,
  getBrand,
  removeBrandPic,
} from "@/domains/brands/api";
import type { Brand } from "@/domains/brands/types";
import { searchUsers } from "@/domains/users/api";
import { BrandDetailPage } from "./brand-detail-page";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/domains/brands/api", () => ({
  getBrand: vi.fn(),
  addBrandPic: vi.fn().mockResolvedValue(undefined),
  removeBrandPic: vi.fn().mockResolvedValue(undefined),
  deactivateBrand: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/domains/users/api", () => ({
  searchUsers: vi.fn(),
  countUsers: vi.fn(),
}));

const brand = (over: Partial<Brand> = {}): Brand => ({
  id: "b1",
  name: "KibbleWorks",
  phone: "081270000006",
  email: "hi@kibble.dev",
  websiteUrl: "https://kibble.dev",
  status: "ACTIVE",
  campaign: null,
  handle: null,
  pics: [
    { userId: "u1", name: "Wulan Anggraini", email: "wulan@x.dev" },
    { userId: "u2", name: "Agus Prasetyo", email: "agus@x.dev" },
  ],
  ...over,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrandDetailPage brandId="b1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBrand).mockResolvedValue(brand());
  vi.mocked(searchUsers).mockResolvedValue({
    items: [
      {
        id: "u1",
        name: "Wulan Anggraini",
        email: "wulan@x.dev",
        phone: null,
        isMember: false,
      },
      {
        id: "u9",
        name: "Rara Wijaya",
        email: "rara@x.dev",
        phone: null,
        isMember: false,
      },
    ],
    total: 2,
  });
});

describe("BrandDetailPage", () => {
  it("shows contact data and the PICs from the brand response", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "KibbleWorks", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("081270000006")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hi@kibble.dev" })).toHaveAttribute(
      "href",
      "mailto:hi@kibble.dev",
    );
    expect(
      screen.getByRole("link", { name: "https://kibble.dev" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    const pics = within(screen.getByRole("list", { name: "PICs" }));
    expect(pics.getByText("Wulan Anggraini")).toBeInTheDocument();
    expect(pics.getByText("agus@x.dev")).toBeInTheDocument();
  });

  it("removes a PIC only after the user confirms", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Remove Agus Prasetyo" }),
    );
    expect(removeBrandPic).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(removeBrandPic).toHaveBeenCalledWith("b1", "u2"),
    );
  });

  it("adds a PIC found by search and blocks users who already are one", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Add PIC/ }));
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByRole("searchbox"), "ra");
    const found = within(
      await within(drawer).findByRole("list", { name: "Users found" }),
    );
    expect(
      found.getByRole("button", { name: /Wulan Anggraini/ }),
    ).toBeDisabled();
    await user.click(found.getByRole("button", { name: /Rara Wijaya/ }));
    await user.click(within(drawer).getByRole("button", { name: "Add PIC" }));
    await waitFor(() => expect(addBrandPic).toHaveBeenCalledWith("b1", "u9"));
  });

  it("deletes the brand only after confirmation and then returns to the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Delete/ }));
    expect(deactivateBrand).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete brand" }),
    );
    await waitFor(() => expect(deactivateBrand).toHaveBeenCalledWith("b1"));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/sponsorship-brand"),
    );
  });

  it("marks an inactive brand and hides Delete (the backend would answer 422)", async () => {
    vi.mocked(getBrand).mockResolvedValue(brand({ status: "INACTIVE" }));
    renderPage();
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the error when the brand cannot be loaded", async () => {
    vi.mocked(getBrand).mockRejectedValue(new Error("Sponsor not found."));
    renderPage();
    expect(await screen.findByText("Sponsor not found.")).toBeInTheDocument();
  });
});
