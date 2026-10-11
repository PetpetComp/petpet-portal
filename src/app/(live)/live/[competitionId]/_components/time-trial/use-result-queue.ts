"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { RecordTimerResultInput } from "@/domains/timetrial/api";
import type { TimerResult } from "@/domains/timetrial/types";
import {
  resultFailurePatch,
  resultQueueReducer,
  type PendingResult,
} from "./result-queue";

type Options = {
  /** Status koneksi sekarang. Offline: ketukan langsung masuk antrean tanpa mengirim. */
  online: boolean;
  /** Stop + simpan waktu satu ketukan (`useStopAttempt().mutateAsync`). Boleh melempar RecordTimerResultError. */
  send: (input: RecordTimerResultInput) => Promise<TimerResult>;
  /** Hanya menyimpan waktu attempt yang sudah di-stop (`useRecordResult().mutateAsync`). */
  record: (input: RecordTimerResultInput) => Promise<TimerResult>;
};

/** Hasil satu percobaan kirim. */
type Outcome = "ok" | "network" | "failed";

/**
 * Hook antrean hasil waktu. Dipanggil dari layar Run Time trial.
 * - `submit(item)`: item baru (status awal sending, atau waiting bila offline). Item tetap di
 *   antrean sampai server menyimpannya, sehingga layar bisa menampilkan waktu lokal "Pending".
 * - `retry(id)`: kirim ulang satu item dengan `clientRequestId` yang SAMA (server tidak
 *   menggandakan). Item yang sudah di-stop di server hanya menyimpan waktu.
 * - `flush()`: kirim semua item waiting berurutan; berhenti di kegagalan jaringan pertama.
 *   Dipanggil otomatis saat event `online` browser.
 * - `discard(id)` / `clear()`: buang item (Undo sebelum terkirim, atau Discard pada item rejected).
 * Antrean hanya di memori: reload halaman membuangnya (batasan yang sama dengan antrean finish).
 */
export function useResultQueue({ online, send, record }: Options) {
  const [items, dispatch] = useReducer(resultQueueReducer, []);
  // Salinan terbaru untuk fungsi async dan listener event (tanpa menjadwalkan ulang listener).
  const latest = useRef({ items, send, record });
  useEffect(() => {
    latest.current = { items, send, record };
  });
  // Item yang sedang dikirim, supaya Retry dan flush tidak mengirim item yang sama bersamaan.
  const inFlight = useRef(new Set<string>());

  /** Mengirim satu item dan memperbarui statusnya. Mengembalikan hasilnya. */
  const attempt = useCallback(async (item: PendingResult): Promise<Outcome> => {
    if (inFlight.current.has(item.clientRequestId)) return "ok";
    inFlight.current.add(item.clientRequestId);
    dispatch({
      type: "patch",
      clientRequestId: item.clientRequestId,
      patch: { status: "sending", error: null },
    });
    const input: RecordTimerResultInput = {
      attemptId: item.attemptId,
      rawDurationMs: item.rawDurationMs,
      clientRequestId: item.clientRequestId,
    };
    try {
      if (item.stopped) await latest.current.record(input);
      else await latest.current.send(input);
      dispatch({ type: "remove", clientRequestId: item.clientRequestId });
      return "ok";
    } catch (cause) {
      const patch = resultFailurePatch(cause);
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
    (item: PendingResult) => {
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
