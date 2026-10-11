import type { DrawingMatch, DrawingParticipant } from "./types";

/**
 * Logika murni drawing: membagi peserta ke match dan menukar dua peserta.
 * Tidak menyentuh API, jam, atau React, jadi mudah diuji. Satu match = array `entryId`;
 * urutan di dalam array adalah nomor lane (indeks 0 = lane 1).
 */

/** Jumlah lane bawaan bila rule kompetisi belum mengisi `lane_total`. */
export const DEFAULT_LANES = 4;

/** Memastikan jumlah lane bilangan bulat >= 1; kalau tidak, lempar error agar bug cepat ketahuan. */
function assertLanes(lanes: number) {
  if (!Number.isInteger(lanes) || lanes < 1)
    throw new RangeError(`lanes must be an integer >= 1, got ${lanes}`);
}

/**
 * Jumlah match untuk `participantCount` peserta: pembulatan ke atas (n / lanes).
 * Dipanggil dari `matchSizes` dan dari layar (kartu statistik "matches").
 * Contoh: 45 peserta, 5 lane -> 9; 11 peserta, 5 lane -> 3; 0 peserta -> 0.
 */
export function matchCount(participantCount: number, lanes: number): number {
  assertLanes(lanes);
  if (participantCount <= 0) return 0;
  return Math.ceil(participantCount / lanes);
}

/**
 * Ukuran tiap match (aturan 3B): jumlah match = ceil(n / lanes), peserta disebar rata,
 * match yang lebih besar didahulukan. Supaya tidak ada match berisi 1 peserta bila bisa dihindari.
 * Contoh: 11/5 -> [4, 4, 3] (bukan 5, 5, 1); 45/5 -> sembilan angka 5; 1/5 -> [1].
 */
export function matchSizes(participantCount: number, lanes: number): number[] {
  const matches = matchCount(participantCount, lanes);
  if (matches === 0) return [];
  const base = Math.floor(participantCount / matches);
  const extra = participantCount % matches;
  // `extra` match pertama mendapat satu peserta lebih banyak.
  return Array.from({ length: matches }, (_, i) =>
    i < extra ? base + 1 : base,
  );
}

/**
 * Generator acak berbenih (mulberry32): benih sama selalu menghasilkan urutan angka sama.
 * Dipanggil dari `shuffled`. Mengembalikan fungsi yang memberi angka 0 <= x < 1.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mengacak salinan `items` (Fisher-Yates). Dengan `seed` hasilnya deterministik, tanpa `seed`
 * memakai Math.random. Array asli tidak diubah.
 */
export function shuffled<T>(items: readonly T[], seed?: number): T[] {
  const random = seed === undefined ? Math.random : seededRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Mengundi peserta ke match. Dipanggil dari tombol Shuffle (hasil tidak disimpan, keputusan 2A)
 * dan dari seed mock. Input: id entry, jumlah lane per match, benih opsional.
 * Output: daftar match, tiap match daftar entry id menurut nomor lane. Setiap id muncul tepat sekali.
 */
export function buildDrawing(
  entryIds: readonly string[],
  lanes: number,
  seed?: number,
): string[][] {
  assertLanes(lanes);
  const order = shuffled(entryIds, seed);
  const matches: string[][] = [];
  let cursor = 0;
  for (const size of matchSizes(order.length, lanes)) {
    matches.push(order.slice(cursor, cursor + size));
    cursor += size;
  }
  return matches;
}

/**
 * Menukar posisi (match + lane) dua peserta. Dipanggil dari layar untuk pratinjau lokal
 * dan menjadi aturan yang sama dengan `POST .../drawing/swap` di backend/mock.
 * Mengembalikan salinan baru; melempar error bila salah satu id tidak ada atau keduanya sama.
 */
export function swapInDrawing(
  matches: readonly (readonly string[])[],
  entryIdA: string,
  entryIdB: string,
): string[][] {
  if (entryIdA === entryIdB)
    throw new Error("Cannot swap an entry with itself");
  const copy = matches.map((match) => [...match]);
  const find = (entryId: string): [number, number] => {
    for (let m = 0; m < copy.length; m++) {
      const lane = copy[m].indexOf(entryId);
      if (lane !== -1) return [m, lane];
    }
    throw new Error(`Entry not found in drawing: ${entryId}`);
  };
  const [matchA, laneA] = find(entryIdA);
  const [matchB, laneB] = find(entryIdB);
  copy[matchA][laneA] = entryIdB;
  copy[matchB][laneB] = entryIdA;
  return copy;
}

/**
 * Membangun match untuk layar dari hasil `buildDrawing` (pratinjau Shuffle sebelum Lock).
 * Dipanggil dari layar Drawing. `participants` dicari lewat entry id; id tak dikenal melempar error.
 */
export function draftMatches(
  participants: readonly DrawingParticipant[],
  matches: readonly (readonly string[])[],
): DrawingMatch[] {
  const byId = new Map(participants.map((p) => [p.entryId, p]));
  return matches.map((ids, index) => ({
    id: `draft-${index + 1}`,
    number: index + 1,
    status: "SCHEDULED",
    lanes: ids.map((entryId, laneIndex) => {
      const participant = byId.get(entryId);
      if (!participant) throw new Error(`Unknown participant: ${entryId}`);
      return { ...participant, laneNumber: laneIndex + 1 };
    }),
  }));
}

/** Mengambil susunan entry id per match dari match layar (kebalikan `draftMatches`). */
export function entryIdsOf(matches: readonly DrawingMatch[]): string[][] {
  return matches.map((match) => match.lanes.map((lane) => lane.entryId));
}
