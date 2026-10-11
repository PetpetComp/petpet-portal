import { z } from "zod";
import { toDatetimeLocal, toIsoString } from "@/domains/events/schema";
import type { PeriodPayload } from "@/types/api";
import { PERIOD_TYPES, optionalNumber } from "./schema";
import type {
  ApiPeriodUpdate,
  ApiRuleBody,
  CompetitionRule,
  RegistrationPeriod,
  ResultMode,
} from "./types";

/**
 * Logika murni tab Settings kompetisi (tanpa React): format cut-off, schema form,
 * dan perhitungan "apa yang berubah" untuk tombol Save changes.
 * Dipanggil dari `competition-settings.tsx` dan dites di `settings.test.ts`.
 */

/**
 * `ranking_rule` wajib diisi backend (CreateRuleRequest) tetapi daftar nilainya belum
 * didefinisikan. Dipakai HANYA bila kompetisi belum punya rule sama sekali; selain itu
 * nilai dari versi sebelumnya dibawa terus. Ganti saat backend menetapkan kosakatanya.
 */
export const DEFAULT_RANKING_RULE: Record<ResultMode, string[]> = {
  TIME: ["TIME_ASC"],
  POSITION: ["POSITION_ASC"],
  CHECKPOINT: ["CHECKPOINT_DESC", "TIME_ASC"],
  JUDGED_SCORE: ["SCORE_DESC"],
  COMBINED: ["POINTS_DESC"],
};

/**
 * Milidetik -> "mm:ss" seperti kolom Cut-off time di desain. Null atau 0 -> "".
 * Contoh: 90000 -> "01:30", 3725000 -> "62:05".
 */
export function formatCutoff(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * "mm:ss" -> milidetik. Kosong -> null (tanpa cut-off). Teks yang bukan "mm:ss" juga null,
 * jadi validasi form memakai `isValidCutoff` lebih dulu.
 */
export function parseCutoff(text: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(text.trim());
  if (!match) return null;
  const ms = (Number(match[1]) * 60 + Number(match[2])) * 1000;
  return ms > 0 ? ms : null;
}

/** True untuk kosong atau "mm:ss" yang valid dan lebih dari 0. */
export const isValidCutoff = (text: string) =>
  text.trim() === "" || parseCutoff(text) !== null;

/** Jumlah bulat tidak wajib: kosong -> undefined, selain itu minimal `min`. */
const optionalInt = (min: number) =>
  z.preprocess(
    (v) => (v === "" || v == null || Number.isNaN(v) ? undefined : Number(v)),
    z.number().int().min(min).optional(),
  );

/** Satu baris channel di form. `periodId` kosong = baris baru yang belum disimpan. */
const settingsPeriod = z
  .object({
    periodId: z.string(),
    type: z.enum(PERIOD_TYPES),
    /** Channel yang sudah ditutup (status CLOSED) tampil terkunci. */
    closed: z.boolean(),
    price: z.coerce.number().min(0, "Price can't be negative"),
    quota: optionalNumber,
    startAt: z.string().min(1, "Required"),
    endAt: z.string().min(1, "Required"),
  })
  .superRefine((p, ctx) => {
    if (p.startAt && p.endAt && p.endAt <= p.startAt)
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Must be after the start",
      });
  });

export const settingsSchema = z.object({
  laneTotal: optionalInt(1),
  checkpointTotal: optionalInt(0),
  cutoff: z.string().refine(isValidCutoff, "Use mm:ss, for example 01:30"),
  periods: z.array(settingsPeriod),
});

export type SettingsValues = z.input<typeof settingsSchema>;
export type Settings = z.output<typeof settingsSchema>;
export type SettingsPeriodValues = SettingsValues["periods"][number];

/** Urutan baris channel: Early bird, Online, On the spot. */
const periodOrder = (a: { type: string }, b: { type: string }) =>
  PERIOD_TYPES.indexOf(a.type as (typeof PERIOD_TYPES)[number]) -
  PERIOD_TYPES.indexOf(b.type as (typeof PERIOD_TYPES)[number]);

/**
 * Rule aktif + daftar channel dari server -> nilai awal form.
 * Dipanggil saat tab Settings selesai memuat dan setiap kali data server berubah.
 */
export function settingsValues(
  rule: CompetitionRule | null,
  periods: RegistrationPeriod[],
): SettingsValues {
  return {
    laneTotal: rule?.laneTotal ?? "",
    checkpointTotal: rule?.checkpointTotal ?? "",
    cutoff: formatCutoff(rule?.timeLimitMs ?? null),
    periods: [...periods].sort(periodOrder).map((p) => ({
      periodId: p.id,
      type: p.type,
      closed: p.status === "CLOSED",
      price: p.price,
      quota: p.quota ?? "",
      startAt: toDatetimeLocal(p.startAt),
      endAt: toDatetimeLocal(p.endAt),
    })),
  };
}

