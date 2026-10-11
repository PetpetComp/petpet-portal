import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPet,
  getPet,
  listPetMorphs,
  listSpecies,
  updatePet,
} from "@/domains/pets/api";
import { searchUsers } from "@/domains/users/api";
import { ApiError } from "@/lib/api-client";
import { petFixture } from "@/test/pet-fixtures";
import { PetCreatePage, PetEditPage } from "./pet-form-page";

const mode = vi.hoisted(() => ({ mock: true, staff: true }));
vi.mock("@/lib/backend-mode", () => ({
  get USING_MOCK_BACKEND() {
    return mode.mock;
  },
}));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ can: () => mode.staff }),
}));
vi.mock("@/domains/pets/api", () => ({
  createPet: vi.fn(),
  updatePet: vi.fn(),
  getPet: vi.fn(),
  listSpecies: vi.fn(),
  listPetMorphs: vi.fn(),
}));
vi.mock("@/domains/users/api", () => ({ searchUsers: vi.fn() }));

function renderInClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  mode.mock = true;
  mode.staff = true;
  push.mockReset();
  vi.mocked(createPet).mockReset();
  vi.mocked(updatePet).mockReset();
  vi.mocked(getPet).mockReset();
  vi.mocked(listSpecies).mockResolvedValue([
    { id: "sp-1", code: "SUGAR_GLIDER", name: "Sugar Glider" },
    { id: "sp-2", code: "OTHER", name: "Other species" },
  ]);
  vi.mocked(listPetMorphs).mockResolvedValue([
    { id: "m-1", speciesId: "sp-1", code: "CARAMEL", name: "Caramel" },
    { id: "m-2", speciesId: "sp-1", code: "MOSAIC", name: "Mosaic" },
    { id: "m-3", speciesId: "sp-2", code: "ODD", name: "Odd morph" },
  ]);
  vi.mocked(searchUsers).mockResolvedValue({
    items: [
      {
        id: "u-9",
        name: "Salsa Putri",
        email: "salsa@example.com",
        phone: null,
        isMember: false,
      },
    ],
    total: 1,
  });
});

