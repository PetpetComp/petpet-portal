"use client";
import { useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ScanLine, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { useEventCompetitions } from "@/domains/competitions/queries";
import { COMPETITION_STATUS_LABEL } from "@/domains/competitions/types";
import {
  eventEntriesOptions,
  useCheckIn,
  useEventEntries,
  useUndoCheckIn,
} from "@/domains/entries/queries";
import type { Entry, EntryListQuery } from "@/domains/entries/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  checkedInText,
  defaultCompetitionId,
  scanTarget,
} from "../_lib/participants";

const PER_PAGE_OPTIONS = [12, 24, 48];

type Notice = { tone: "success" | "error"; text: string } | null;

const petLabel = (e: Entry) => e.petName ?? "Team entry";

const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

/**
 * F2.2 check-in desk: approved participants of one competition as cards.
 * A QR scanner types the participant code and presses Enter.
 */
export function EventParticipants({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const competitions = useEventCompetitions(eventId);
  const [chosen, setChosen] = useState("");
  const [search, setSearch] = useState("");
  /** Set on Enter so the list filters at once instead of after the debounce. */
  const [entered, setEntered] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const [notice, setNotice] = useState<Notice>(null);
  const [toUndo, setToUndo] = useState<Entry | null>(null);
  const debounced = useDebouncedValue(search);
  const checkIn = useCheckIn(eventId);
  const undo = useUndoCheckIn(eventId);

  const competitionId = chosen || defaultCompetitionId(competitions.data ?? []);
  /** Contract 10 §4: approved, still registered, by pet name. */
  const queryFor = (q: string, atPage: number): EntryListQuery => ({
    competitionId,
    eligibility: "APPROVED",
    status: "REGISTERED",
    q,
    sort: "pet_name",
    direction: "asc",
    page: atPage,
    perPage,
  });
  const entries = useEventEntries(
    eventId,
    queryFor(entered ?? debounced, page),
    !!competitionId,
  );

  function runCheckIn(entry: Entry, after?: () => void) {
    checkIn.mutate(entry.id, {
      onSuccess: () => {
        setNotice({ tone: "success", text: `${petLabel(entry)} checked in` });
        after?.();
      },
      onError: (cause) =>
        setNotice({
          tone: "error",
          text: errorText(cause, "Check-in failed."),
        }),
    });
  }

  async function scan(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = search.trim();
    setEntered(code);
    setPage(1);
    setNotice(null);
    if (!code || !competitionId) return;
    try {
      const result = await client.fetchQuery(
        eventEntriesOptions(eventId, queryFor(code, 1)),
      );
      const target = scanTarget(result.items, code);
      if (target)
        runCheckIn(target, () => {
          setSearch("");
          setEntered(null);
        });
    } catch (cause) {
      setNotice({ tone: "error", text: errorText(cause, "Search failed.") });
    }
  }

  function confirmUndo(entry: Entry) {
    undo.mutate(entry.id, {
      onSuccess: () =>
        setNotice({
          tone: "success",
          text: `Check-in of ${petLabel(entry)} undone`,
        }),
      onError: (cause) =>
        setNotice({ tone: "error", text: errorText(cause, "Undo failed.") }),
    });
  }

  if (competitions.isError)
    return (
      <p role="alert" className="form-error">
        {errorText(competitions.error, "Unable to load competitions.")}
      </p>
    );
  if (competitions.isSuccess && competitions.data.length === 0)
    return (
      <EmptyState
        icon={UserRoundSearch}
        message="This event has no competitions yet."
      />
    );

  const data = entries.data;
  const busy = checkIn.isPending || undo.isPending;

  return (
    <section className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="border-primary flex min-h-14 min-w-0 flex-[999_1_320px] items-center gap-2.5 rounded-2xl border-2 bg-white px-4">
          <ScanLine size={20} aria-hidden className="text-primary shrink-0" />
          <input
            type="search"
            aria-label="Scan QR or search participant"
            placeholder="Scan QR or type pet / owner name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setEntered(null);
              setPage(1);
            }}
            onKeyDown={scan}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
          />
        </label>
        <Select
          aria-label="Competition"
          value={competitionId}
          onChange={(e) => {
            setChosen(e.target.value);
            setPage(1);
            setNotice(null);
          }}
          className="min-h-14 min-w-0 flex-[1_1_220px] rounded-2xl font-semibold"
        >
          {(competitions.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {COMPETITION_STATUS_LABEL[c.status]}
            </option>
          ))}
        </Select>
        <span className="px-2 font-bold" aria-live="polite">
          {data ? checkedInText(data.summary) : ""}
        </span>
      </div>

      <p
        role="status"
        className={cn(
          "rounded-xl px-4 py-3 font-semibold empty:hidden",
          notice?.tone === "success" && "bg-success-soft text-foreground",
          notice?.tone === "error" && "bg-danger-soft text-foreground",
        )}
      >
        {notice?.text}
      </p>

      {entries.isError ? (
        <p role="alert" className="form-error">
          {errorText(entries.error, "Unable to load participants.")}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground">Loading participants…</p>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UserRoundSearch}
          message={
            entered || debounced
              ? "No approved participant matches this search."
              : "No approved participants in this competition yet."
          }
        />
      ) : (
        <ul
          aria-label="Participants"
          aria-busy={entries.isFetching || undefined}
          className="grid grid-cols-[repeat(auto-fill,minmax(min(420px,100%),1fr))] gap-3"
        >
          {data.items.map((e) => (
            <ParticipantCard
              key={e.id}
              entry={e}
              busy={busy}
              onCheckIn={() => runCheckIn(e)}
              onUndo={() => setToUndo(e)}
            />
          ))}
        </ul>
      )}

      {data && data.meta.total > 0 && (
        <div className="bg-card border-border rounded-2xl border">
          <Pagination
            page={page}
            perPage={perPage}
            total={data.meta.total}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            perPageOptions={PER_PAGE_OPTIONS}
            label="participants"
          />
        </div>
      )}

      <ConfirmDialog
        open={!!toUndo}
        onOpenChange={(open) => !open && setToUndo(null)}
        title="Undo check-in"
        description={`Mark ${toUndo ? petLabel(toUndo) : ""} (${toUndo?.ownerName}) as not checked in?`}
        confirmLabel="Undo check-in"
        onConfirm={() => toUndo && confirmUndo(toUndo)}
      />
    </section>
  );
}

