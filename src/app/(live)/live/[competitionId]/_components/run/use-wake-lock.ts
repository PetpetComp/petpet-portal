"use client";
import { useEffect } from "react";

/**
 * Menjaga layar tetap menyala selama `active` (timer berjalan), lewat Screen Wake Lock API.
 * Dipanggil dari layar Run Match. Fitur dideteksi dulu; browser tanpa dukungan atau penolakan
 * izin diabaikan begitu saja (layar boleh redup, tidak ada yang rusak). Wake lock otomatis
 * dilepas browser saat tab disembunyikan, jadi diminta lagi saat tab terlihat kembali.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    if (!("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
      } catch {
        // Ditolak atau tidak didukung: abaikan.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