describe("PetCreatePage", () => {
  it("offers only the morphs of the chosen species and resets them on change", async () => {
    const user = userEvent.setup();
    renderInClient(<PetCreatePage />);
    const speciesSelect = await screen.findByLabelText(/Species/);
    const morphSelect = screen.getByLabelText("Morph");
    expect(morphSelect).toBeDisabled();

    await user.selectOptions(speciesSelect, "sp-1");
    expect(
      within(morphSelect)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["No morph", "Caramel", "Mosaic"]);
    await user.selectOptions(morphSelect, "m-2");

    await user.selectOptions(speciesSelect, "sp-2");
    expect(morphSelect).toHaveValue("");
    expect(
      within(morphSelect)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["No morph", "Odd morph"]);
  });

  it("validates before sending", async () => {
    const user = userEvent.setup();
    renderInClient(<PetCreatePage />);
    await user.click(await screen.findByRole("button", { name: "Create pet" }));
    expect(
      await screen.findByText("Pet name is required."),
    ).toBeInTheDocument();
    expect(screen.getByText("Species is required.")).toBeInTheDocument();
    expect(createPet).not.toHaveBeenCalled();
  });

  it("creates the pet with the owner picked by staff and opens its detail", async () => {
    vi.mocked(createPet).mockResolvedValue(petFixture({ id: "new-1" }));
    const user = userEvent.setup();
    renderInClient(<PetCreatePage />);
    await user.type(await screen.findByLabelText("Search owner"), "sal");
    await user.click(
      await screen.findByRole("button", { name: /Salsa Putri/ }),
    );
    await user.type(screen.getByLabelText(/Pet name/), "Pico");
    await user.selectOptions(screen.getByLabelText(/Species/), "sp-1");
    await user.selectOptions(screen.getByLabelText("Morph"), "m-1");
    await user.type(screen.getByLabelText(/Weight/), "130");
    await user.click(screen.getByRole("button", { name: "Create pet" }));

    await waitFor(() => expect(createPet).toHaveBeenCalled());
    expect(vi.mocked(createPet).mock.calls[0][0]).toEqual({
      name: "Pico",
      species_id: "sp-1",
      morph_id: "m-1",
      registration_number: null,
      gender: null,
      birth_date: null,
      height_cm: null,
      weight_grams: 130,
      owner_id: "u-9",
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/pet-management/new-1"),
    );
  });

  it("hides the owner picker on the real backend", async () => {
    mode.mock = false;
    renderInClient(<PetCreatePage />);
    await screen.findByLabelText(/Species/);
    expect(screen.queryByLabelText("Search owner")).toBeNull();
    expect(
      screen.getByText("The pet is registered under your account."),
    ).toBeInTheDocument();
  });

  it("puts a server 422 on the field it belongs to", async () => {
    vi.mocked(createPet).mockRejectedValue(
      new ApiError(422, "Taken.", {
        registration_number: [
          "The registration number has already been taken.",
        ],
      }),
    );
    const user = userEvent.setup();
    renderInClient(<PetCreatePage />);
    await user.type(await screen.findByLabelText(/Pet name/), "Pico");
    await user.selectOptions(screen.getByLabelText(/Species/), "sp-1");
    await user.click(screen.getByRole("button", { name: "Create pet" }));
    expect(
      await screen.findByText(
        "The registration number has already been taken.",
      ),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("PetEditPage", () => {
  it("fills the form from the pet and saves the changes", async () => {
    vi.mocked(getPet).mockResolvedValue(
      petFixture({ speciesId: "sp-1", morphId: "m-1" }),
    );
    vi.mocked(updatePet).mockResolvedValue(petFixture({ name: "Mochi II" }));
    const user = userEvent.setup();
    renderInClient(<PetEditPage petId="p1" />);
    const name = await screen.findByLabelText(/Pet name/);
    await waitFor(() => expect(name).toHaveValue("Mochi"));
    expect(screen.getByLabelText("Morph")).toHaveValue("m-1");
    await user.clear(name);
    await user.type(name, "Mochi II");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updatePet).toHaveBeenCalled());
    expect(vi.mocked(updatePet).mock.calls[0][0]).toBe("p1");
    expect(vi.mocked(updatePet).mock.calls[0][1]).toMatchObject({
      name: "Mochi II",
      species_id: "sp-1",
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/pet-management/p1"),
    );
  });

  it("locks species and morph on the real backend and does not send them", async () => {
    mode.mock = false;
    vi.mocked(getPet).mockResolvedValue(
      petFixture({ speciesId: "sp-1", morphId: "m-1" }),
    );
    vi.mocked(updatePet).mockResolvedValue(petFixture());
    const user = userEvent.setup();
    renderInClient(<PetEditPage petId="p1" />);
    const species = await screen.findByLabelText(/Species/);
    expect(species).toBeDisabled();
    expect(screen.getByLabelText("Morph")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updatePet).toHaveBeenCalled());
    const body = vi.mocked(updatePet).mock.calls[0][1];
    expect(body).not.toHaveProperty("species_id");
    expect(body).not.toHaveProperty("morph_id");
  });

  it("shows 403 instead of the form when the server does not allow editing", async () => {
    vi.mocked(getPet).mockResolvedValue(
      petFixture({ actions: { update: false, delete: false } }),
    );
    renderInClient(<PetEditPage petId="p1" />);
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });

  it("shows the server message when the pet cannot be loaded", async () => {
    vi.mocked(getPet).mockRejectedValue(
      new ApiError(403, "You do not own this resource."),
    );
    renderInClient(<PetEditPage petId="p1" />);
    expect(
      await screen.findByText("You do not own this resource."),
    ).toBeInTheDocument();
  });
});
