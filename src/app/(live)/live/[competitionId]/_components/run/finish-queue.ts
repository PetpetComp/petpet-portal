import { AssignFinishError } from "@/domains/matches/api";
import { nextFinishOrder } from "@/domains/matches/time";
import type { FinishCapture } from "@/domains/matches/types";
import { ApiError } from "@/lib/api-client";

/**
 * Antrean finish di memori (murni, tanpa React). Dipakai oleh `use-finish-queue.ts`.
 * Tiap ketukan Finish menjadi satu `PendingFinish` yang hidup sampai server menyimpannya.
 * Selama itu lane menampilkan waktu lokal (optimistic UI) dan tombol Confirm mati.
 *
 * Status:
 * - sending: request sedang dikirim.
 * - waiting: jaringan putus / offline; menunggu event `online` atau tombol Retry.
 * - unassigned: capture SUDAH tersimpan di server tetapi assign gagal. Retry hanya memanggil
 *   assign, JANGAN capture lagi (itu membuat finish kedua).
 * - rejected: server menolak (409, 422, dst). Operator bisa Retry atau Discard.
 */
export type PendingFinishStatus =
  "sending" | "waiting" | "unassigned" | "rejected";

export type PendingFinish = {
  /** Id idempotensi: dibuat sekali per ketukan, dipakai ulang di setiap retry. */
  clientRequestId: string;
  sessionId: string;
  /** Peserta (entry) pemilik lane yang diketuk. */
  entryId: string;
  laneNumber: number;
  petName: string;
  finishOrder: number;
  /** Waktu yang dilihat operator saat mengetuk. */
  capturedTimeMs: number;
  status: PendingFinishStatus;
  /** Capture yang sudah tersimpan (hanya untuk status unassigned). */
  capture: FinishCapture | null;
  /** Pesan kegagalan terakhir untuk ditampilkan. */
  error: string | null;
};

export type QueueAction =
  | { type: "add"; item: PendingFinish }
  | {
      type: "patch";
      clientRequestId: string;
      patch: Partial<PendingFinish>;
    }
  | { type: "remove"; clientRequestId: string }
  | { type: "clear" };

/** Reducer antrean. Dipanggil oleh `useReducer` di `use-finish-queue.ts`. Tidak mengubah state lama. */
export function queueReducer(
  items: readonly PendingFinish[],
  action: QueueAction,
): PendingFinish[] {
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

/** True bila error berarti "belum sampai ke server, coba lagi nanti": jaringan putus atau server tidak tersedia. */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError)
    return (
      error.status === 0 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    );
  // fetch yang gagal di luar api-client melempar TypeError.
  return error instanceof TypeError;
}

/**
 * Perubahan status item setelah pengiriman gagal. Dipanggil dari hook antrean.
 * - AssignFinishError -> unassigned (membawa capture yang sudah tersimpan).
 * - jaringan putus -> waiting.
 * - selain itu -> rejected dengan pesan servernya.
 */
export function failurePatch(error: unknown): Partial<PendingFinish> {
  if (error instanceof AssignFinishError)
    return {
      status: "unassigned",
      capture: error.capture,
      error: "Finish recorded, not assigned.",
    };
  if (isRetryableError(error))
    return { status: "waiting", error: "Waiting for a connection." };
  return {
    status: "rejected",
    error:
      error instanceof Error && error.message
        ? error.message
        : "The finish was not accepted.",
  };
}

/** Jumlah finish yang belum sampai ke server karena jaringan (untuk banner "N finishes waiting"). */
export function waitingCount(items: readonly PendingFinish[]): number {
  return items.filter((i) => i.status === "waiting").length;
}

/**
 * `finish_order` untuk ketukan baru: lebih besar dari semua capture di server DAN semua item
 * antrean sesi yang sama, jadi dua ketukan offline berurutan tidak bentrok nomor.
 */
export function nextOrderWithQueue(
  captures: readonly { finishOrder: number }[],
  items: readonly PendingFinish[],
  sessionId: string,
): number {
  const queued = items
    .filter((i) => i.sessionId === sessionId)
    .map((i) => ({ finishOrder: i.finishOrder }));
  return nextFinishOrder([...captures, ...queued]);
}
