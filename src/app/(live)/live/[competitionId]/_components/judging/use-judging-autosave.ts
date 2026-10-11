"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTOSAVE_DEBOUNCE_MS } from "@/domains/judging/constants";
import {
  useEnsureScorecard,
  useSaveJudgeNote,
  useSaveScores,
} from "@/domains/judging/queries";
import type { Judging } from "@/domains/judging/types";
import { ApiError } from "@/lib/api-client";
import {
  buildChanges,
  clearSaved,
  hasSavable,
  type DirtyMap,
} from "./autosave";

/** Status indikator simpan: idle (belum ada edit), saving, saved, offline (akan dicoba lagi), error. */
export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

/** True bila kegagalan kemungkinan karena jaringan (dicoba lagi otomatis saat online). */
function isNetworkError(cause: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (cause instanceof ApiError)
    return cause.status === 0 || cause.status >= 502;
  return true;
}

/**
 * Autosave layar Judging. Dipanggil dari JudgingBoard. Input: id kompetisi dan data `Judging`
 * terbaru. Output: perubahan lokal yang belum tersimpan (`dirty`), status simpan, fungsi edit
 * (`setScore`, `setCriterionNote`, `setJudgeNote`), dan `flushEntry`/`flushAll`.
 *
 * Cara kerja:
 * 1. Setiap edit masuk ke `dirty` (tampil langsung) dan memulai timer debounce
 *    `AUTOSAVE_DEBOUNCE_MS` per peserta; edit berikutnya mengulang timer.
 * 2. Saat timer habis (atau `flushEntry` dipanggil), peserta disimpan: `ensureScorecard` hanya bila
 *    belum punya scorecard (lazy, sekali), lalu `saveScores` hanya kriteria yang berubah, lalu
 *    `saveJudgeNote` bila catatan juri berubah. Simpan per peserta berjalan berurutan (antrean
 *    promise) agar tidak ada dua simpanan bersamaan.
 * 3. Sukses -> bagian dirty yang sudah terkirim dibuang. Gagal -> dirty DIPERTAHANKAN, status
 *    "offline" atau "error"; dicoba lagi saat event `online` browser atau tombol Retry.
 * 4. Flush langsung tanpa menunggu debounce: ganti peserta, blur, halaman disembunyikan
 *    (`visibilitychange`/`pagehide`), dan unmount.
 */
