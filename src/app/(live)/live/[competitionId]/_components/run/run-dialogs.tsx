"use client";
import { useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { DISQUALIFY_REASONS } from "@/domains/matches/constants";
import { formatTimer } from "@/domains/matches/time";
import type { LaneOutcome, MatchLane } from "@/domains/matches/types";
import { RESULT_STATUS_LABEL } from "@/domains/results/types";

/**
 * Kerangka dialog Run Match (Radix Dialog + Tailwind). Dibuat sendiri karena `ConfirmDialog`
 * portal memakai kelas dari portal.css yang tidak dimuat di Live Mode.
 * Dipanggil dari semua dialog di bawah. Isi `children` dibongkar saat dialog ditutup, jadi state
 * form di dalamnya otomatis kembali kosong.
 */
export function RunDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#17203366]" />
        <Dialog.Content className="bg-card fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(520px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl p-6 shadow-lg">
          <Dialog.Title className="font-display text-lg font-bold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2 text-sm">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Dua tombol di dasar dialog: aksi kedua (Back/Cancel) lalu aksi utama. */
function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      {children}
    </div>
  );
}

/**
 * Dialog konfirmasi sederhana (Rematch, Stop match). `onConfirm` dipanggil lalu dialog ditutup
 * oleh pemanggil. Tombol utama memakai gaya destructive bila `danger`.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <RunDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <DialogActions>
        <Button
          variant="secondary"
          className="min-h-12"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant={danger ? "destructive" : "primary"}
          className="min-h-12"
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </RunDialog>
  );
}

/** Isi form Disqualify: pilihan alasan cepat + kolom alasan wajib. State-nya hidup selama dialog terbuka. */
function DisqualifyForm({
  lane,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  lane: MatchLane;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onConfirm(trimmed);
      }}
    >
      <div
        role="group"
        aria-label="Common reasons"
        className="flex flex-wrap gap-2"
      >
        {DISQUALIFY_REASONS.map((option) => (
          <Button
            key={option}
            variant="secondary"
            size="sm"
            className="min-h-11"
            aria-pressed={reason === option}
            onClick={() => setReason(option)}
          >
            {option}
          </Button>
        ))}
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        Reason (required)
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          required
          className="border-input bg-card min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>
      {error && (
        <p role="alert" className="text-danger-ink text-sm font-semibold">
          {error}
        </p>
      )}
      <DialogActions>
        <Button variant="secondary" className="min-h-12" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          className="min-h-12"
          disabled={!trimmed || busy}
        >
          {busy ? "Disqualifying..." : `Disqualify ${lane.petName}`}
        </Button>
      </DialogActions>
    </form>
  );
}

/**
 * Dialog Disqualify satu lane: konfirmasi + alasan wajib (keputusan pengguna).
 * Dipanggil dari layar Run Match; `onConfirm(reason)` memanggil `useDisqualify`.
 */
export function DisqualifyDialog({
  lane,
  onOpenChange,
  busy,
  error,
  onConfirm,
}: {
  /** Lane yang akan didiskualifikasi; null = dialog tertutup. */
  lane: MatchLane | null;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string | null;
  onConfirm: (lane: MatchLane, reason: string) => void;
}) {
  return (
    <RunDialog
      open={lane !== null}
      onOpenChange={onOpenChange}
      title={lane ? `Disqualify ${lane.petName}?` : "Disqualify"}
      description="The pet is removed from the ranking of this match. You can revoke it until the result is confirmed."
    >
      {lane && (
        <DisqualifyForm
          lane={lane}
          busy={busy}
          error={error}
          onCancel={() => onOpenChange(false)}
          onConfirm={(reason) => onConfirm(lane, reason)}
        />
      )}
    </RunDialog>
  );
}

/**
 * Dialog ringkasan sebelum Confirm: tabel peringkat (rank, pet, owner, waktu/status) dari
 * `matchOutcomes`. Tombol "Confirm result" memanggil `useConfirmMatch`; "Back" menutup dialog.
 */
export function ConfirmSummaryDialog({
  open,
  onOpenChange,
  lanes,
  outcomes,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lanes: readonly MatchLane[];
  outcomes: readonly LaneOutcome[];
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <RunDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm result"
      description="Check the ranking. After you confirm, the result is saved and this match is closed."
    >
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Match ranking</caption>
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th scope="col" className="py-1 pr-2">
              Rank
            </th>
            <th scope="col" className="py-1 pr-2">
              Pet
            </th>
            <th scope="col" className="py-1 pr-2">
              Owner
            </th>
            <th scope="col" className="py-1 text-right">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((outcome) => {
            const lane = lanes.find(
              (l) => l.heatEntryId === outcome.heatEntryId,
            );
            return (
              <tr key={outcome.heatEntryId} className="border-border border-t">
                <td className="py-2 pr-2 font-mono font-bold">
                  {outcome.position}
                </td>
                <td className="py-2 pr-2 font-semibold wrap-break-word">
                  {lane?.petName}
                  {lane?.bibNumber && (
                    <span className="text-muted-foreground ml-1.5 font-mono text-xs font-normal">
                      {lane.bibNumber}
                    </span>
                  )}
                </td>
                <td className="text-muted-foreground py-2 pr-2 wrap-break-word">
                  {lane?.ownerName}
                </td>
                <td className="py-2 text-right font-mono">
                  {outcome.status === "FINISHED" &&
                  outcome.completedTimeMs !== null
                    ? formatTimer(outcome.completedTimeMs)
                    : RESULT_STATUS_LABEL[outcome.status]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && (
        <p role="alert" className="text-danger-ink mt-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <DialogActions>
        <Button
          variant="secondary"
          className="min-h-12"
          onClick={() => onOpenChange(false)}
        >
          Back
        </Button>
        <Button className="min-h-12" disabled={busy} onClick={onConfirm}>
          {busy ? "Confirming..." : "Confirm result"}
        </Button>
      </DialogActions>
    </RunDialog>
  );
}
