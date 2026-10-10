import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventWithPic } from "@/domains/events/api";
import { searchUsers } from "@/domains/users/api";
import { EventCreateWizard } from "./event-create-wizard";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    hasRole: () => true, // super admin
    memberships: [],
    can: () => true,
  }),
}));
vi.mock("@/domains/organizations/api", () => ({
  listOrganizations: vi.fn().mockResolvedValue([
    { id: "o1", name: "East Java Pet Sport" },
    { id: "o2", name: "Solo Exotic Pet Community" },
  ]),
}));
vi.mock("@/domains/users/api", () => ({
  searchUsers: vi.fn().mockResolvedValue({
    items: [
      {
        id: "u1",
        name: "Salsa Putri",
        email: "salsa.putri@example.com",
        phone: null,
        isMember: true,
      },
    ],
    total: 1,
  }),
}));
vi.mock("@/domains/events/api", () => ({ createEventWithPic: vi.fn() }));

function renderWizard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EventCreateWizard />
    </QueryClientProvider>,
  );
}

/** Mengisi langkah 1 dengan data valid lalu menekan Continue. */
async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText(/Event name/),
    "Surabaya Paw Race 2026",
  );
  await user.type(screen.getByLabelText(/Start/), "2026-09-04T10:00");
  await user.type(screen.getByLabelText(/End/), "2026-09-04T20:00");
  await user.click(
    screen.getByRole("button", { name: "Continue to organizer" }),
  );
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(createEventWithPic).mockReset();
  vi.mocked(createEventWithPic).mockResolvedValue({
    eventId: "new1",
    eventName: "Surabaya Paw Race 2026",
    inviteError: null,
  });
});

describe("EventCreateWizard", () => {
  it("blocks step 1 until the required fields are valid", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(
      screen.getByRole("button", { name: "Continue to organizer" }),
    );
    expect(
      await screen.findByText("Event name is required."),
    ).toBeInTheDocument();
    expect(screen.getByText("Start is required.")).toBeInTheDocument();
    expect(screen.queryByText("Search organization")).not.toBeInTheDocument();
  });

  it("rejects an end before the start", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByLabelText(/Event name/), "Paw Race");
    await user.type(screen.getByLabelText(/Start/), "2026-09-04T10:00");
    await user.type(screen.getByLabelText(/End/), "2026-09-04T09:00");
    await user.click(
      screen.getByRole("button", { name: "Continue to organizer" }),
    );
    expect(
      await screen.findByText("End must be after the start."),
    ).toBeInTheDocument();
  });

  it("needs an organizer before the review, and saves nothing until the last step", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await user.click(
      await screen.findByRole("button", { name: "Review event" }),
    );
    expect(
      await screen.findByText("Choose the organizer of this event."),
    ).toBeInTheDocument();
    expect(createEventWithPic).not.toHaveBeenCalled();
  });

  it("walks through all three steps and creates the event with organizer and PIC", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);

    await user.click(
      await screen.findByRole("button", { name: /East Java Pet Sport/ }),
    );
    await user.type(
      screen.getByLabelText("Search user by name, email or phone"),
      "sa",
    );
    await user.click(
      await screen.findByRole("button", { name: /Salsa Putri/ }),
    );
    expect(vi.mocked(searchUsers)).toHaveBeenCalledWith("sa", "o1");
    await user.click(screen.getByRole("button", { name: "Review event" }));

    expect(
      await screen.findByText("Organizer & PIC", { selector: "b" }),
    ).toBeInTheDocument();
    expect(createEventWithPic).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(createEventWithPic).toHaveBeenCalledTimes(1));
    const input = vi.mocked(createEventWithPic).mock.calls[0][0];
    expect(input.details.name).toBe("Surabaya Paw Race 2026");
    expect(input.organizer).toEqual({
      kind: "existing",
      id: "o1",
      name: "East Java Pet Sport",
    });
    expect(input.pic).toMatchObject({
      kind: "user",
      email: "salsa.putri@example.com",
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/event-management/new1"),
    );
  });

  it("accepts an invitation by email as the PIC and rejects a bad address", async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillDetails(user);
    await user.click(
      await screen.findByRole("button", { name: /East Java Pet Sport/ }),
    );
    await user.click(screen.getByRole("button", { name: "Invite by email" }));
    await user.type(screen.getByLabelText(/^Email/), "nope");
    await user.click(screen.getByRole("button", { name: "Use this email" }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText(/^Email/), "new.pic@example.com");
    await user.click(screen.getByRole("button", { name: "Use this email" }));
    expect(screen.getByText("Invitation by email")).toBeInTheDocument();
  });
});
