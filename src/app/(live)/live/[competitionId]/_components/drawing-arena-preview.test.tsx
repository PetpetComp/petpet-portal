import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DrawingMatch } from "@/domains/drawing/types";
import { DrawingArenaPreview, initialsOf } from "./drawing-arena-preview";

/** Match dari daftar [petName, ownerName]; lane berurutan dari 1. */
function match(number: number, rows: [string, string][]): DrawingMatch {
  return {
    id: `h${number}`,
    number,
    status: "SCHEDULED",
    lanes: rows.map(([petName, ownerName], index) => ({
      entryId: `${number}-${index + 1}`,
      petName,
      ownerName,
      bibNumber: "",
      laneNumber: index + 1,
    })),
  };
}

describe("DrawingArenaPreview", () => {
  const matches = [
    match(1, [
      ["Puffy Dodo", "Bagas"],
      ["Rex", "Alya"],
      ["Kiki", "Citra"],
    ]),
    match(2, [["Mochi", "Dewi"]]),
  ];

  /** Parent kecil yang memegang pilihan match, seperti DraftDrawing. */
  function Harness({ revealing = false }: { revealing?: boolean }) {
    const [selected, setSelected] = useState(1);
    return (
      <DrawingArenaPreview
        matches={matches}
        selectedNumber={selected}
        onSelect={setSelected}
        laneCount={4}
        revealing={revealing}
      />
    );
  }

  it("draws one lane per lane number, with a dashed empty lane for missing pets", () => {
    render(<Harness />);
    const arena = screen.getByRole("region", { name: "Arena preview" });
    const lanes = within(arena).getAllByRole("listitem");
    expect(lanes).toHaveLength(4);
    expect(lanes[0]).toHaveAttribute("aria-label", "Lane 1, Puffy Dodo");
    expect(lanes[0]).toHaveTextContent("PD");
    expect(lanes[2]).toHaveAttribute("aria-label", "Lane 3, Kiki");
    expect(lanes[3]).toHaveAttribute("aria-label", "Lane 4, empty");
    expect(lanes[3]).toHaveAttribute("data-lane-state", "empty");
  });

  it("switches to another match with the selector buttons", () => {
    render(<Harness />);
    const arena = screen.getByRole("region", { name: "Arena preview" });
    const button = (name: string) =>
      within(arena).getByRole("button", { name });
    expect(button("Match 1")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("Match 2"));
    expect(button("Match 2")).toHaveAttribute("aria-pressed", "true");
    const lanes = within(arena).getAllByRole("listitem");
    expect(lanes[0]).toHaveAttribute("aria-label", "Lane 1, Mochi");
    expect(lanes[1]).toHaveAttribute("aria-label", "Lane 2, empty");
  });

  it("shows placeholders instead of the result while the reveal runs", () => {
    render(<Harness revealing />);
    const arena = screen.getByRole("region", { name: "Arena preview" });
    expect(arena).toHaveAttribute("aria-busy", "true");
    expect(within(arena).queryByText("Rex")).toBeNull();
    expect(
      within(arena)
        .getAllByRole("listitem")
        .every((li) => li.dataset.laneState === "spinning"),
    ).toBe(true);
  });

  it("makes initials from the first two words", () => {
    expect(initialsOf("Puffy Dodo Rex")).toBe("PD");
    expect(initialsOf("rex")).toBe("R");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("DrawingArenaPreview: pending", () => {
  it("shows empty lanes and 'Waiting for the draw' without names", () => {
    const planned = [
      {
        id: "planned-1",
        number: 1,
        status: "SCHEDULED" as const,
        lanes: [1, 2].map((n) => ({
          entryId: `planned-1-${n}`,
          petName: "",
          ownerName: "",
          bibNumber: "",
          laneNumber: n,
        })),
      },
    ];
    render(
      <DrawingArenaPreview
        matches={planned}
        selectedNumber={1}
        onSelect={() => undefined}
        laneCount={3}
        revealing={false}
        pending
      />,
    );
    const arena = screen.getByRole("region", { name: "Arena preview" });
    expect(within(arena).getByText("Waiting for the draw")).toBeInTheDocument();
    const lanes = within(arena).getAllByRole("listitem");
    expect(lanes).toHaveLength(3);
    expect(lanes[0]).toHaveAttribute(
      "aria-label",
      "Lane 1, waiting for the draw",
    );
    expect(lanes.every((li) => li.dataset.laneState === "pending")).toBe(true);
    expect(within(arena).queryByText("Empty lane")).toBeNull();
  });
});
