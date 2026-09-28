import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OrganizationWorkspace } from "./organization-workspace";
import { ORGANIZATION_SERVICES } from "@/services/organization";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  user: { id: "signed-in" },
  portal: {
    data: {
      users: [
        {
          id: "u1",
          name: "Citra",
          email: "citra@example.com",
          phone: "081234567890",
        },
      ],
    },
    errors: {},
    save: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/components/providers/portal-data-provider", () => ({
  usePortalData: () => state.portal,
}));
beforeEach(() => {
  localStorage.clear();
  state.push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("loads organizations from the server including campaign, photo and PIC contact data", async () => {
  vi.spyOn(ORGANIZATION_SERVICES, "list").mockResolvedValue({
    success: true,
    message: "OK",
    data: [
      {
        uuid: "org1",
        name: "ScaleCare",
        campaign: "Every Pet",
        photo_url: "https://photos.example/logo.png",
        pics: [{ uuid: "u1", name: "Citra" }],
      },
    ],
  });
  render(<OrganizationWorkspace />);
  expect(await screen.findByText("ScaleCare")).toBeInTheDocument();
  expect(screen.getByText("Every Pet")).toBeInTheDocument();
  expect(screen.getByText(/citra@example.com/)).toBeInTheDocument();
});

it("keeps the create form and input visible when the API rejects saving", async () => {
  vi.spyOn(ORGANIZATION_SERVICES, "create").mockRejectedValue(
    new Error("Server rejected organization"),
  );
  render(<OrganizationWorkspace mode="create" />);
  fireEvent.change(screen.getByLabelText(/Organization Name/), {
    target: { value: "ScaleCare" },
  });
  fireEvent.focus(
    screen.getByPlaceholderText("Search PIC by name, email, or phone"),
  );
  fireEvent.click(screen.getByRole("button", { name: /Citra/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save Organization" }));
  expect(
    await screen.findByText("Server rejected organization"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/Organization Name/)).toHaveValue("ScaleCare");
  expect(state.push).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});

it("syncs a legacy browser draft and only clears it after the server confirms success", async () => {
  localStorage.setItem(
    "petpet.organization-drafts.v1.signed-in",
    JSON.stringify([
      {
        id: "draft-original",
        name: "Draft organization",
        photo: "",
        campaign: "Campaign",
        pics: [{ id: "u1", name: "Citra" }],
      },
    ]),
  );
  vi.spyOn(ORGANIZATION_SERVICES, "list").mockResolvedValue({
    success: true,
    message: "OK",
    data: [],
  });
  const create = vi
    .spyOn(ORGANIZATION_SERVICES, "create")
    .mockResolvedValue({
      success: true,
      message: "OK",
      data: { uuid: "server-org", name: "Draft organization" },
    });
  render(<OrganizationWorkspace mode="edit" id="draft:draft-original" />);
  await screen.findByDisplayValue("Draft organization");
  fireEvent.click(screen.getByRole("button", { name: "Save Organization" }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Draft organization", picIds: ["u1"] }),
    ),
  );
  await waitFor(() =>
    expect(state.push).toHaveBeenCalledWith("/organization-management"),
  );
  expect(
    JSON.parse(
      localStorage.getItem("petpet.organization-drafts.v1.signed-in")!,
    ),
  ).toEqual([]);
});

it("shows a failed detail request instead of allowing an accidental create", async () => {
  vi.spyOn(ORGANIZATION_SERVICES, "detail").mockRejectedValue(
    new Error("Organization unavailable"),
  );
  render(<OrganizationWorkspace mode="edit" id="org1" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Organization unavailable",
  );
  expect(
    screen.queryByRole("button", { name: "Save Organization" }),
  ).not.toBeInTheDocument();
});
