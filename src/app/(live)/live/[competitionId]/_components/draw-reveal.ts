/**
 * Helper murni untuk animasi reveal Drawing (tanpa React, mudah dites).
 * Hasil undian sudah dihitung instan; helper ini hanya menentukan KAPAN tiap slot "mengendap".
 */

/** Interval satu tick animasi (ms). Nama yang berputar berganti sekali per tick. */
export const REVEAL_TICK_MS = 70;
/** Lama semua slot berputar sebelum slot pertama mengendap (ms). */
export const REVEAL_SPIN_MS = 600;
/** Jeda maksimum antar slot yang mengendap (ms). */
export const REVEAL_MAX_STAGGER_MS = 140;
/** Anggaran waktu total untuk seluruh jeda antar slot (ms), supaya durasi tetap sekitar 3 detik. */
export const REVEAL_STAGGER_BUDGET_MS = 2200;

/**
 * Menghitung jadwal reveal. Dipanggil dari `useDrawReveal` dan `settledCountAt`.
 * Input: jumlah slot (peserta). Output: lama putar, jeda antar slot, dan total durasi.
 * Kenapa: jeda = min(140ms, 2200ms / slot) membuat total <= 600 + 2200 = 2800ms berapa pun jumlah pesertanya.
 */
export function revealTiming(slotCount: number) {
  const staggerMs =
    slotCount <= 0
      ? 0
      : Math.min(REVEAL_MAX_STAGGER_MS, REVEAL_STAGGER_BUDGET_MS / slotCount);
  return {
    spinMs: REVEAL_SPIN_MS,
    staggerMs,
    totalMs: REVEAL_SPIN_MS + staggerMs * Math.max(slotCount, 0),
  };
}

/**
 * Berapa slot yang sudah mengendap setelah `elapsedMs`. Slot mengendap berurutan (urutan baca).
 * Contoh: 5 slot -> spin 600ms, jeda 140ms: di 600ms = 1, di 740ms = 2, di 1160ms = 5.
 */
export function settledCountAt(elapsedMs: number, slotCount: number): number {
  if (slotCount <= 0) return 0;
  const { spinMs, staggerMs } = revealTiming(slotCount);
  if (elapsedMs < spinMs) return 0;
  return Math.min(slotCount, Math.floor((elapsedMs - spinMs) / staggerMs) + 1);
}

/**
 * Indeks peserta yang ditampilkan satu slot saat berputar. Dipanggil dari kartu match tiap render.
 * Deterministik (hash dari frame + slot), jadi murni dan bisa dites; terlihat acak oleh mata.
 */
export function spinIndex(
  poolSize: number,
  slotIndex: number,
  frame: number,
): number {
  if (poolSize <= 0) return 0;
  return ((frame * 2654435761 + slotIndex * 40503) >>> 0) % poolSize;
}

/**
 * Indeks slot pertama tiap match dalam urutan baca. Contoh: match berukuran [3, 2, 1] -> [0, 3, 5].
 * Dipanggil dari DraftDrawing untuk memberi tahu kartu "slot ke berapa" barisnya.
 */
export function matchOffsets(sizes: readonly number[]): number[] {
  const offsets: number[] = [];
  let running = 0;
  for (const size of sizes) {
    offsets.push(running);
    running += size;
  }
  return offsets;
}
