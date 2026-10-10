"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Select } from "@/components/ui/form-controls";
import { PERIOD_LABEL } from "@/domains/competitions/schema";
import type { Competition } from "@/domains/competitions/types";
import { useCreateEntry, useOwnerSearch } from "@/domains/entries/queries";
import type { Owner } from "@/domains/entries/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDateTime } from "@/lib/format/date";
import { rupiah } from "@/lib/format/label";
import { cn } from "@/lib/utils";

/** What the entry will cost, as the API reports it (`active_registration_period`). */
function priceNote(competition: Competition): string {
  const period = competition.activeRegistrationPeriod;
  if (!period) return "No registration fee for this competition.";
  return `${PERIOD_LABEL[period.type]} price: ${rupiah(period.price)} · until ${formatDateTime(period.endsAt)}`;
}

/** On-the-spot registration by the committee: owner, then pet, then competition. */
export function RegisterPetDrawer({
  eventId,
  competitions,
  open,
  onOpenChange,
}: {
  eventId: string;
  competitions: Competition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<Owner | null>(null);
  const [petId, setPetId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const owners = useOwnerSearch(eventId, useDebouncedValue(query));
  const create = useCreateEntry(eventId);
  const openCompetitions = competitions.filter((c) => c.registrationOpen);
  const competition = openCompetitions.find((c) => c.id === competitionId);

  function reset() {
    setQuery("");
    setOwner(null);
    setPetId("");
    setCompetitionId("");
    create.reset();
  }

  function submit() {
    if (!petId || !competition) return;
    create.mutate(
      { competitionId: competition.id, petId },
      {
        onSuccess: () => {
          toast.success("Pet registered");
          reset();
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Register pet"
      description="On-the-spot registration at the event desk."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!petId || !competition || create.isPending}
          >
            {create.isPending ? "Registering…" : "Register"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <section className="grid gap-2">
          <label htmlFor="owner-search" className="font-semibold">
            1. Owner
          </label>
          {owner ? (
            <div className="border-primary bg-primary-soft flex items-center justify-between gap-3 rounded-xl border p-3">
              <span className="min-w-0">
                <b>{owner.name}</b>
                <span className="text-muted-foreground block text-sm break-words">
                  {[owner.email, owner.phone].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOwner(null);
                  setPetId("");
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="owner-search"
                type="search"
                placeholder="Name, username, email or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {query.trim().length < 2 ? (
                <p className="text-muted-foreground text-sm">
                  Type at least 2 characters.
                </p>
              ) : (
                <ul
                  className="border-border grid rounded-xl border"
                  aria-label="Owners found"
                >
                  {owners.isFetching && !owners.data && (
                    <li className="text-muted-foreground p-3">Searching…</li>
                  )}
                  {owners.isError && (
                    <li className="text-danger p-3">
                      {owners.error instanceof Error
                        ? owners.error.message
                        : "Search failed."}
                    </li>
                  )}
                  {owners.data?.length === 0 && (
                    <li className="text-muted-foreground p-3">
                      No owner found.
                    </li>
                  )}
                  {owners.data?.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setOwner(o)}
                        className="hover:bg-muted w-full p-3 text-left"
                      >
                        <b>{o.name}</b>
                        <span className="text-muted-foreground block text-sm break-words">
                          {o.email} · {o.pets.length}{" "}
                          {o.pets.length === 1 ? "pet" : "pets"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {owner && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-semibold">2. Pet</legend>
            {owner.pets.length === 0 && (
              <p className="text-muted-foreground">
                This owner has no pets yet.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {owner.pets.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl border px-4 py-2",
                    petId === p.id
                      ? "border-primary bg-primary-soft border-2"
                      : "border-input",
                  )}
                >
                  <input
                    type="radio"
                    name="pet"
                    className="sr-only"
                    checked={petId === p.id}
                    onChange={() => setPetId(p.id)}
                  />
                  <b>{p.name}</b>
                  <span className="text-muted-foreground block text-xs">
                    {[p.speciesName, p.morphName].filter(Boolean).join(" · ")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {petId && (
          <section className="grid gap-2">
            <label htmlFor="competition" className="font-semibold">
              3. Competition
            </label>
            {openCompetitions.length === 0 ? (
              <p className="bg-warning-soft rounded-xl p-3 text-sm">
                No competition of this event is open for registration.
              </p>
            ) : (
              <Select
                id="competition"
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
              >
                <option value="">Choose a competition</option>
                {openCompetitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            {competition && (
              <p className="bg-primary-soft text-primary-dark rounded-xl p-3 text-sm">
                {priceNote(competition)}
              </p>
            )}
          </section>
        )}

        {create.isError && (
          <p role="alert" className="text-danger font-semibold">
            {create.error instanceof Error
              ? create.error.message
              : "Registration failed."}
          </p>
        )}
      </div>
    </Drawer>
  );
}
