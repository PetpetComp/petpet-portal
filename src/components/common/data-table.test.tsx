import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./data-table";

type Row = { id: string; name: string };
const columns: Column<Row>[] = [
  {
    key: "name",
    label: "Name",
    value: (r) => r.name,
    filter: { type: "text" },
  },
];
const rows = Array.from({ length: 20 }, (_, i) => ({
  id: String(i),
  name: `Pet ${i}`,
}));

describe("DataTable", () => {
  it("pages client-side by default", async () => {
    render(<DataTable rows={rows} columns={columns} />);
    expect(screen.getAllByRole("row")).toHaveLength(1 + 1 + 10); // header + filter + 10
    await userEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getByText("Pet 10")).toBeInTheDocument();
  });

  it("shows filters disabled until the API supports them", () => {
    render(<DataTable rows={rows} columns={columns} />);
    expect(screen.getByLabelText("Filter Name")).toBeDisabled();
  });

  it("reports filter changes when supported", async () => {
    const onFilterChange = vi.fn();
    render(
      <DataTable
        rows={rows}
        columns={columns}
        onFilterChange={onFilterChange}
      />,
    );
    await userEvent.type(screen.getByLabelText("Filter Name"), "a");
    expect(onFilterChange).toHaveBeenCalledWith("name", "a");
  });

  it("trusts the rows it is given in server mode", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        rows={rows.slice(0, 3)}
        columns={columns}
        server={{
          page: 1,
          pageSize: 3,
          total: 20,
          onPageChange,
          onPageSizeChange: vi.fn(),
        }}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(1 + 1 + 3);
    expect(screen.getByText(/Showing 4–6 of 20/)).toBeInTheDocument();
  });
});

describe("DataTable sorting", () => {
  const unsorted = [
    { id: "1", name: "B" },
    { id: "2", name: "A" },
  ];
  const sortable: Column<Row>[] = [
    { key: "name", label: "Name", value: (r) => r.name },
  ];

  it("sorts rows locally in client mode", async () => {
    render(<DataTable rows={unsorted} columns={sortable} />);
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("A");
  });

  it("never re-sorts a server page, and locks the button until the API supports it", () => {
    render(
      <DataTable
        rows={unsorted}
        columns={sortable}
        server={{
          page: 0,
          pageSize: 2,
          total: 9,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
        sort={{ key: "name", direction: 1 }}
      />,
    );
    expect(screen.getByRole("button", { name: /Name/ })).toBeDisabled();
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("B");
  });

  it("hands the next sort to the caller in server mode", async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        rows={unsorted}
        columns={sortable}
        server={{
          page: 0,
          pageSize: 2,
          total: 9,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
        onSortChange={onSortChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "name", direction: 1 });
  });
});
