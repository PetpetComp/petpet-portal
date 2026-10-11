import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePet,
  getPet,
  listPetMorphs,
  listSpecies,
} from "@/domains/pets/api";
import { ApiError } from "@/lib/api-client";
import { petFixture } from "@/test/pet-fixtures";
import { PetDetailPage } from "./pet-detail-page";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/domains/pets/api", () => ({
  getPet: vi.fn(),
  deletePet: vi.fn(),
  listSpecies: vi.fn(),
  listPetMorphs: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PetDetailPage petId="p1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(getPet).mockReset();
  vi.mocked(deletePet).mockReset();
  vi.mocked(listSpecies).mockResolvedValue([]);
  vi.mocked(listPetMorphs).mockResolvedValue([]);
});

describe("PetDetailPage", () => {
  it("shows the pet's details", async () => {
    vi.mocked(getPet).mockResolvedValue(
      petFixture({ registrationNumber: "REG-7", heightCm: 12.5 }),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Mochi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sugar Glider · Caramel")).toBeInTheDocument();
    expect(screen.getByText("Andi Pratama")).toBeInTheDocument();
    expect(screen.getByText("REG-7")).toBeInTheDocument();
    expect(screen.getByText("12.5 cm")).toBeInTheDocument();
    expect(screen.getByText("130 g")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/pet-management/p1/edit",
    );
  });

  it("asks for confirmation before deleting, then returns to the list", async () => {
    vi.mocked(getPet).mockResolvedValue(petFixture());
    vi.mocked(deletePet).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(deletePet).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete pet" }));
    await waitFor(() => expect(deletePet).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pet-management"));
  });

  it("stays on the page when the server refuses the delete", async () => {
    vi.mocked(getPet).mockResolvedValue(petFixture());
    vi.mocked(deletePet).mockRejectedValue(
      new ApiError(
        422,
        "This pet has competition entries and cannot be deleted.",
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete pet" }));
    await waitFor(() => expect(deletePet).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("hides Delete and explains why when the pet has entries", async () => {
    vi.mocked(getPet).mockResolvedValue(
      petFixture({ actions: { update: true, delete: false } }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Mochi" });
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText(/has competition entries/)).toBeInTheDocument();
  });

  it("hides Edit and Delete when the server allows neither", async () => {
    vi.mocked(getPet).mockResolvedValue(
      petFixture({ actions: { update: false, delete: false } }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Mochi" });
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("shows the server's message when the pet cannot be opened", async () => {
    vi.mocked(getPet).mockRejectedValue(new ApiError(404, "Pet not found."));
    renderPage();
    expect(await screen.findByText("Pet not found.")).toBeInTheDocument();
  });
});
