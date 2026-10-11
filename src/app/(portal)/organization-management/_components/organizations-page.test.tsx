import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveApplication,
  getMyApplications,
  getWaitingApplications,
  rejectApplication,
  submitApplication,
} from "@/domains/organizations/api";
import { OrganizationsPage } from "./organizations-page";

let session: { roles: string[]; permissions: string[] };

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    ...session,
    memberships: [],
    assignments: [],
    user: { id: "u1", email: "me@example.com" },
    refreshSession: vi.fn(),
  }),
}));
vi.mock("@/domains/organizations/api", () => {
  const application = (over: Record<string, unknown>) => ({
    id: "a1",
    organizationName: "Bekasi Pet Club",
    organizationType: "",
    description: "",
    contactEmail: "hello@bekasipet.id",
    contactPhone: "",
    address: "Jl. Ahmad Yani 5",
    status: "SUBMITTED",
    reviewNote: "",
    approvedOrganizationId: null,
    applicantName: "Sari Wulandari",
    applicantEmail: null,
    ...over,
  });
  return {
    listOrganizationPage: vi.fn().mockResolvedValue({
      items: [
        { id: "o1", name: "East Java Pet Sport" },
        { id: "o2", name: "KPSGI Jakarta" },
      ],
      meta: { page: 1, perPage: 10, total: 2, lastPage: 1 },
    }),
    listOrganizations: vi.fn().mockResolvedValue([]),
    listOrganizationDirectory: vi.fn().mockResolvedValue([
      { id: "o1", name: "East Java Pet Sport" },
      { id: "o2", name: "KPSGI Jakarta" },
    ]),
    getWaitingApplications: vi.fn().mockResolvedValue([application({})]),
    getPendingVerifications: vi.fn().mockResolvedValue([]),
    getMyApplications: vi.fn().mockResolvedValue([]),
    approveApplication: vi.fn().mockResolvedValue({}),
    rejectApplication: vi.fn().mockResolvedValue({}),
    submitApplication: vi.fn().mockResolvedValue({}),
    cancelApplication: vi.fn().mockResolvedValue(null),
  };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session = { roles: ["SUPER_ADMIN"], permissions: [] };
});

describe("OrganizationsPage", () => {
  it("lists verified organizers as links to their detail page", async () => {
    renderPage();
    const link = await screen.findByRole("link", {
      name: /East Java Pet Sport/,
    });
    expect(link).toHaveAttribute("href", "/organization-management/o1");
    expect(
      screen.getByText(/Showing 1.2 of 2 organizations/),
    ).toBeInTheDocument();
  });

  it("shows New organization to reviewers only", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "New organization" });
    expect(link).toHaveAttribute("href", "/organization-management/create");
    cleanup();
    session = { roles: ["USER"], permissions: [] };
    renderPage();
    await screen.findByRole("button", { name: "Apply as organizer" });
    expect(
      screen.queryByRole("link", { name: "New organization" }),
    ).not.toBeInTheDocument();
  });

  it("narrows the list with the filter panel", async () => {
    renderPage();
    await screen.findByRole("link", { name: /East Java Pet Sport/ });
    await userEvent.click(screen.getByRole("button", { name: /Filter/ }));
    await userEvent.click(screen.getByLabelText("Has an email"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("No organizations match these filters."),
    ).toBeInTheDocument();
  });

  it("lets a reviewer approve an application", async () => {
    renderPage();
    expect(await screen.findByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByText(/Applied by Sari Wulandari/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Approve Bekasi Pet Club"));
    await waitFor(() => expect(approveApplication).toHaveBeenCalledWith("a1"));
    expect(getMyApplications).not.toHaveBeenCalled();
  });

  it("requires a reason to reject", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByLabelText("Reject Bekasi Pet Club"),
    );
    const submit = await screen.findByRole("button", {
      name: "Reject application",
    });
    await userEvent.click(submit);
    expect(await screen.findByText(/Write a short reason/)).toBeInTheDocument();
    expect(rejectApplication).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Reason/), "Add a phone number");
    await userEvent.click(submit);
    await waitFor(() =>
      expect(rejectApplication).toHaveBeenCalledWith(
        "a1",
        "Add a phone number",
      ),
    );
  });

  it("shows a plain user the apply form instead of the review queue", async () => {
    session = { roles: ["USER"], permissions: [] };
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Apply as organizer" }),
    );
    expect(getWaitingApplications).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Contact email/)).toHaveValue(
      "me@example.com",
    );
    await userEvent.type(
      screen.getByLabelText(/Organization name/),
      "Depok Club",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit application" }),
    );
    await waitFor(() =>
      expect(submitApplication).toHaveBeenCalledWith({
        proposed_organization_name: "Depok Club",
        contact_email: "me@example.com",
      }),
    );
  });
});
