import {
  activeAttempt,
  countedAttempts,
  latestCountedAttempt,
  type AttemptFacts,
} from "./attempts";
import type { QueueItemActions, QueueState, RoundEntryStatus } from "./types";

/**
 * Aturan keadaan Time trial: status peserta, urutan antrean (termasuk Skip), siapa yang sedang
 * mendapat giliran, dan apa yang boleh dilakukan (`actions`). Fungsi murni tanpa API, jam, atau
 * React. Dipakai mock (mock-timetrial.ts) untuk menghitung `actions` dan memeriksa tiap route,
 * dan dipakai tes layar. Backend asli sebaiknya memakai aturan yang sama (kontrak 14).
 */

/**
 * Status peserta untuk layar, diturunkan dari `round_entries.status` dan penalti.
 * Diskualifikasi aktif (`disqualified`) mengalahkan segalanya. WAITING dan CALLED = NOT_STARTED,
 * IN_PROGRESS dan JUDGING = IN_PROGRESS, COMPLETED = DONE, DNS = DNS, DSQ = DQ.
 */
export function queueStateOf(
  status: RoundEntryStatus,
  disqualified: boolean,
): QueueState {
  if (disqualified || status === "DSQ") return "DQ";
  switch (status) {
    case "DNS":
      return "DNS";
    case "COMPLETED":
      return "DONE";
    case "IN_PROGRESS":
    case "JUDGING":
      return "IN_PROGRESS";
    default:
      return "NOT_STARTED";
  }
}

/** True bila giliran peserta sudah tertutup: DONE, DNS, atau DQ. */
export function isTerminalState(state: QueueState): boolean {
  return state === "DONE" || state === "DNS" || state === "DQ";
}

/**
 * Urutan antrean yang berlaku. `drawn` = urutan hasil undian (match drawing). `skipped` = peserta
 * yang pernah di-Skip, urut menurut Skip terakhir (yang paling akhir di-Skip ada di ujung).
 * Hasil: semua peserta yang tidak di-Skip menurut urutan undian, lalu yang di-Skip menurut urutan
 * Skip. Contoh: drawn [a,b,c,d], skipped [b] -> [a,c,d,b]; lalu skipped [b,a] -> [c,d,b,a].
 * Id di `skipped` yang tidak ada di `drawn` diabaikan.
 */
export function effectiveOrder(
  drawn: readonly string[],
  skipped: readonly string[],
): string[] {
  const inDraw = new Set(drawn);
  const skippedValid = skipped.filter((id) => inDraw.has(id));
  const skippedSet = new Set(skippedValid);
  return [...drawn.filter((id) => !skippedSet.has(id)), ...skippedValid];
}

/**
 * Daftar Skip baru setelah `entryId` di-Skip: id itu dipindah ke ujung (tidak pernah ganda).
 * Dipanggil dari mock saat `POST /competitions/{uuid}/queue/{entryUuid}/skip`.
 */
export function withSkipped(
  skipped: readonly string[],
  entryId: string,
): string[] {
  return [...skipped.filter((id) => id !== entryId), entryId];
}

/** Masukan `currentEntryOf`: satu peserta menurut urutan antrean. */
export type CurrentCandidate = {
  entryId: string;
  state: QueueState;
  /** True bila punya attempt WAITING atau RUNNING. */
  hasActiveAttempt: boolean;
};

/**
 * Peserta yang sedang mendapat giliran. Yang punya attempt aktif selalu menang (attempt tidak
 * boleh ditinggal), selain itu peserta pertama menurut urutan antrean yang belum DONE, DNS, atau
 * DQ. Null bila semua selesai atau antrean kosong. `ordered` harus sudah urut antrean.
 */
export function currentEntryOf(
  ordered: readonly CurrentCandidate[],
): string | null {
  const active = ordered.find((p) => p.hasActiveAttempt);
  if (active) return active.entryId;
  const next = ordered.find((p) => !isTerminalState(p.state));
  return next?.entryId ?? null;
}

