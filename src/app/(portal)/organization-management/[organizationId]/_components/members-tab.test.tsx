import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeMemberRole,
  getOrganizationMembers,
  removeMember,
} from "@/domains/organizations/api";
import { MembersTab } from "./members-tab";

/** Sesi yang dipakai tes; diganti per kasus lewat `signInAs`. */
let session: {
  roles: string[];
  permissions: string[];
  memberships: { organizationId: string; role: string }[];
};
const signInAs = (role: string | null) => {
  session = {
    roles: ["USER"],
    permissions: [],
    memberships: role ? [{ organizationId: "org1", role }] : [],
  };
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    ...session,
    assignments: [],
    user: { id: "someone-else" },
    refreshSession: vi.fn(),
  }),
}));
vi.mock("@/domains/organizations/api", () => {
  const member = (id: string, name: string, role: string) => ({
    id,
    userId: `u-${id}`,
    name,
    email: `${id}@example.com`,
    role,
  });
  return {
    getOrganization: vi.fn().mockResolvedValue({
      id: "org1",
      name: "East Java Pet Sport",
    }),
    getOrganizationMembers: vi
      .fn()
      .mockResolvedValue([
        member("salsa", "Salsa Putri", "OWNER"),
        member("rani", "Rani Kusuma", "ADMIN"),
        member("nadia", "Nadia Safitri", "STAFF"),
      ]),
    changeMemberRole: vi.fn().mockResolvedValue({}),
    removeMember: vi.fn().mockResolvedValue(null),
  };
});

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MembersTab organizationId="org1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("OWNER");
});

describe("MembersTab", () => {
  it("shows the member list with filters and page info", async () => {
    renderTab();
    expect(await screen.findByText("Salsa Putri")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1.3 of 3 members/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Filter member"), "rani");
    expect(screen.queryByText("Salsa Putri")).not.toBeInTheDocument();
    expect(screen.getByText("Rani Kusuma")).toBeInTheDocument();
  });

  it("lets an owner change a role, but not demote the last owner", async () => {
    renderTab();
    const select = await screen.findByLabelText("Role of Rani Kusuma");
    expect(
      screen.queryByLabelText("Role of Salsa Putri"),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(select, "STAFF");
    await waitFor(() =>
      expect(changeMemberRole).toHaveBeenCalledWith("org1", "u-rani", "STAFF"),
    );
  });

  it("asks for confirmation before removing a member", async () => {
    renderTab();
    await userEvent.click(await screen.findByLabelText("Remove Nadia Safitri"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/East Java Pet Sport/)).toBeInTheDocument();
    expect(removeMember).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove" }),
    );
    await waitFor(() =>
      expect(removeMember).toHaveBeenCalledWith("org1", "u-nadia"),
    );
  });

  it("hides role editing for admins and any action for staff", async () => {
    signInAs("ADMIN");
    const { unmount } = renderTab();
    expect(await screen.findByText("Nadia Safitri")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Role of Rani Kusuma"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Remove Nadia Safitri")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Remove Salsa Putri"),
    ).not.toBeInTheDocument();
    unmount();

    signInAs("STAFF");
    renderTab();
    expect(await screen.findByText("Nadia Safitri")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Remove /)).not.toBeInTheDocument();
  });

  it("does not call the API for a non-member", async () => {
    signInAs(null);
    renderTab();
    expect(await screen.findByRole("status")).toHaveTextContent(
      /Only members of this organization/,
    );
    expect(getOrganizationMembers).not.toHaveBeenCalled();
  });
});
