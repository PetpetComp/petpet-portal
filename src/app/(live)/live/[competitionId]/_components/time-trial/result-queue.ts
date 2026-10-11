import { RecordTimerResultError } from "@/domains/timetrial/api";
import { isRetryableError } from "../run/finish-queue";

/**
 * Antrean hasil waktu Time trial di memori (murni, tanpa React). Dipakai oleh `use-result-queue.ts`.
 * Meniru antrean finish Run Match: tiap ketukan Stop menjadi satu `PendingResult` yang hidup sampai
 * server menyimpan waktunya. Selama itu peserta menampilkan waktu lokal dengan label "Pending" dan
 * tombol yang bergantung pada hasil (Next participant, dst) mati.
 *
 * Status:
 * - sending: request sedang dikirim.
 * - waiting: jaringan putus / offline; menunggu event `online` atau tombol Retry.
 * - rejected: server menolak (409, 422, dst). Operator bisa Retry atau Discard.
 */
export type PendingResultStatus = "sending" | "waiting" | "rejected";

export type PendingResult = {
  /** Id idempotensi: dibuat sekali per ketukan Stop, dipakai ulang di setiap retry. */
  clientRequestId: string;
  attemptId: string;
  /** Peserta (entry) pemilik attempt. */
  entryId: string;
  petName: string;
  /** Nomor attempt yang tampil di layar ("attempt 2"): terhitung + 1 saat Stop. */
  attemptLabel: number;
  /** Waktu yang dilihat operator saat mengetuk Stop (ms), dikirim apa adanya. */
  rawDurationMs: number;
  /**
   * True bila attempt SUDAH di-stop di server tetapi waktunya belum tersimpan
   * (`RecordTimerResultError`). Retry lalu hanya menyimpan waktu, tidak Stop lagi.
   */
  stopped: boolean;
  status: PendingResultStatus;
  /** Pesan kegagalan terakhir untuk ditampilkan. */
  error: string | null;
};

export type ResultQueueAction =
  | { type: "add"; item: PendingResult }
  | {
      type: "patch";
      clientRequestId: string;
      patch: Partial<PendingResult>;
    }
  | { type: "remove"; clientRequestId: string }
  | { type: "clear" };

/** Reducer antrean. Dipanggil oleh `useReducer` di `use-result-queue.ts`. Tidak mengubah state lama. */
export function resultQueueReducer(
  items: readonly PendingResult[],
  action: ResultQueueAction,
): PendingResult[] {
  switch (action.type) {
    case "add":
      // Id yang sama tidak boleh dobel (ketukan yang sama).
      return [
        ...items.filter(
          (i) => i.clientRequestId !== action.item.clientRequestId,
        ),
        action.item,
      ];
    case "patch":
      return items.map((i) =>
        i.clientRequestId === action.clientRequestId
          ? { ...i, ...action.patch }
          : i,
      );
    case "remove":
      return items.filter((i) => i.clientRequestId !== action.clientRequestId);
    case "clear":
      return [];
  }
}

/**
 * Perubahan status item setelah pengiriman gagal. Dipanggil dari hook antrean.
 * - `RecordTimerResultError` (Stop berhasil, waktu belum tersimpan): `stopped = true`; jaringan
 *   putus -> waiting, selain itu rejected.
 * - jaringan putus atau server tidak tersedia -> waiting.
 * - selain itu -> rejected dengan pesan servernya.
 */
export function resultFailurePatch(error: unknown): Partial<PendingResult> {
  if (error instanceof RecordTimerResultError) {
    if (isRetryableError(error.original))
      return {
        stopped: true,
        status: "waiting",
        error: "Waiting for a connection.",
      };
    return { stopped: true, status: "rejected", error: error.message };
  }
  if (isRetryableError(error))
    return { status: "waiting", error: "Waiting for a connection." };
  return {
    status: "rejected",
    error:
      error instanceof Error && error.message
        ? error.message
        : "The time was not accepted.",
  };
}

/** Jumlah hasil yang belum sampai ke server karena jaringan (untuk banner "N results waiting"). */
export function waitingResultCount(items: readonly PendingResult[]): number {
  return items.filter((i) => i.status === "waiting").length;
}
