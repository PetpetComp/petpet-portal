import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPetMorphs, listPets, listSpecies } from "@/domains/pets/api";
import { petFixture, petPageFixture } from "@/test/pet-fixtures";
import { PetsPage } from "./pets-page";

// Mode backend bisa diganti per tes lewat objek ini.
const mode = vi.hoisted(() => ({ mock: true }));
vi.mock("@/lib/backend-mode", () => ({
  get USING_MOCK_BACKEND() {
    return mode.mock;
  },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/pets/api", () => ({
  listPets: vi.fn(),
  listSpecies: vi.fn(),
  listPetMorphs: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PetsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mode.mock = true;
  vi.mocked(listPets).mockReset();
  vi.mocked(listPets).mockResolvedValue(
    petPageFixture(
      [
        petFixture(),
        petFixture({
          id: "p2",
          name: "Bruno",
          ownerName: "Salsa Putri",
          birthDate: "",
          weightGrams: null,
          morphName: "",
          morphId: null,
        }),
      ],
      11,
    ),
  );
  vi.mocked(listSpecies).mockResolvedValue([
    { id: "sp-sugar-glider", code: "SUGAR_GLIDER", name: "Sugar Glider" },
  ]);
  vi.mocked(listPetMorphs).mockResolvedValue([]);
});

describe("PetsPage", () => {
  it("shows a card per pet with species, morph, owner and weight", async () => {
    renderPage();
    const card = (await screen.findByRole("link", {
      name: /Mochi/,
    })) as HTMLElement;
    expect(card).toHaveAttribute("href", "/pet-management/p1");
    expect(card).toHaveTextContent("Sugar Glider · Caramel");
    expect(card).toHaveTextContent("Andi Pratama");
    expect(card).toHaveTextContent("130 g");
    expect(screen.getByRole("link", { name: /Bruno/ })).toHaveTextContent(
      "Salsa Putri",
    );
    expect(screen.getByText(/of 11 pets/)).toBeInTheDocument();
  });

  it("builds the species chips in the Filter panel from the master, not from a fixed list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: /Mochi/ });
    await user.click(screen.getByRole("button", { name: /Filter/ }));
    expect(
      await screen.findByRole("button", { name: "Sugar Glider" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Dog" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cat" })).toBeNull();
  });

  it("sends the species only after Apply, and the search to the server", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: /Mochi/ });
    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(
      await screen.findByRole("button", { name: "Sugar Glider" }),
    );
    // Draft saja: belum dikirim sebelum Apply.
    expect(listPets).not.toHaveBeenCalledWith(
      expect.objectContaining({ speciesId: "sp-sugar-glider" }),
    );
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(listPets).toHaveBeenLastCalledWith(
        expect.objectContaining({ speciesId: "sp-sugar-glider", page: 1 }),
      ),
    );
    await user.type(screen.getByLabelText("Search pet or owner"), "mochi");
    await waitFor(() =>
      expect(listPets).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "mochi", speciesId: "sp-sugar-glider" }),
      ),
    );
  });

  it("hides search and the Filter button on the real backend, which cannot filter yet", async () => {
    mode.mock = false;
    renderPage();
    await screen.findByRole("link", { name: /Mochi/ });
    expect(screen.queryByLabelText("Search pet or owner")).toBeNull();
    expect(screen.queryByRole("button", { name: /Filter/ })).toBeNull();
    expect(screen.getByRole("link", { name: "New pet" })).toBeInTheDocument();
  });

  it("fills in names from the master when the API only sends ids", async () => {
    vi.mocked(listPets).mockResolvedValue(
      petPageFixture([
        petFixture({ speciesName: "", morphName: "", morphId: "m-1" }),
      ]),
    );
    vi.mocked(listPetMorphs).mockResolvedValue([
      { id: "m-1", speciesId: "sp-sugar-glider", code: "C", name: "Mosaic" },
    ]);
    renderPage();
    expect(
      await screen.findByRole("link", { name: /Mochi/ }),
    ).toHaveTextContent("Sugar Glider · Mosaic");
  });

  it("shows a way to add the first pet when there are none", async () => {
    vi.mocked(listPets).mockResolvedValue(petPageFixture([]));
    renderPage();
    expect(await screen.findByText(/No pets yet/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New pet" })).toHaveLength(2);
  });

  it("explains an empty search instead of offering to add a pet", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: /Mochi/ });
    vi.mocked(listPets).mockResolvedValue(petPageFixture([]));
    await user.type(screen.getByLabelText("Search pet or owner"), "zzz");
    expect(
      await screen.findByText("No pets match your search."),
    ).toBeInTheDocument();
  });

  it("shows an error with retry when the list fails", async () => {
    vi.mocked(listPets).mockRejectedValueOnce(new Error("Server is down"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Server is down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: /Mochi/ }),
    ).toBeInTheDocument();
  });
});