export function useJudgingAutosave(competitionId: string, judging: Judging) {
  const ensure = useEnsureScorecard(competitionId);
  const saveScores = useSaveScores(competitionId);
  const saveNote = useSaveJudgeNote(competitionId);

  const [dirty, setDirty] = useState<DirtyMap>({});
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Cermin untuk pembacaan sinkron di dalam callback/timer (bukan saat render).
  const dirtyRef = useRef<DirtyMap>({});
  const judgingRef = useRef(judging);
  const apiRef = useRef({ ensure, saveScores, saveNote });
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chains = useRef(new Map<string, Promise<void>>());
  const scorecardIds = useRef(new Map<string, string>());
  const inflight = useRef(0);

  useEffect(() => {
    judgingRef.current = judging;
    apiRef.current = { ensure, saveScores, saveNote };
  });

  /** Mengubah `dirty` (ref dan state sekaligus). Hanya dipanggil dari event handler/callback. */
  const updateDirty = useCallback((change: (prev: DirtyMap) => DirtyMap) => {
    const next = change(dirtyRef.current);
    dirtyRef.current = next;
    setDirty(next);
  }, []);

  /** Status setelah satu simpanan selesai: masih ada timer/permintaan -> saving, selain itu saved. */
  const settle = useCallback(() => {
    setStatus(
      timers.current.size > 0 || inflight.current > 0 ? "saving" : "saved",
    );
  }, []);

  /**
   * Menyimpan SEMUA perubahan yang bisa dikirim untuk satu peserta. Tidak pernah melempar:
   * kegagalan dicatat di status dan dirty dipertahankan.
   */
  const saveEntry = useCallback(
    async (entryId: string) => {
      const entry = dirtyRef.current[entryId];
      const current = judgingRef.current;
      const participant = current.participants.find(
        (p) => p.entryId === entryId,
      );
      if (!entry || !participant) return;
      const changes = buildChanges(participant.scores, entry);
      const judgeNote = entry.judgeNote;
      if (changes.length === 0 && judgeNote === undefined) {
        settle();
        return;
      }
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      inflight.current += 1;
      setStatus("saving");
      try {
        let scorecardId =
          scorecardIds.current.get(entryId) ?? participant.scorecardId;
        if (!scorecardId) {
          scorecardId = await apiRef.current.ensure.mutateAsync({
            roundId: current.roundId,
            entryId,
            scorecardId: null,
            staffAssignmentId: current.judge?.staffAssignmentId,
          });
        }
        scorecardIds.current.set(entryId, scorecardId);
        if (changes.length > 0)
          await apiRef.current.saveScores.mutateAsync({ scorecardId, changes });
        if (judgeNote !== undefined)
          await apiRef.current.saveNote.mutateAsync({
            scorecardId,
            note: judgeNote,
          });
        updateDirty((prev) => {
          const left = clearSaved(prev[entryId], changes, judgeNote);
          const next = { ...prev };
          if (left) next[entryId] = left;
          else delete next[entryId];
          return next;
        });
        inflight.current -= 1;
        settle();
      } catch (cause) {
        inflight.current -= 1;
        setStatus(isNetworkError(cause) ? "offline" : "error");
      }
    },
    [settle, updateDirty],
  );

  /**
   * Menyimpan peserta sekarang (tanpa menunggu debounce), berurutan setelah simpanan sebelumnya
   * untuk peserta yang sama. Mengembalikan true bila tidak ada lagi yang menunggu dikirim
   * (dipakai Submit: bila false, jangan submit dulu).
   */
  const flushEntry = useCallback(
    (entryId: string): Promise<boolean> => {
      const timer = timers.current.get(entryId);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(entryId);
      }
      const previous = chains.current.get(entryId) ?? Promise.resolve();
      const next = previous.then(() => saveEntry(entryId));
      chains.current.set(entryId, next);
      return next.then(() => {
        const participant = judgingRef.current.participants.find(
          (p) => p.entryId === entryId,
        );
        return !hasSavable(
          participant?.scores ?? {},
          dirtyRef.current[entryId],
        );
      });
    },
    [saveEntry],
  );

  /** Menyimpan semua peserta yang punya perubahan. Dipanggil saat online, page hide, unmount, Retry. */
  const flushAll = useCallback(() => {
    for (const entryId of Object.keys(dirtyRef.current))
      void flushEntry(entryId);
  }, [flushEntry]);

  /** Menjadwalkan simpan peserta setelah jeda debounce; edit baru mengulang jedanya. */
  const schedule = useCallback(
    (entryId: string) => {
      const old = timers.current.get(entryId);
      if (old) clearTimeout(old);
      timers.current.set(
        entryId,
        setTimeout(() => {
          timers.current.delete(entryId);
          void flushEntry(entryId);
        }, AUTOSAVE_DEBOUNCE_MS),
      );
      setStatus("saving");
    },
    [flushEntry],
  );

  /** Mengubah skor satu kriteria (sudah dinormalisasi). */
  const setScore = useCallback(
    (entryId: string, criterionId: string, score: number) => {
      updateDirty((prev) => {
        const entry = prev[entryId] ?? { criteria: {} };
        const criterion = entry.criteria[criterionId] ?? {};
        return {
          ...prev,
          [entryId]: {
            ...entry,
            criteria: {
              ...entry.criteria,
              [criterionId]: { ...criterion, score },
            },
          },
        };
      });
      schedule(entryId);
    },
    [schedule, updateDirty],
  );

  /** Mengubah catatan satu kriteria. */
  const setCriterionNote = useCallback(
    (entryId: string, criterionId: string, note: string) => {
      updateDirty((prev) => {
        const entry = prev[entryId] ?? { criteria: {} };
        const criterion = entry.criteria[criterionId] ?? {};
        return {
          ...prev,
          [entryId]: {
            ...entry,
            criteria: {
              ...entry.criteria,
              [criterionId]: { ...criterion, note },
            },
          },
        };
      });
      schedule(entryId);
    },
    [schedule, updateDirty],
  );

  /** Mengubah catatan juri keseluruhan. */
  const setJudgeNote = useCallback(
    (entryId: string, note: string) => {
      updateDirty((prev) => ({
        ...prev,
        [entryId]: {
          criteria: prev[entryId]?.criteria ?? {},
          judgeNote: note,
        },
      }));
      schedule(entryId);
    },
    [schedule, updateDirty],
  );

  /** Id scorecard yang dibuat lazily oleh hook ini (undefined bila belum). Dibaca saat Submit. */
  const scorecardIdOf = useCallback(
    (entryId: string) => scorecardIds.current.get(entryId),
    [],
  );

  // Pemicu flush: browser kembali online, halaman disembunyikan/ditutup, dan unmount.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    window.addEventListener("online", flushAll);
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", flushAll);
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onHide);
      flushAll();
    };
  }, [flushAll]);

  return {
    dirty,
    status,
    setScore,
    setCriterionNote,
    setJudgeNote,
    flushEntry,
    flushAll,
    scorecardIdOf,
  };
}
