import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRoles, listUsers } from "@/domains/users/api";
import type { Role, User } from "@/domains/users/types";
import { UsersPage } from "./users-page";

// Mode backend bisa diganti per tes lewat objek ini.
const mode = vi.hoisted(() => ({ mock: true }));
vi.mock("@/lib/backend-mode", () => ({
  get USING_MOCK_BACKEND() {
    return mode.mock;
  },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("@/domains/users/api", () => ({
  listUsers: vi.fn(),
  listRoles: vi.fn(),
}));

const user = (over: Partial<User> = {}): User => ({
  id: "u1",
  username: "salsa.putri",
  email: "salsa.putri@example.com",
  firstName: "Salsa",
  lastName: "Putri",
  name: "Salsa Putri",
  initials: "SP",
  phone: "081234567802",
  status: "ACTIVE",
  emailVerified: true,
  gender: "FEMALE",
  address: "",
  city: "Surabaya",
  province: "Jawa Timur",
  roles: [{ id: "r1", code: "USER", name: "User" }],
  ...over,
});

const role = (code: string, name: string): Role => ({
  id: code,
  code,
  name,
  description: "",
  permissions: null,
  usersCount: null,
});

const page = (items: User[], total = items.length) => ({
  items,
  meta: { currentPage: 1, perPage: 8, total, lastPage: 1 },
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UsersPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mode.mock = true;
  vi.mocked(listUsers).mockReset();
  vi.mocked(listUsers).mockResolvedValue(page([user()], 11));
  vi.mocked(listRoles).mockReset();
  vi.mocked(listRoles).mockResolvedValue([
    role("USER", "User"),
    role("ORGANIZER", "Organizer"),
  ]);
});

describe("UsersPage", () => {
  it("lists users with username, email, phone, city, role and status", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "Salsa Putri" });
    const row = link.closest("[role=row]") as HTMLElement;
    expect(within(row).getByText("@salsa.putri")).toBeInTheDocument();
    expect(
      within(row).getByText("salsa.putri@example.com"),
    ).toBeInTheDocument();
    expect(within(row).getByText("081234567802")).toBeInTheDocument();
    expect(within(row).getByText("Surabaya")).toBeInTheDocument();
    expect(within(row).getByText("User")).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/of 11 users/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New user" })).toHaveAttribute(
      "href",
      "/user-management/create",
    );
  });

  it("sends the role filter to the server and returns to page 1", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Salsa Putri" });
    await userEvent.selectOptions(
      await screen.findByLabelText("Filter role"),
      "ORGANIZER",
    );
    await waitFor(() =>
      expect(listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: "ORGANIZER", page: 1 }),
      ),
    );
  });

  it("sends the status filter to the server", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Salsa Putri" });
    await userEvent.selectOptions(
      screen.getByLabelText("Filter status"),
      "SUSPENDED",
    );
    await waitFor(() =>
      expect(listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "SUSPENDED" }),
      ),
    );
  });

  it("shows email, phone and city filters only in mock mode", async () => {
    const { unmount } = renderPage();
    await screen.findByRole("link", { name: "Salsa Putri" });
    expect(screen.getByLabelText("Filter email")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter city")).toBeInTheDocument();
    unmount();

    mode.mock = false;
    renderPage();
    await screen.findByRole("link", { name: "Salsa Putri" });
    expect(screen.queryByLabelText("Filter email")).toBeNull();
    expect(screen.queryByLabelText("Filter phone")).toBeNull();
    expect(screen.queryByLabelText("Filter city")).toBeNull();
    expect(
      screen.getByLabelText("Filter name or username"),
    ).toBeInTheDocument();
  });

  it("shows an empty state with a way back when the filters match nobody", async () => {
    vi.mocked(listUsers).mockResolvedValue(page([]));
    renderPage();
    await userEvent.selectOptions(
      await screen.findByLabelText("Filter status"),
      "SUSPENDED",
    );
    expect(
      await screen.findByText("No users match these filters."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Show all users" }),
    );
    expect(screen.getByLabelText("Filter status")).toHaveValue("");
  });

  it("shows an error with a retry button when loading fails", async () => {
    vi.mocked(listUsers).mockRejectedValueOnce(new Error("Boom"));
    renderPage();
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: "Salsa Putri" }),
    ).toBeInTheDocument();
  });
});
