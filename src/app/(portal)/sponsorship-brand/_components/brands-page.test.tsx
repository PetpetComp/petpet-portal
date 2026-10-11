import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listBrandPage } from "@/domains/brands/api";
import type { Brand, BrandPage } from "@/domains/brands/types";
import { BrandsPage } from "./brands-page";

// Mode backend bisa diganti per tes lewat objek ini.
const mode = vi.hoisted(() => ({ mock: true }));
vi.mock("@/lib/backend-mode", () => ({
  get USING_MOCK_BACKEND() {
    return mode.mock;
  },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/brands/api", () => ({ listBrandPage: vi.fn() }));

const brand = (over: Partial<Brand>): Brand => ({
  id: "b1",
  name: "PawFuel",
  phone: "081270000001",
  email: null,
  websiteUrl: null,
  status: "ACTIVE",
  pics: [],
  campaign: "Power Every Paw",
  handle: "pawfuel",
  ...over,
});

const page = (items: Brand[], total = items.length): BrandPage => ({
  items,
  meta: { currentPage: 1, perPage: 8, total, lastPage: 2 },
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrandsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mode.mock = true;
  vi.mocked(listBrandPage).mockReset();
  vi.mocked(listBrandPage).mockResolvedValue(
    page(
      [
        brand({}),
        brand({
          id: "b2",
          name: "Happy Tail Nutrition",
          phone: null,
          campaign: null,
          handle: null,
          email: "hello@happytail.dev",
        }),
      ],
      11,
    ),
  );
});

describe("BrandsPage", () => {
  it("shows a card per brand that links to its detail, plus the server total", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /PawFuel/ });
    expect(link).toHaveAttribute("href", "/sponsorship-brand/b1");
    expect(link).toHaveTextContent("Power Every Paw");
    expect(link).toHaveTextContent("@pawfuel");
    expect(link).toHaveTextContent("081270000001");
    expect(screen.getByText(/of 11 brands/)).toBeInTheDocument();
  });

  it("falls back to the email when the server sends no handle", async () => {
    renderPage();
    const link = await screen.findByRole("link", {
      name: /Happy Tail Nutrition/,
    });
    expect(link).toHaveTextContent("hello@happytail.dev");
  });

  it("offers New brand", async () => {
    renderPage();
    expect(
      await screen.findByRole("link", { name: /New brand/ }),
    ).toHaveAttribute("href", "/sponsorship-brand/create");
  });

  it("sends the typed search to the server in mock mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: /PawFuel/ });
    await user.type(
      screen.getByRole("searchbox", { name: "Search brands" }),
      "paw",
    );
    await waitFor(() =>
      expect(listBrandPage).toHaveBeenLastCalledWith({
        q: "paw",
        page: 1,
        perPage: 8,
      }),
    );
  });

  it("hides the search box against the real backend, which has no q filter yet", async () => {
    mode.mock = false;
    renderPage();
    await screen.findByRole("link", { name: /PawFuel/ });
    expect(
      screen.queryByRole("searchbox", { name: "Search brands" }),
    ).not.toBeInTheDocument();
  });

  it("explains an empty list and offers the first brand", async () => {
    vi.mocked(listBrandPage).mockResolvedValue(page([]));
    renderPage();
    expect(
      await screen.findByText("No brands yet. Create the first one."),
    ).toBeInTheDocument();
  });

  it("shows the error with a retry button when loading fails", async () => {
    const user = userEvent.setup();
    vi.mocked(listBrandPage).mockRejectedValueOnce(new Error("Boom"));
    renderPage();
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: /PawFuel/ }),
    ).toBeInTheDocument();
  });
});
