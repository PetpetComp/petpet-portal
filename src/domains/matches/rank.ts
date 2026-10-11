import type { ResultStatus } from "@/domains/results/types";
import type { LaneOutcome, Match } from "./types";

/**
 * Logika murni peringkat satu match. Dipakai dua tempat dengan fungsi yang SAMA: layar (pratinjau
 * di dialog Confirm, body `POST /heats/{uuid}/confirm`) dan mock (memeriksa body Confirm).
 * Backend asli sebaiknya memakai aturan yang sama saat memvalidasi.
 */

/** Masukan satu lane untuk `rankFinishes`. */
export type LaneRankInput = {
  heatEntryId: string;
  laneNumber: number;
  /** `heat_entries.call_status`; hanya nilai DNS yang berpengaruh di sini. */
  callStatus: string;
  /** `captured_time_ms` finish aktif lane ini; null bila belum finish. */
  finishTimeMs: number | null;
  /** `finish_order` finish aktif lane ini; dipakai memutus waktu sama. */
  finishOrder: number | null;
  /** True bila ada penalti DISQUALIFICATION yang ACTIVE. */
  disqualified: boolean;
};

/** Urutan kelompok di papan hasil: selesai, lalu DNF, DQ, DNS (sama dengan hasil kompetisi). */
const GROUP_ORDER: Record<ResultStatus, number> = {
  FINISHED: 0,
  DNF: 1,
  DQ: 2,
  DNS: 3,
};

/**
 * Status akhir satu lane. Urutan cek penting (yang pertama cocok menang):
 * 1. DNS: peserta tidak muncul. Menang atas DQ (DNS tidak bisa didiskualifikasi).
 * 2. DQ: ada diskualifikasi aktif, walau sudah sempat finish.
 * 3. DNF: tidak punya finish, atau finish-nya melewati cut-off (`finishTimeMs > cutoffMs`).
 * 4. FINISHED.
 */
export function laneStatus(
  lane: LaneRankInput,
  cutoffMs: number | null,
): ResultStatus {
  if (lane.callStatus === "DNS") return "DNS";
  if (lane.disqualified) return "DQ";
  if (lane.finishTimeMs === null) return "DNF";
  if (cutoffMs !== null && cutoffMs > 0 && lane.finishTimeMs > cutoffMs)
    return "DNF";
  return "FINISHED";
}

/**
 * Menyusun hasil satu match. Aturan:
 * - Kelompok: FINISHED, lalu DNF, lalu DQ, lalu DNS.
 * - Di dalam FINISHED: waktu tercepat (`finishTimeMs`) lebih dulu. Waktu SAMA diputus oleh
 *   `finishOrder` yang lebih kecil (yang lebih dulu diketuk), lalu nomor lane. Jadi tidak ada
 *   posisi kembar: posisi selalu 1..n berurutan (sama dengan `rankResults` di hasil kompetisi).
 * - Di dalam DNF, DQ, DNS: urut nomor lane.
 * - `completedTimeMs` hanya terisi untuk FINISHED (waktu mentah, penalti waktu belum ada di P5a).
 * - Finish melewati cut-off menjadi DNF dan waktunya tidak dicatat.
 * Mengembalikan satu baris per masukan, urut menurut posisi. Masukan tidak diubah.
 */
export function rankFinishes(
  lanes: readonly LaneRankInput[],
  cutoffMs: number | null = null,
): LaneOutcome[] {
  const classified = lanes.map((lane) => ({
    lane,
    status: laneStatus(lane, cutoffMs),
  }));
  classified.sort((a, b) => {
    const group = GROUP_ORDER[a.status] - GROUP_ORDER[b.status];
    if (group !== 0) return group;
    if (a.status === "FINISHED") {
      const byTime = (a.lane.finishTimeMs ?? 0) - (b.lane.finishTimeMs ?? 0);
      if (byTime !== 0) return byTime;
      const byOrder =
        (a.lane.finishOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.lane.finishOrder ?? Number.MAX_SAFE_INTEGER);
      if (byOrder !== 0) return byOrder;
    }
    return a.lane.laneNumber - b.lane.laneNumber;
  });
  return classified.map(({ lane, status }, index) => ({
    heatEntryId: lane.heatEntryId,
    position: index + 1,
    status,
    completedTimeMs: status === "FINISHED" ? lane.finishTimeMs : null,
  }));
}

/**
 * Masukan `rankFinishes` dari match di layar: finish dan diskualifikasi diambil dari lane.
 * Dipanggil dari `matchOutcomes`.
 */
export function laneInputsFromMatch(
  match: Pick<Match, "lanes">,
): LaneRankInput[] {
  return match.lanes.map((lane) => ({
    heatEntryId: lane.heatEntryId,
    laneNumber: lane.laneNumber,
    callStatus: lane.callStatus,
    finishTimeMs: lane.finish?.capturedTimeMs ?? null,
    finishOrder: lane.finish?.finishOrder ?? null,
    disqualified: lane.disqualification !== null,
  }));
}

/**
 * Hasil sementara match di layar (pratinjau dialog Confirm). Cut-off diambil dari sesi yang
 * berlaku. Dipanggil dari layar Run Match; hasilnya juga bahan body Confirm (`confirmBody`).
 */
export function matchOutcomes(
  match: Pick<Match, "lanes" | "currentSession">,
): LaneOutcome[] {
  return rankFinishes(
    laneInputsFromMatch(match),
    match.currentSession?.cutoffTimeMs ?? null,
  );
}

/**
 * True bila semua lane sudah punya keputusan akhir yang tidak menunggu ketukan lagi: sudah finish,
 * DNS, atau DQ. Saat benar, layar boleh menghentikan sesi dengan alasan ALL_FINISHED.
 * Match tanpa lane tidak dianggap selesai.
 */
export function allLanesResolved(lanes: readonly LaneRankInput[]): boolean {
  if (lanes.length === 0) return false;
  return lanes.every(
    (lane) =>
      lane.callStatus === "DNS" ||
      lane.disqualified ||
      lane.finishTimeMs !== null,
  );
}
