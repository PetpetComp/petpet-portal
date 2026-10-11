import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrand, getBrand, updateBrand } from "@/domains/brands/api";
import type { Brand } from "@/domains/brands/types";
import { ApiError } from "@/lib/api-client";
import { BrandCreatePage, BrandEditPage } from "./brand-form";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/domains/brands/api", () => ({
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  getBrand: vi.fn(),
}));

const saved: Brand = {
  id: "b7",
  name: "Glide Gear",
  phone: null,
  email: null,
  websiteUrl: null,
  status: "ACTIVE",
  pics: [],
  campaign: null,
  handle: null,
};

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BrandCreatePage", () => {
  it("blocks an empty name without calling the API", async () => {
    const user = userEvent.setup();
    wrap(<BrandCreatePage />);
    await user.click(screen.getByRole("button", { name: "Create brand" }));
    expect(
      await screen.findByText("Brand name is required."),
    ).toBeInTheDocument();
    expect(createBrand).not.toHaveBeenCalled();
  });

  it("creates the brand and opens its detail page", async () => {
    const user = userEvent.setup();
    vi.mocked(createBrand).mockResolvedValue(saved);
    wrap(<BrandCreatePage />);
    await user.type(screen.getByLabelText(/Brand name/), "  Glide Gear ");
    await user.type(screen.getByLabelText("Email"), "hi@glide.dev");
    await user.click(screen.getByRole("button", { name: "Create brand" }));
    await waitFor(() =>
      expect(createBrand).toHaveBeenCalledWith({
        brandName: "Glide Gear",
        phone: "",
        email: "hi@glide.dev",
        websiteUrl: "",
      }),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/sponsorship-brand/b7"),
    );
  });

  it("puts a server 422 message on the matching field", async () => {
    const user = userEvent.setup();
    vi.mocked(createBrand).mockRejectedValue(
      new ApiError(422, "The email field must be a valid email address.", {
        email: ["The email field must be a valid email address."],
      }),
    );
    wrap(<BrandCreatePage />);
    await user.type(screen.getByLabelText(/Brand name/), "Glide Gear");
    await user.click(screen.getByRole("button", { name: "Create brand" }));
    expect(
      await screen.findByText("The email field must be a valid email address."),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("BrandEditPage", () => {
  it("fills the form from the brand and saves changes", async () => {
    const user = userEvent.setup();
    vi.mocked(getBrand).mockResolvedValue({
      ...saved,
      id: "b1",
      name: "KibbleWorks",
      phone: "0812",
    });
    vi.mocked(updateBrand).mockResolvedValue(saved);
    wrap(<BrandEditPage brandId="b1" />);
    const name = await screen.findByDisplayValue("KibbleWorks");
    expect(screen.getByDisplayValue("0812")).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, "KibbleWorks Pro");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateBrand).toHaveBeenCalledWith("b1", {
        brandName: "KibbleWorks Pro",
        phone: "0812",
        email: "",
        websiteUrl: "",
      }),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/sponsorship-brand/b1"),
    );
  });

  it("shows the error when the brand cannot be loaded", async () => {
    vi.mocked(getBrand).mockRejectedValue(new Error("Sponsor not found."));
    wrap(<BrandEditPage brandId="x" />);
    expect(await screen.findByText("Sponsor not found.")).toBeInTheDocument();
  });
});