function ParticipantCard({
  entry,
  busy,
  onCheckIn,
  onUndo,
}: {
  entry: Entry;
  busy: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
}) {
  const pet = petLabel(entry);
  const checkedIn = entry.checkin === "CHECKED_IN";
  const doneClass =
    "bg-success-soft text-foreground inline-flex min-h-11 min-w-28 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold";
  return (
    <li
      className={cn(
        "bg-card flex items-center gap-3.5 rounded-2xl border px-4 py-3.5",
        checkedIn ? "border-success/40" : "border-border",
      )}
    >
      <span
        aria-hidden
        className="bg-muted text-primary-dark grid size-11 shrink-0 place-items-center rounded-xl font-extrabold"
      >
        {pet.charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate">{pet}</b>
        <span className="text-muted-foreground truncate text-[13px]">
          {entry.ownerName}
          {entry.petMorphName && ` · ${entry.petMorphName}`}
        </span>
      </span>
      {checkedIn ? (
        entry.actions.undoCheckIn ? (
          <button
            type="button"
            className={cn(doneClass, "hover:brightness-95")}
            aria-label={`Checked in: ${pet}. Undo`}
            disabled={busy}
            onClick={onUndo}
          >
            <Check size={16} aria-hidden className="text-success" />
            Checked in
          </button>
        ) : (
          <span className={doneClass}>
            <Check size={16} aria-hidden className="text-success" />
            Checked in
          </span>
        )
      ) : entry.actions.checkIn ? (
        <Button
          className="min-h-11 min-w-28 rounded-xl font-bold"
          aria-label={`Check in ${pet}`}
          disabled={busy}
          onClick={onCheckIn}
        >
          Check in
        </Button>
      ) : (
        <span className="text-muted-foreground min-w-28 text-center text-sm font-semibold">
          Not checked in
        </span>
      )}
    </li>
  );
}
