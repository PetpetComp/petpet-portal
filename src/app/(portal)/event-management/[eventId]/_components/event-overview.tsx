"use client";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { useEventCompetitions } from "@/domains/competitions/queries";
import { useEvent, useEventCounts } from "@/domains/events/queries";
import { isPublished } from "@/domains/events/types";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";

export function EventOverview({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const competitions = useEventCompetitions(eventId);
  const counts = useEventCounts(eventId);
  const base = ROUTES.eventManagement.detail(eventId);

  const list = competitions.data ?? [];
  const open = list.filter((c) => !c.registrationClosed).length;

  const steps = [
    { label: "Event details", done: !!event.data },
    { label: "Competitions added", done: list.length > 0 },
    { label: "Committee invited", done: (counts.data?.staff ?? 0) > 0 },
    { label: "Sponsors linked", done: (counts.data?.sponsors ?? 0) > 0 },
    { label: "Event published", done: !!event.data && isPublished(event.data) },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Stat
          href={base + "/competitions"}
          label="Competitions"
          value={competitions.isSuccess ? list.length : undefined}
          note={competitions.isSuccess ? `${open} open for registration` : ""}
        />
        <Stat
          label="Committee"
          value={counts.data?.staff}
          note="people assigned to this event"
        />
        <Stat
          label="Sponsors"
          value={counts.data?.sponsors}
          note="brands linked to this event"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <section className="border-border rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-bold">Competitions</h2>
          {competitions.isPending && (
            <p className="text-muted-foreground">Loading…</p>
          )}
          {competitions.isSuccess && list.length === 0 && (
            <p className="text-muted-foreground">
              No competitions yet.{" "}
              <Link href={base + "/competitions"} className="font-semibold">
                Add the first one
              </Link>
            </p>
          )}
          <ul className="grid gap-1">
            {list.map((c) => (
              <li
                key={c.id}
                className="border-border flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground text-sm">
                  {formatDateTime(c.startAt)}
                  {c.capacity ? ` · ${c.capacity} slots` : ""}
                  {" · "}
                  {c.registrationClosed ? "Registration closed" : "Open"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-bold">Setup</h2>
          <ul className="grid gap-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                {s.done ? (
                  <span className="grid size-6 place-items-center rounded-full bg-[#dcfce7] text-[#166534]">
                    <Check size={14} strokeWidth={3} aria-label="Done" />
                  </span>
                ) : (
                  <Circle
                    size={24}
                    className="text-input"
                    aria-label="Not yet"
                  />
                )}
                <span className={s.done ? "" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: number | undefined;
  note: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-muted-foreground text-sm font-semibold">
        {label}
      </span>
      <b className="font-mono text-3xl font-semibold">
        {value === undefined ? "…" : value}
      </b>
      <span className="text-muted-foreground text-sm">{note}</span>
    </>
  );
  const cls =
    "border-border grid gap-1 rounded-2xl border bg-white p-5 " +
    (href ? "hover:border-primary transition-colors" : "");
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
