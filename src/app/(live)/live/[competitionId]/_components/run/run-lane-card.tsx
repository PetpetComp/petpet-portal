"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimer } from "@/domains/matches/time";
import type { MatchLane } from "@/domains/matches/types";
import { cn } from "@/lib/utils";
import type { PendingFinish } from "./finish-queue";
import {
  LANE_CHIP_LABEL,
  ordinal,
  type LaneChip,
  type LaneView,
} from "./lane-view";

/** Apa yang boleh dilakukan di satu lane saat ini (flag server DIGABUNG dengan fase layar). */
export type LaneAllowance = {
  /** Finish aktif: sesi RUNNING, timer berjalan, lane belum punya hasil. */
  finish: boolean;
  /** Finish terlihat (tombol mati) walau belum boleh ditekan. */
  showFinish: boolean;
  undoFinish: boolean;
  markDns: boolean;
  undoDns: boolean;
  disqualify: boolean;
  undoDisqualify: boolean;
};

const CHIP_STYLE: Record<LaneChip, string> = {
  FINISHED: "bg-success-soft text-done",
  DNS: "bg-muted text-muted-foreground",
  DQ: "bg-danger-soft text-danger-ink",
  DNF: "bg-warning-soft text-event-day-ink",
  PENDING: "bg-info-soft text-upcoming",
  NOT_ASSIGNED: "bg-warning-soft text-event-day-ink",
};

type MenuItem = { label: string; onSelect: () => void };

/**
 * Menu kebab lane: tombol dengan daftar aksi (Did not start, Disqualify, dst). Dibuat sendiri
 * dari tombol biasa supaya sederhana dan mudah diuji. Menutup saat memilih, menekan Escape,
 * atau mengklik di luar. Tidak dirender bila tidak ada aksi.
 */
function LaneMenu({
  label,
  items,
}: {
  label: string;
  items: readonly MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={root} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} aria-hidden />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="border-border bg-card absolute top-full right-0 z-20 mt-1 grid min-w-48 rounded-xl border p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="hover:bg-muted min-h-11 rounded-lg px-3 text-left text-sm font-semibold"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Kartu satu lane Run Match (desain A-Live): nomor lane oranye besar, nama hewan + bib, pemilik
 * dan morph, waktu (font mono) atau "-", chip status, tombol Finish besar (min 56px, penuh lebar
 * di HP) atau Undo setelah finish, dan menu kebab. Dipanggil dari layar Run Match.
 * Komponen ini hanya menampilkan dan meneruskan klik; semua keputusan boleh/tidak datang dari
 * `allow` dan tampilan dari `view` (dihitung layar).
 */
export function RunLaneCard({
  lane,
  view,
  pending,
  allow,
  busy,
  handlers,
}: {
  lane: MatchLane;
  view: LaneView;
  /** Item antrean lane ini (ketukan belum tersimpan), bila ada. */
  pending: PendingFinish | null;
  allow: LaneAllowance;
  /** Ada aksi lane yang sedang dikirim. */
  busy: boolean;
  handlers: {
    onFinish: () => void;
    onUndo: () => void;
    onRetry: () => void;
    onDiscard: () => void;
    onMarkDns: () => void;
    onUndoDns: () => void;
    onDisqualify: () => void;
    onUndoDisqualify: () => void;
  };
}) {
  const menu: MenuItem[] = [];
  if (allow.markDns)
    menu.push({ label: "Did not start", onSelect: handlers.onMarkDns });
  if (allow.undoDns)
    menu.push({ label: "Undo did not start", onSelect: handlers.onUndoDns });
  if (allow.disqualify)
    menu.push({ label: "Disqualify", onSelect: handlers.onDisqualify });
  if (allow.undoDisqualify)
    menu.push({
      label: "Revoke disqualification",
      onSelect: handlers.onUndoDisqualify,
    });

  const retryLabel =
    pending?.status === "unassigned" ? "Not assigned - Retry" : "Retry";
  const owner = lane.petMorphName
    ? `${lane.ownerName} - ${lane.petMorphName}`
    : lane.ownerName;

  return (
    <section
      aria-label={`Lane ${lane.laneNumber}`}
      data-lane-chip={view.chip ?? "NONE"}
      className="border-border bg-card grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-3 rounded-2xl border p-3.5 md:grid-cols-[auto_minmax(0,1fr)_auto_minmax(150px,200px)_auto] md:gap-x-4"
    >
      <span className="font-display text-event-day w-8 text-center text-4xl leading-none font-bold">
        {lane.laneNumber}
      </span>
      <div className="grid min-w-0 gap-0.5">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <b className="font-display text-lg leading-6 wrap-break-word">
            {lane.petName}
          </b>
          {lane.bibNumber && (
            <span className="text-muted-foreground font-mono text-xs">
              {lane.bibNumber}
            </span>
          )}
        </p>
        <p className="text-muted-foreground text-xs wrap-break-word">{owner}</p>
        {(view.chip || view.rank !== null) && (
          <p className="mt-1 flex flex-wrap items-center gap-2">
            {view.chip && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold",
                  CHIP_STYLE[view.chip],
                )}
              >
                {LANE_CHIP_LABEL[view.chip]}
              </span>
            )}
            {view.rank !== null && view.chip === "FINISHED" && (
              <span className="text-muted-foreground text-xs font-semibold">
                {ordinal(view.rank)}
                {view.final ? "" : " so far"}
              </span>
            )}
          </p>
        )}
        {pending?.error && pending.status !== "sending" && (
          <p role="status" className="text-danger-ink text-xs font-semibold">
            {pending.error}
          </p>
        )}
      </div>
      <span
        aria-label={view.timeMs === null ? "No time" : "Time"}
        className="text-foreground font-mono text-lg font-bold tabular-nums"
      >
        {view.timeMs === null ? "-" : formatTimer(view.timeMs)}
      </span>
      <div className="order-last col-span-4 grid gap-2 md:order-none md:col-span-1">
        {pending && pending.status !== "sending" ? (
          <>
            <Button
              className="min-h-14 w-full text-base"
              onClick={handlers.onRetry}
            >
              {retryLabel}
            </Button>
            {pending.status === "rejected" && (
              <Button
                variant="secondary"
                className="min-h-11 w-full"
                onClick={handlers.onDiscard}
              >
                Discard
              </Button>
            )}
          </>
        ) : allow.undoFinish || pending ? (
          <Button
            variant="secondary"
            className="min-h-14 w-full text-base"
            disabled={busy || !allow.undoFinish}
            onClick={handlers.onUndo}
          >
            Undo
          </Button>
        ) : allow.showFinish ? (
          <Button
            className="min-h-14 w-full text-base"
            disabled={!allow.finish}
            onClick={handlers.onFinish}
          >
            Finish
          </Button>
        ) : null}
      </div>
      <LaneMenu label={`Lane ${lane.laneNumber} options`} items={menu} />
    </section>
  );
}
