"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Select } from "@/components/ui/form-controls";
import type { Competition } from "@/domains/competitions/types";
import {
  useCreateEntry,
  useOwnerPets,
  useOwnerSearch,
  usePeriods,
} from "@/domains/entries/queries";
import { openPeriod } from "@/domains/entries/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { humanize, rupiah } from "@/lib/format/label";
import { cn } from "@/lib/utils";

type Owner = { id: string; name: string; email: string };

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
  const owners = useOwnerSearch(useDebouncedValue(query));
  const pets = useOwnerPets(owner?.id ?? "");
  const periods = usePeriods(competitionId);
  const period = periods.data ? openPeriod(periods.data, new Date()) : null;
  const create = useCreateEntry(eventId);
  const openCompetitions = competitions.filter((c) => !c.registrationClosed);

  function reset() {
    setQuery("");
    setOwner(null);
    setPetId("");
    setCompetitionId("");
    create.reset();
  }

  function submit() {
    if (!petId || !competitionId || !period) return;
    create.mutate(
      { competitionId, petId, periodId: period.id },
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
            disabled={!petId || !competitionId || !period || create.isPending}
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
              <span>
                <b>{owner.name}</b>
                <span className="text-muted-foreground block text-sm">
                  {owner.email}
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
                placeholder="Name, username or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {query.trim().length >= 2 && (
                <ul
                  className="border-border grid rounded-xl border"
                  aria-label="Owners found"
                >
                  {owners.isFetching && !owners.data && (
                    <li className="text-muted-foreground p-3">Searching…</li>
                  )}
                  {owners.isError && (
                    <li className="p-3 text-[#b91c1c]">
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
                        <span className="text-muted-foreground block text-sm">
                          {o.email}
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
            {pets.isPending && (
              <p className="text-muted-foreground">Loading pets…</p>
            )}
            {pets.data?.length === 0 && (
              <p className="text-muted-foreground">
                This owner has no pets yet.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {pets.data?.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl border px-4 py-2.5 font-semibold",
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
                  {p.name}
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
            {competitionId && periods.isSuccess && (
              <p
                className={cn(
                  "rounded-xl p-3 text-sm",
                  period
                    ? "bg-primary-soft text-primary-dark"
                    : "bg-[#fef3c7] text-[#92400e]",
                )}
              >
                {period
                  ? `${humanize(period.type)} price: ${rupiah(period.price)}`
                  : "No registration channel is open for this competition right now."}
              </p>
            )}
          </section>
        )}

        {create.isError && (
          <p role="alert" className="font-semibold text-[#b91c1c]">
            {create.error instanceof Error
              ? create.error.message
              : "Registration failed."}
          </p>
        )}
      </div>
    </Drawer>
  );
}
