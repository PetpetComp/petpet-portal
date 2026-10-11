import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPermissionGroups, listRoles } from "@/domains/users/api";
import type { PermissionGroup, Role } from "@/domains/users/types";
import { RolesPage } from "./roles-page";

vi.mock("@/domains/users/api", () => ({
  listRoles: vi.fn(),
  listPermissionGroups: vi.fn(),
}));

const role = (code: string, name: string, over: Partial<Role> = {}): Role => ({
  id: code,
  code,
  name,
  description: `${name} description`,
  permissions: ["event.view"],
  usersCount: 3,
  ...over,
});

const perm = (code: string, name: string) => ({
  code,
  name,
  description: "",
});

const groups: PermissionGroup[] = [
  {
    module: "event",
    permissions: [
      perm("event.view", "View Events"),
      perm("event.create", "Create Event"),
    ],
  },
  { module: "user", permissions: [perm("user.view", "View Users")] },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RolesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listRoles).mockReset();
  vi.mocked(listPermissionGroups).mockReset();
  vi.mocked(listPermissionGroups).mockResolvedValue(groups);
  vi.mocked(listRoles).mockResolvedValue([
    role("USER", "User"),
    role("JUDGE", "Judge", { permissions: ["event.view", "user.view"] }),
    role("SUPER_ADMIN", "Super Admin", {
      permissions: ["event.view", "event.create", "user.view"],
      usersCount: 1,
    }),
  ]);
});

describe("RolesPage", () => {
  it("shows a card and a column for every role the API returns", async () => {
    renderPage();
    const cards = await screen.findByRole("region", { name: "Roles" });
    expect(within(cards).getAllByRole("button")).toHaveLength(3);
    expect(within(cards).getByText("1 user")).toBeInTheDocument();
    expect(
      within(cards).getByText(/SUPER_ADMIN · 3 permissions/),
    ).toBeInTheDocument();
    const matrix = screen.getByRole("region", { name: "Permission matrix" });
    expect(within(matrix).getByText("SUPER")).toBeInTheDocument();
    expect(within(matrix).getByText("JUDGE")).toBeInTheDocument();
  });

  it("marks granted and not granted cells per role", async () => {
    renderPage();
    const matrix = await screen.findByRole("region", {
      name: "Permission matrix",
    });
    expect(within(matrix).getAllByLabelText("Granted to Judge")).toHaveLength(
      2,
    );
    expect(
      within(matrix).getAllByLabelText("Not granted to Judge"),
    ).toHaveLength(1);
  });

  it("filters the matrix by code or name and by module", async () => {
    renderPage();
    const matrix = await screen.findByRole("region", {
      name: "Permission matrix",
    });
    await userEvent.type(
      within(matrix).getByLabelText("Filter permission"),
      "create",
    );
    expect(within(matrix).getByText("event.create")).toBeInTheDocument();
    expect(within(matrix).queryByText("event.view")).toBeNull();
    await userEvent.clear(within(matrix).getByLabelText("Filter permission"));
    await userEvent.selectOptions(
      within(matrix).getByLabelText("Filter module"),
      "user",
    );
    expect(within(matrix).queryByText("event.view")).toBeNull();
    expect(within(matrix).getByText("user.view")).toBeInTheDocument();
  });

  it("highlights the picked role", async () => {
    renderPage();
    const cards = await screen.findByRole("region", { name: "Roles" });
    const judge = within(cards).getByRole("button", { name: /Judge/ });
    await userEvent.click(judge);
    expect(judge).toHaveAttribute("aria-pressed", "true");
  });

  it("hides counts and shows a note when the API sends no grants or user counts", async () => {
    vi.mocked(listRoles).mockResolvedValue([
      role("USER", "User", { permissions: null, usersCount: null }),
    ]);
    renderPage();
    expect(await screen.findByRole("status")).toHaveTextContent(
      /does not list which permissions/,
    );
    const cards = screen.getByRole("region", { name: "Roles" });
    expect(within(cards).queryByText(/users?$/)).toBeNull();
    expect(within(cards).queryByText(/permissions/)).toBeNull();
    expect(screen.getAllByLabelText("Unknown for User").length).toBe(3);
  });

  it("shows an error with retry when the permissions fail to load", async () => {
    vi.mocked(listPermissionGroups).mockRejectedValueOnce(
      new Error("403 here"),
    );
    renderPage();
    expect(await screen.findByText("403 here")).toBeInTheDocument();
  });
});