/** Keadaan yang dibutuhkan aturan `actions` satu peserta. Dihitung sekali per peserta. */
export type ParticipantRuleInput = {
  state: QueueState;
  /** Penalti DISQUALIFICATION yang ACTIVE. */
  disqualified: boolean;
  attempts: readonly AttemptFacts[];
  /** Rule `attempt_limit`. */
  attemptLimit: number;
  /** Peserta ini yang sedang mendapat giliran (`currentEntryOf`). */
  isCurrent: boolean;
  /** Peserta LAIN memegang attempt aktif (WAITING atau RUNNING): hanya satu per kompetisi. */
  otherActive: boolean;
  /** Ada peserta lain yang belum selesai (tujuan Skip). */
  hasOthersWaiting: boolean;
  /** Undian terkunci dan kompetisi SCHEDULED atau ONGOING. */
  open: boolean;
  /** Pemanggil boleh menjalankan (peran jalan). Tes "data mengizinkan?" memakai true. */
  runner: boolean;
  /** Pemanggil boleh memberi penalti. */
  penalizer: boolean;
};

/**
 * Flag `actions` satu peserta (kontrak 14, bagian "Flag actions"):
 * - Aksi jalan (`createAttempt`, `start`, `stop`, `retry`, `undo`, `nextParticipant`, `skip`,
 *   `markDns`) hanya untuk peserta yang sedang mendapat giliran dan belum DONE, DNS, atau DQ.
 * - `createAttempt`: tidak ada attempt aktif, tidak ada peserta lain yang memegang attempt aktif,
 *   dan jatah belum habis (terhitung < `attemptLimit`, keputusan 3A).
 * - `start` / `stop`: attempt aktif berstatus WAITING / RUNNING. `retry`: ada attempt aktif.
 * - `undo`: tidak ada attempt aktif dan ada attempt terhitung (yang terakhir dibatalkan).
 * - `nextParticipant`: tidak ada attempt aktif dan minimal satu attempt terhitung.
 * - `createAttempt` dan `nextParticipant` juga mati selama ada attempt FINISHED yang waktunya
 *   belum tersimpan (simpan hasilnya atau Undo dulu).
 * - `skip` dan `markDns`: tidak ada attempt aktif dan belum ada yang terhitung (tidak ada jatah
 *   yang terpakai); `skip` juga butuh peserta lain yang belum selesai.
 * - `undoDns` untuk DNS; `reopen` untuk DONE (tanpa syarat giliran).
 * - `disqualify`: peserta DNS tidak bisa; yang lain boleh bila sedang giliran atau sudah punya
 *   attempt. `undoDisqualify` bila ada DQ aktif.
 * Dipanggil dari mock untuk `GET /queue` dan semua route aksi (dengan runner/penalizer true untuk
 * membedakan 409 dari 403).
 */
export function participantActions(
  input: ParticipantRuleInput,
): QueueItemActions {
  const base = input.open && input.runner;
  const active = activeAttempt(input.attempts);
  const counted = countedAttempts(input.attempts);
  const onTurn =
    base &&
    input.isCurrent &&
    !input.disqualified &&
    (input.state === "NOT_STARTED" || input.state === "IN_PROGRESS");
  const idle = active === null;
  const nothingUsed = idle && counted === 0;
  const penaltyOpen = input.penalizer && input.open;
  // Attempt sudah di-stop tetapi waktunya belum tersimpan: simpan dulu (atau Undo) sebelum lanjut.
  const pendingResult = input.attempts.some(
    (a) => a.status === "FINISHED" && a.finalDurationMs === null,
  );
  return {
    createAttempt:
      onTurn &&
      idle &&
      !pendingResult &&
      !input.otherActive &&
      counted < input.attemptLimit,
    start: onTurn && active?.status === "WAITING" && !input.otherActive,
    stop: onTurn && active?.status === "RUNNING",
    retry: onTurn && !idle,
    undo: onTurn && idle && latestCountedAttempt(input.attempts) !== null,
    nextParticipant: onTurn && idle && !pendingResult && counted >= 1,
    skip: onTurn && nothingUsed && input.hasOthersWaiting,
    markDns: onTurn && nothingUsed,
    undoDns: base && input.state === "DNS",
    disqualify:
      penaltyOpen &&
      !input.disqualified &&
      input.state !== "DNS" &&
      input.state !== "DQ" &&
      (input.isCurrent || input.attempts.length > 0),
    undoDisqualify: penaltyOpen && input.disqualified,
    reopen: base && input.state === "DONE" && !input.disqualified,
  };
}
