import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUser,
  listCities,
  listProvinces,
  listRoles,
} from "@/domains/users/api";
import { UserCreatePage } from "./user-form";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ can: () => true, hasRole: () => false }),
}));
vi.mock("@/domains/users/api", () => ({
  createUser: vi.fn(),
  listRoles: vi.fn(),
  listProvinces: vi.fn(),
  listCities: vi.fn(),
}));

const role = (code: string, name: string) => ({
  id: code,
  code,
  name,
  description: "",
  permissions: null,
  usersCount: null,
});

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UserCreatePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(createUser).mockReset();
  vi.mocked(listRoles).mockResolvedValue([
    role("SUPER_ADMIN", "Super Admin"),
    role("ORGANIZER", "Organizer"),
    role("USER", "User"),
  ]);
  vi.mocked(listProvinces).mockResolvedValue([
    { id: "p35", name: "Jawa Timur" },
  ]);
  vi.mocked(listCities).mockResolvedValue([{ id: "c1", name: "Surabaya" }]);
});

describe("UserCreatePage", () => {
  it("has no district field, ticks User by default and hides Super admin from non super admins", async () => {
    renderForm();
    expect(await screen.findByLabelText("User")).toBeChecked();
    expect(screen.getByLabelText("Organizer")).not.toBeChecked();
    expect(screen.queryByLabelText("Super Admin")).toBeNull();
    expect(screen.queryByText(/district|kecamatan/i)).toBeNull();
  });

  it("shows the design messages and does not send an invalid form", async () => {
    renderForm();
    await userEvent.click(
      await screen.findByRole("button", { name: "Create user" }),
    );
    expect(
      await screen.findByText("First name is required."),
    ).toBeInTheDocument();
    expect(screen.getByText("Username is required.")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Phone/), "0812345");
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(
      await screen.findByText("Numbers only, 8-15 digits."),
    ).toBeInTheDocument();
  });

  it("creates the user and opens the detail page", async () => {
    vi.mocked(createUser).mockResolvedValue({
      user: {
        id: "new1",
      } as never,
      profileError: null,
    });
    renderForm();
    await screen.findByLabelText("Organizer");
    await userEvent.type(screen.getByLabelText(/First name/), "Salsa");
    await userEvent.type(screen.getByLabelText(/Username/), "salsa.putri");
    await userEvent.type(screen.getByLabelText(/Email/), "salsa@example.com");
    await userEvent.type(screen.getByLabelText(/Phone/), "081234567802");
    await userEvent.selectOptions(
      await screen.findByLabelText("Province"),
      "Jawa Timur",
    );
    await userEvent.selectOptions(
      await screen.findByLabelText("City"),
      "Surabaya",
    );
    await userEvent.click(screen.getByLabelText("Organizer"));
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    await waitFor(() => expect(createUser).toHaveBeenCalled());
    expect(vi.mocked(createUser).mock.calls[0][0]).toMatchObject({
      firstName: "Salsa",
      username: "salsa.putri",
      province: "Jawa Timur",
      city: "Surabaya",
      roles: ["USER", "ORGANIZER"],
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/user-management/new1"),
    );
  });
});
