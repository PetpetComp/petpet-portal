/**
 * Logika murni autosave Judging (tanpa React dan jaringan), supaya mudah dites.
 *
 * Ide: perubahan juri yang BELUM tersimpan disebut "dirty" dan disimpan di sisi klien per peserta.
 * Layar menampilkan nilai server ditimpa nilai dirty. Setelah server menerima, bagian dirty yang
 * sama dibuang; bila gagal, dirty tetap ada sehingga tidak ada edit yang hilang.
 */
import type { ScoreChange } from "@/domains/judging/api";
import type { ScoreMap } from "@/domains/judging/types";

/** Perubahan lokal satu kriteria: `score` dan/atau `note` yang belum tersimpan. */
export type DirtyCriterion = { score?: number; note?: string };

/** Perubahan lokal satu peserta. `judgeNote` adalah catatan juri keseluruhan. */
export type DirtyEntry = {
  criteria: Record<string, DirtyCriterion>;
  judgeNote?: string;
};

/** Perubahan lokal semua peserta, kunci = id entry. */
export type DirtyMap = Record<string, DirtyEntry>;

/**
 * Menggabungkan nilai server dengan perubahan lokal untuk ditampilkan dan divalidasi.
 * Dipanggil dari layar tiap render. Input: peta nilai server dan dirty peserta itu (boleh kosong).
 * Output: ScoreMap baru; kriteria tanpa skor di keduanya bernilai `score: null`.
 */
export function mergeScores(server: ScoreMap, dirty?: DirtyEntry): ScoreMap {
  const merged: ScoreMap = {};
  for (const [id, entry] of Object.entries(server)) merged[id] = { ...entry };
  for (const [id, d] of Object.entries(dirty?.criteria ?? {})) {
    const base = merged[id] ?? { score: null, note: "" };
    merged[id] = {
      score: d.score ?? base.score,
      note: d.note ?? base.note,
    };
  }
  return merged;
}

/**
 * Daftar perubahan yang bisa dikirim ke `PUT criterion-scores`: hanya kriteria yang berubah dan
 * yang punya skor (skor lokal, kalau tidak ada skor server). Catatan tanpa skor belum bisa
 * dikirim (API butuh skor), jadi dilewati dan tetap dirty sampai skor ada.
 * Contoh: dirty {a: {score: 8}, b: {note: "x"}}, server b skor 6 -> [{a, 8}, {b, 6, note x}].
 */
export function buildChanges(
  server: ScoreMap,
  dirty: DirtyEntry,
): ScoreChange[] {
  const changes: ScoreChange[] = [];
  for (const [id, d] of Object.entries(dirty.criteria)) {
    if (d.score === undefined && d.note === undefined) continue;
    const score = d.score ?? server[id]?.score ?? null;
    if (score === null) continue;
    changes.push({
      criterionId: id,
      score,
      ...(d.note !== undefined ? { note: d.note } : {}),
    });
  }
  return changes;
}

/** True bila peserta ini punya sesuatu yang bisa dikirim sekarang (skor/catatan kriteria atau catatan juri). */
export function hasSavable(server: ScoreMap, dirty?: DirtyEntry): boolean {
  if (!dirty) return false;
  return (
    dirty.judgeNote !== undefined || buildChanges(server, dirty).length > 0
  );
}

/**
 * Membuang bagian dirty yang SUDAH tersimpan, yaitu yang nilainya masih sama dengan yang dikirim.
 * Bila juri mengubah lagi saat permintaan berjalan, nilai baru itu tetap dirty. Mengembalikan
 * undefined bila tidak ada yang tersisa. Dipanggil dari hook autosave setelah simpan sukses.
 */
export function clearSaved(
  current: DirtyEntry | undefined,
  sent: readonly ScoreChange[],
  sentJudgeNote: string | undefined,
): DirtyEntry | undefined {
  if (!current) return undefined;
  const criteria: Record<string, DirtyCriterion> = {};
  for (const [id, d] of Object.entries(current.criteria)) {
    const change = sent.find((c) => c.criterionId === id);
    const next: DirtyCriterion = { ...d };
    if (change && d.score === change.score) delete next.score;
    if (change && change.note !== undefined && d.note === change.note)
      delete next.note;
    if (next.score !== undefined || next.note !== undefined)
      criteria[id] = next;
  }
  const judgeNote =
    sentJudgeNote !== undefined && current.judgeNote === sentJudgeNote
      ? undefined
      : current.judgeNote;
  if (Object.keys(criteria).length === 0 && judgeNote === undefined)
    return undefined;
  return { criteria, ...(judgeNote !== undefined ? { judgeNote } : {}) };
}
