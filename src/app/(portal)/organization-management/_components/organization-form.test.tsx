import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OrganizationForm } from "./organization-form";
afterEach(cleanup);
const users = [
  {
    id: "u1",
    name: "Citra Permana",
    email: "citra@example.com",
    phone: "081234567890",
  },
  {
    id: "u2",
    name: "Naufal Anggraini",
    email: "naufal@example.com",
    phone: "081234567891",
  },
];
function select(name: string) {
  fireEvent.focus(
    screen.getByPlaceholderText("Search PIC by name, email, or phone"),
  );
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
}
it("selects multiple PICs, removes a selection, and saves trimmed organization fields", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <OrganizationForm users={users} onSave={save} onCreateUser={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText(/Organization Name/), {
    target: { value: " ScaleCare " },
  });
  fireEvent.change(screen.getByLabelText("Campaign"), {
    target: { value: " Every Pet " },
  });
  select("Citra Permana");
  select("Naufal Anggraini");
  expect(screen.getByText("2 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove Citra Permana" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Organization" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      name: "ScaleCare",
      campaign: "Every Pet",
      photo: "",
      picIds: ["u2"],
    }),
  );
});
it("requires a PIC and retains input when saving fails", async () => {
  const save = vi.fn().mockRejectedValue(new Error("Storage full"));
  render(
    <OrganizationForm users={users} onSave={save} onCreateUser={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText(/Organization Name/), {
    target: { value: "ScaleCare" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Organization" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "at least one PIC",
  );
  expect(save).not.toHaveBeenCalled();
  select("Citra Permana");
  fireEvent.click(screen.getByRole("button", { name: "Save Organization" }));
  expect(await screen.findByText("Storage full")).toBeInTheDocument();
  expect(screen.getByLabelText(/Organization Name/)).toHaveValue("ScaleCare");
});
it("keeps failed new-user input and assigns the server ID only after a successful retry", async () => {
  const create = vi
    .fn()
    .mockRejectedValueOnce(new Error("Email already registered"))
    .mockResolvedValueOnce({
      id: "server-user",
      name: "New PIC",
      email: "new@example.com",
      phone: "081234567899",
    });
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <OrganizationForm users={users} onSave={save} onCreateUser={create} />,
  );
  fireEvent.change(screen.getByLabelText(/Organization Name/), {
    target: { value: "ScaleCare" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add User" }));
  fireEvent.change(screen.getByLabelText(/First Name/), {
    target: { value: "New" },
  });
  fireEvent.change(screen.getByLabelText("Last Name"), {
    target: { value: "PIC" },
  });
  fireEvent.change(screen.getByLabelText(/Email/), {
    target: { value: "new@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/Phone/), {
    target: { value: "081234567899" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add & Assign PIC" }));
  expect(
    await screen.findByText("Email already registered"),
  ).toBeInTheDocument();
  expect(screen.getByText("0 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add & Assign PIC" }));
  expect(await screen.findByText("1 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save Organization" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ picIds: ["server-user"] }),
    ),
  );
});
