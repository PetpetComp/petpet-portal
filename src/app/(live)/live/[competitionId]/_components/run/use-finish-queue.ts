"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { CaptureFinishInput } from "@/domains/matches/api";
import type { FinishCapture } from "@/domains/matches/types";
import { failurePatch, queueReducer, type PendingFinish } from "./finish-queue";

type Options = {
  /** Status koneksi sekarang. Offline: ketukan langsung masuk antrean tanpa mengirim. */
  online: boolean;
  /** Capture + assign satu ketukan (`useCaptureFinish().mutateAsync`). Boleh melempar AssignFinishError. */
  capture: (input: CaptureFinishInput) => Promise<FinishCapture>;
  /** Assign ulang capture yang tertinggal (`useAssignFinish().mutateAsync`). */
  assign: (v: { captureId: string; entryId: string }) => Promise<FinishCapture>;
};

/** Hasil satu percobaan kirim. */
type Attempt = "ok" | "network" | "failed";

/**
 * Hook antrean finish. Dipanggil dari layar Run Match.
 * - `submit(item)`: item baru (status awal sending, atau waiting bila offline). Item tetap di
 *   antrean sampai server menyimpannya, sehingga lane bisa menampilkan waktu lokal.
 * - `retry(id)`: kirim ulang satu item dengan `clientRequestId` yang SAMA (server tidak
 *   menggandakan). Item unassigned hanya di-assign ulang.
 * - `flush()`: kirim semua item waiting berurutan; berhenti di kegagalan jaringan pertama.
 *   Dipanggil otomatis saat event `online` browser.
 * - `discard(id)` / `clear()`: buang item (Discard pada item rejected, atau Rematch).
 * Antrean hanya di memori: reload halaman membuangnya (batasan yang diketahui).
 */
export function useFinishQueue({ online, capture, assign }: Options) {
  const [items, dispatch] = useReducer(queueReducer, []);
  // Salinan terbaru untuk fungsi async dan listener event (tanpa menjadwalkan ulang listener).
  const latest = useRef({ items, capture, assign });
  useEffect(() => {
    latest.current = { items, capture, assign };
  });
  // Item yang sedang dikirim, supaya Retry dan flush tidak mengirim item yang sama bersamaan.
  const inFlight = useRef(new Set<string>());

  /** Mengirim satu item dan memperbarui statusnya. Mengembalikan hasilnya. */
  const attempt = useCallback(async (item: PendingFinish): Promise<Attempt> => {
    if (inFlight.current.has(item.clientRequestId)) return "ok";
    inFlight.current.add(item.clientRequestId);
    dispatch({
      type: "patch",
      clientRequestId: item.clientRequestId,
      patch: { status: "sending", error: null },
    });
    try {
      if (item.capture)
        await latest.current.assign({
          captureId: item.capture.id,
          entryId: item.entryId,
        });
      else
        await latest.current.capture({
          sessionId: item.sessionId,
          finishOrder: item.finishOrder,
          capturedTimeMs: item.capturedTimeMs,
          entryId: item.entryId,
          clientRequestId: item.clientRequestId,
        });
      dispatch({ type: "remove", clientRequestId: item.clientRequestId });
      return "ok";
    } catch (cause) {
      const patch = failurePatch(cause);
      dispatch({
        type: "patch",
        clientRequestId: item.clientRequestId,
        patch,
      });
      return patch.status === "waiting" ? "network" : "failed";
    } finally {
      inFlight.current.delete(item.clientRequestId);
    }
  }, []);

  const submit = useCallback(
    (item: PendingFinish) => {
      if (!online) {
        dispatch({
          type: "add",
          item: {
            ...item,
            status: "waiting",
            error: "Waiting for a connection.",
          },
        });
        return;
      }
      dispatch({ type: "add", item: { ...item, status: "sending" } });
      void attempt(item);
    },
    [online, attempt],
  );

  const retry = useCallback(
    (clientRequestId: string) => {
      const item = latest.current.items.find(
        (i) => i.clientRequestId === clientRequestId,
      );
      if (item) void attempt(item);
    },
    [attempt],
  );

  const flush = useCallback(async () => {
    const waiting = latest.current.items.filter((i) => i.status === "waiting");
    for (const item of waiting) {
      const result = await attempt(item);
      if (result === "network") break;
    }
  }, [attempt]);

  const discard = useCallback(
    (clientRequestId: string) => dispatch({ type: "remove", clientRequestId }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  // Kirim otomatis begitu browser kembali online.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  return { items, submit, retry, flush, discard, clear };
}
