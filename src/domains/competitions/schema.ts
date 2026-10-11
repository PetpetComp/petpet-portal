import { z } from "zod";
import { toDatetimeLocal, toIsoString } from "@/domains/events/schema";
import type { Competition, ResultMode } from "./types";

export const PERIOD_TYPES = ["EARLY_BIRD", "ONLINE", "ON_SITE"] as const;
export const PERIOD_LABEL: Record<(typeof PERIOD_TYPES)[number], string> = {
  EARLY_BIRD: "Early bird",
  ONLINE: "Online",
  ON_SITE: "On the spot",
};

export const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null || Number.isNaN(v) ? undefined : Number(v)),
  z.number().int().min(1).optional(),
);

const period = z
  .object({
    type: z.enum(PERIOD_TYPES),
    enabled: z.boolean(),
    price: z.coerce.number().min(0, "Price can't be negative"),
    quota: optionalNumber,
    startAt: z.string(),
    endAt: z.string(),
  })
  .superRefine((p, ctx) => {
    if (!p.enabled) return;
    if (!p.startAt)
      ctx.addIssue({ code: "custom", path: ["startAt"], message: "Required" });
    if (!p.endAt)
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "Required" });
    if (p.startAt && p.endAt && p.endAt <= p.startAt)
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Must be after the start",
      });
  });

const criterion = z
  .object({
    name: z.string().trim().min(1, "Name the criterion"),
    min: z.coerce.number(),
    max: z.coerce.number(),
    // A zero weight would make the criterion count for nothing.
    weight: z.coerce.number().gt(0, "Must be above 0"),
    noteRequired: z.boolean(),
  })
  .refine((c) => c.max > c.min, {
    path: ["max"],
    message: "Must be above the minimum",
  });

export const newCompetitionSchema = z
  .object({
    name: z.string().trim().min(1, "Give the competition a name").max(200),
    typeId: z.string().min(1, "Choose a type"),
    resultMode: z.string(),
    speciesId: z.string(),
    arenaName: z.string().max(200),
    capacity: optionalNumber,
    startAt: z.string().min(1, "Required"),
    endAt: z.string().min(1, "Required"),
    periods: z.array(period),
    criteria: z.array(criterion),
  })
  .superRefine((v, ctx) => {
    if (v.startAt && v.endAt && v.endAt <= v.startAt)
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Must be after the start",
      });
    if (!v.periods.some((p) => p.enabled))
      ctx.addIssue({
        code: "custom",
        path: ["periods"],
        message: "Open at least one registration channel",
      });
    if (usesCriteria(v.resultMode as ResultMode)) {
      if (v.criteria.length === 0)
        ctx.addIssue({
          code: "custom",
          path: ["criteria"],
          message: "Add at least one criterion",
        });
      else if (!weightsAreComplete(v.criteria))
        ctx.addIssue({
          code: "custom",
          path: ["criteria"],
          message: `Weights must add up to 100 (now ${totalWeight(v.criteria)})`,
        });
    }
  });

export type NewCompetitionValues = z.input<typeof newCompetitionSchema>;
export type NewCompetition = z.output<typeof newCompetitionSchema>;

/** Only judged competitions are scored per criterion. */
export const usesCriteria = (mode: ResultMode | "") => mode === "JUDGED_SCORE";

export function totalWeight(criteria: { weight: number | string }[]): number {
  const sum = criteria.reduce((n, c) => n + (Number(c.weight) || 0), 0);
  return Math.round(sum * 100) / 100;
}

export const weightsAreComplete = (criteria: { weight: number | string }[]) =>
  Math.abs(totalWeight(criteria) - 100) < 0.005;

/** Split 100 into n weights with two decimals that still add up exactly: 33.33, 33.33, 33.34. */
export function equalWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((100 / n) * 100) / 100;
  const last = Math.round((100 - base * (n - 1)) * 100) / 100;
  return [...Array(n - 1).fill(base), last];
}

/** Backend needs a short unique code per criterion. */
export function criterionCode(name: string, index: number): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${slug || "CRITERION"}_${index + 1}`;
}

// ---------------------------------------------------------------------------
// Edit competition (halaman Edit, field dasar saja)
// ---------------------------------------------------------------------------

/**
 * Form Edit competition: hanya isi dasar yang boleh diubah lewat `PATCH /competitions/{uuid}`
 * (backend `UpdateRequest`). Tipe, hewan, channel, dan kriteria tidak ikut: backend tidak
 * menerimanya di endpoint ini. Tanggal memakai format `datetime-local`.
 */
export const editCompetitionSchema = z
  .object({
    name: z.string().trim().min(1, "Give the competition a name").max(200),
    description: z.string(),
    arenaName: z.string().max(200),
    capacity: optionalNumber,
    startAt: z.string().min(1, "Required"),
    endAt: z.string().min(1, "Required"),
  })
  .superRefine((v, ctx) => {
    if (v.startAt && v.endAt && v.endAt <= v.startAt)
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Must be after the start",
      });
  });

export type EditCompetitionValues = z.input<typeof editCompetitionSchema>;
export type EditCompetition = z.output<typeof editCompetitionSchema>;

/** Body `PATCH /competitions/{uuid}` (backend `UpdateRequest`). */
export type ApiCompetitionUpdate = {
  name: string;
  description: string | null;
  arena_name: string | null;
  capacity: number | null;
  scheduled_start_at: string;
  scheduled_end_at: string;
};

/**
 * Competition di layar -> nilai awal form Edit. Dipanggil saat halaman Edit selesai memuat.
 * Tanggal ISO diubah ke zona waktu browser (`datetime-local`).
 */
export function editValuesFromCompetition(
  competition: Competition,
): EditCompetitionValues {
  return {
    name: competition.name,
    description: competition.description,
    arenaName: competition.arenaName,
    capacity: competition.capacity ?? "",
    startAt: toDatetimeLocal(competition.startAt),
    endAt: toDatetimeLocal(competition.endAt),
  };
}

/**
 * Isi form -> body PATCH. Teks opsional kosong dikirim `null` supaya bisa dikosongkan,
 * tanggal dikirim ISO UTC (lihat `toIsoString`).
 */
export function editToApi(v: EditCompetition): ApiCompetitionUpdate {
  return {
    name: v.name,
    description: v.description.trim() || null,
    arena_name: v.arenaName.trim() || null,
    capacity: v.capacity ?? null,
    scheduled_start_at: toIsoString(v.startAt),
    scheduled_end_at: toIsoString(v.endAt),
  };
}