/** Hasil `settingsChanges`: apa saja yang harus dikirim ke server. Kosong semua = tidak ada perubahan. */
export type SettingsChanges = {
  /** Body `POST /competitions/{uuid}/rules` (versi baru), null bila rule tidak berubah. */
  rule: ApiRuleBody | null;
  /** `PATCH /registration-periods/{id}` per channel yang berubah. */
  periodUpdates: {
    id: string;
    type: (typeof PERIOD_TYPES)[number];
    body: ApiPeriodUpdate;
  }[];
  /** `POST /competitions/{uuid}/registration-periods` per channel baru. */
  periodCreates: PeriodPayload[];
};

/** True bila tidak ada yang perlu disimpan. */
export const hasNoChanges = (c: SettingsChanges) =>
  c.rule === null &&
  c.periodUpdates.length === 0 &&
  c.periodCreates.length === 0;

/**
 * Membandingkan isi form dengan data server dan menyusun hanya yang berubah.
 *
 * Rule: bila lane, checkpoint, atau cut-off berbeda dari rule aktif dibuat VERSI BARU. Backend
 * mengisi field yang tidak dikirim dengan nilai bawaan (bukan mewarisi versi lama), jadi semua
 * field versi lama dibawa terus supaya hanya tiga field itu yang berubah. Tanpa rule dan
 * ketiganya kosong, tidak ada rule yang dibuat.
 *
 * Channel: baris lama yang berubah -> PATCH. Tanggal selalu dikirim berpasangan karena aturan
 * `after:registration_start_at` backend membandingkan dengan field yang ikut dikirim.
 * Baris baru (`periodId` kosong) -> POST. Baris yang sudah ditutup tidak pernah dikirim.
 */
export function settingsChanges(input: {
  values: Settings;
  rule: CompetitionRule | null;
  periods: RegistrationPeriod[];
  resultMode: ResultMode;
}): SettingsChanges {
  const { values, rule, periods, resultMode } = input;

  const lanes = values.laneTotal ?? null;
  const checkpoints = values.checkpointTotal ?? null;
  const cutoffMs = parseCutoff(values.cutoff);
  const ruleChanged =
    lanes !== (rule?.laneTotal ?? null) ||
    checkpoints !== (rule?.checkpointTotal ?? null) ||
    cutoffMs !== (rule?.timeLimitMs ?? null);

  const ruleBody: ApiRuleBody | null = ruleChanged
    ? {
        countdown_enabled: rule?.countdownEnabled,
        countdown_seconds: rule?.countdownSeconds,
        concurrent_participant_limit: rule?.concurrentParticipantLimit,
        attempt_limit: rule?.attemptLimit,
        qualifier_limit: rule?.qualifierLimit,
        best_result_method: rule?.bestResultMethod,
        tie_break_rule: rule?.tieBreakRule,
        timeout_result: rule?.timeoutResult,
        ranking_rule: rule?.rankingRule ?? DEFAULT_RANKING_RULE[resultMode],
        lane_total: lanes,
        checkpoint_total: checkpoints,
        time_limit_ms: cutoffMs,
      }
    : null;

  const periodUpdates: SettingsChanges["periodUpdates"] = [];
  const periodCreates: PeriodPayload[] = [];
  for (const row of values.periods) {
    if (row.closed) continue;
    if (row.periodId === "") {
      periodCreates.push({
        period_type: row.type,
        price: row.price,
        quota: row.quota,
        registration_start_at: toIsoString(row.startAt),
        registration_end_at: toIsoString(row.endAt),
      });
      continue;
    }
    const before = periods.find((p) => p.id === row.periodId);
    if (!before) continue;
    const body: ApiPeriodUpdate = {};
    if (row.price !== before.price) body.price = row.price;
    if ((row.quota ?? null) !== before.quota) body.quota = row.quota ?? null;
    if (
      row.startAt !== toDatetimeLocal(before.startAt) ||
      row.endAt !== toDatetimeLocal(before.endAt)
    ) {
      body.registration_start_at = toIsoString(row.startAt);
      body.registration_end_at = toIsoString(row.endAt);
    }
    if (Object.keys(body).length > 0)
      periodUpdates.push({ id: row.periodId, type: row.type, body });
  }

  return { rule: ruleBody, periodUpdates, periodCreates };
}

/** Tipe channel yang belum punya baris (backend menolak dua channel bertipe sama, 422). */
export function missingChannelTypes(
  rows: { type: string }[],
): (typeof PERIOD_TYPES)[number][] {
  return PERIOD_TYPES.filter((t) => !rows.some((r) => r.type === t));
}
