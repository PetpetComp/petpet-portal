import { formatCutoff } from "./settings";
import {
  REGISTRATION_CLOSED_REASON_LABEL,
  type Competition,
  type CompetitionRule,
} from "./types";

/**
 * Logika murni header dan tab Overview kompetisi (tanpa React): baris meta, langkah
 * Progress, dan hitungan panitia. Dipanggil dari `competition-shell.tsx` dan
 * `competition-overview.tsx`, dites di `overview.test.ts`.
 */

/** "1 participant" / "45 participants". */
const plural = (n: number, one: string, many = one + "s") =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Baris meta di bawah nama: hewan, jumlah peserta, lane, cut-off (desain CompHeader).
 * Bagian yang datanya belum ada dilewati: tanpa rule tidak ada lane dan cut-off,
 * peserta `null` (gagal dimuat atau tidak boleh dilihat) dan hewan `null` (daftar hewan
 * belum dimuat) juga dilewati. Kompetisi tanpa hewan tertentu memakai label "Any animal".
 */
export function competitionMeta(input: {
  speciesLabel: string | null;
  participants: number | null;
  rule: CompetitionRule | null;
}): string[] {
  const { speciesLabel, participants, rule } = input;
  const parts: string[] = speciesLabel ? [speciesLabel] : [];
  if (participants !== null) parts.push(plural(participants, "participant"));
  if (rule?.laneTotal) parts.push(plural(rule.laneTotal, "lane"));
  if (rule?.timeLimitMs)
    parts.push(`Cut-off ${formatCutoff(rule.timeLimitMs)}`);
  return parts;
}

/** Jumlah anggota panitia kompetisi ini (penugasan yang menunjuk id-nya). Tim event tidak dihitung. */
export function committeeCount(
  members: { competitionId: string | null }[],
  competitionId: string,
): number {
  return members.filter((m) => m.competitionId === competitionId).length;
}

/** Satu langkah di kartu Progress. `percent` mengisi bar; `state` menentukan warnanya. */
export type ProgressStep = {
  label: string;
  note: string;
  state: "done" | "active" | "idle";
  percent: number;
};

/** Angka check-in dari `summary` entries; null bila akun ini tidak boleh melihatnya. */
export type CheckinCounts = { total: number; checkedIn: number } | null;

/**
 * Lima langkah Progress: Registration, Check-in, Drawing, Matches, Results.
 * Drawing, Matches, dan Results belum punya data (fase berikutnya), jadi hanya dibaca dari
 * status kompetisi: sedang berjalan atau selesai berarti drawing sudah ada.
 * Aturan buka/tutup registrasi TIDAK dihitung di sini; dibaca dari `registrationOpen`
 * dan alasan penutupan yang dikirim backend.
 */
export function progressSteps(
  competition: Pick<
    Competition,
    | "status"
    | "registrationClosed"
    | "registrationOpen"
    | "registrationClosedReason"
  >,
  checkin: CheckinCounts,
): ProgressStep[] {
  const started =
    competition.status === "ONGOING" || competition.status === "COMPLETED";

  const registration: ProgressStep =
    competition.registrationClosed || started
      ? { label: "Registration", note: "Closed", state: "done", percent: 100 }
      : competition.registrationOpen
        ? { label: "Registration", note: "Open", state: "active", percent: 50 }
        : {
            label: "Registration",
            note: competition.registrationClosedReason
              ? REGISTRATION_CLOSED_REASON_LABEL[
                  competition.registrationClosedReason
                ]
              : "Closed",
            state: "idle",
            percent: 0,
          };

  const total = checkin?.total ?? 0;
  const checked = checkin?.checkedIn ?? 0;
  const checkinStep: ProgressStep = !checkin
    ? { label: "Check-in", note: "Not available", state: "idle", percent: 0 }
    : {
        label: "Check-in",
        note: `${checked} of ${total}`,
        state:
          total > 0 && checked === total
            ? "done"
            : checked > 0
              ? "active"
              : "idle",
        percent: total > 0 ? Math.round((checked / total) * 100) : 0,
      };

  return [
    registration,
    checkinStep,
    started
      ? { label: "Drawing", note: "Drawn", state: "done", percent: 100 }
      : { label: "Drawing", note: "Not drawn yet", state: "idle", percent: 0 },
    competition.status === "COMPLETED"
      ? { label: "Matches", note: "Finished", state: "done", percent: 100 }
      : competition.status === "ONGOING"
        ? {
            label: "Matches",
            note: "In progress",
            state: "active",
            percent: 50,
          }
        : { label: "Matches", note: "Not started", state: "idle", percent: 0 },
    competition.status === "COMPLETED"
      ? { label: "Results", note: "Final", state: "done", percent: 100 }
      : {
          label: "Results",
          note: "After final round",
          state: "idle",
          percent: 0,
        },
  ];
}
