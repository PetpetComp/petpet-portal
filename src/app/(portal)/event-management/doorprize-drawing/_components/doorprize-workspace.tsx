"use client";
import { useState } from "react";
import { Gift, Shuffle, Trophy, Plus } from "lucide-react";
import { toast } from "sonner";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
export function DoorprizeWorkspace() {
  const { data, save } = usePortalData();
  const [eventId, setEventId] = useState(data.events[0]?.id ?? "");
  const [prizeId, setPrizeId] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [adding, setAdding] = useState(false);
  const [winner, setWinner] = useState("");
  const prizes = data.prizes.filter((prize) => prize.eventId === eventId);
  const selected = prizes.find((prize) => prize.id === prizeId) ?? prizes[0];
  const previous = prizes.flatMap(
    (prize) => prize.winnerUserIds?.split(",").filter(Boolean) ?? [],
  );
  const eligible = Array.from(
    new Set(
      data.registrations
        .filter(
          (row) => row.eventId === eventId && row.paymentStatus === "Verified",
        )
        .map((row) => row.userId),
    ),
  ).filter((id) => !previous.includes(id));
  const selectedWinners =
    selected?.winnerUserIds?.split(",").filter(Boolean) ?? [];
  const canDraw =
    !!selected &&
    eligible.length > 0 &&
    selectedWinners.length < Number(selected.quantity);
  function draw() {
    if (!canDraw || !selected) return;
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const id = eligible[Math.floor(random * eligible.length)];
    save("prizes", {
      ...selected,
      winnerUserIds: [...selectedWinners, id].join(","),
    });
    setWinner(data.users.find((user) => user.id === id)?.name ?? id);
    toast.success("Winner drawn");
  }
  return (
    <div className="page-stack">
      <PageHeading
        title="Doorprize Drawing"
        actions={
          <Button variant="secondary" onClick={() => setAdding(!adding)}>
            <Plus size={15} />
            Add Prize
          </Button>
        }
      />
      <div className="toolbar">
        <Field label="Event">
          <Select
            value={eventId}
            onChange={(event) => {
              setEventId(event.target.value);
              setPrizeId("");
              setWinner("");
            }}
          >
            {data.events.map((event) => (
              <option value={event.id} key={event.id}>
                {event.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prize">
          <Select
            value={selected?.id ?? ""}
            onChange={(event) => {
              setPrizeId(event.target.value);
              setWinner("");
            }}
          >
            <option value="" disabled>
              Select a prize
            </option>
            {prizes.map((prize) => (
              <option key={prize.id} value={prize.id}>
                {prize.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {adding && (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const id = crypto.randomUUID();
            save("prizes", { id, name, eventId, quantity, winnerUserIds: "" });
            setPrizeId(id);
            setAdding(false);
            setName("");
          }}
        >
          <Field label="Prize Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field label="Quantity">
            <Input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Button type="submit">Save Prize</Button>
        </form>
      )}
      <section className="prize-stage">
        <Gift size={36} />
        <span className="eyebrow">DOORPRIZE</span>
        <h2>{selected?.name ?? "No prizes available"}</h2>
        <div className="prize-winner" aria-live="polite">
          {winner || "Ready to draw"}
        </div>
        <p>
          {eligible.length} eligible participants / {selectedWinners.length} of{" "}
          {selected?.quantity ?? 0} prizes awarded
        </p>
        <Button disabled={!canDraw} onClick={draw}>
          <Shuffle size={17} />
          Draw Winner
        </Button>
      </section>
      <section>
        <div className="section-head">
          <h2>
            <Trophy size={17} /> Winners
          </h2>
        </div>
        <DataTable
          rows={prizes.flatMap((prize) =>
            (prize.winnerUserIds?.split(",").filter(Boolean) ?? []).map(
              (userId) => ({
                id: prize.id + userId,
                name:
                  data.users.find((user) => user.id === userId)?.name ?? userId,
                prize: prize.name,
              }),
            ),
          )}
          columns={[
            { key: "name", label: "Winner", value: (row) => row.name },
            { key: "prize", label: "Prize", value: (row) => row.prize },
          ]}
        />
      </section>
    </div>
  );
}
