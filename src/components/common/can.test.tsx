import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Can, RequirePermission } from "./can";

let granted = false;
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ can: () => granted }),
}));

describe("Can / RequirePermission", () => {
  it("hides content without the permission", () => {
    granted = false;
    render(<Can permission="event.create">secret</Can>);
    expect(screen.queryByText("secret")).toBeNull();
  });
  it("shows content with the permission", () => {
    granted = true;
    render(<Can permission="event.create">secret</Can>);
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
  it("shows a 403 instead of the page", () => {
    granted = false;
    render(<RequirePermission permission="user.view">page</RequirePermission>);
    expect(screen.getByRole("alert")).toHaveTextContent("No access");
    expect(screen.queryByText("page")).toBeNull();
  });
});
