import type {
  Competition,
  CompetitionType,
  ResultMode,
} from "@/domains/competitions/types";

/**
 * Logika murni halaman Overview event (tanpa React): pengelompokan jenis lomba,
 * ringkasan teks kartu, lebar bar, dan checklist Setup.
 */

/** Jenis lomba di desain. Warna dan label selalu tampil bersama (DS-Foundations). */
export const COMPETITION_KINDS = [
  "race",
  "checkpoint",
  "time_trial",
  "contest",
] as const;
export type CompetitionKind = (typeof COMPETITION_KINDS)[number];

export const COMPETITION_KIND_LABEL: Record<CompetitionKind, string> = {
  race: "race",
  checkpoint: "checkpoint",
  time_trial: "time trial",
  contest: "contest",
};

/** Kelas Tailwind warna bar per jenis (token ada di globals.css). */
export const COMPETITION_KIND_BAR: Record<CompetitionKind, string> = {
  race: "bg-race",
  checkpoint: "bg-checkpoint",
  time_trial: "bg-time-trial",
  contest: "bg-contest",
};

/** `result_mode` master data -> jenis lomba di desain. */
export function kindOfResultMode(mode: ResultMode): CompetitionKind {
  switch (mode) {
    case "TIME":
      return "time_trial";
    case "CHECKPOINT":
      return "checkpoint";
    case "POSITION":
      return "race";
    case "JUDGED_SCORE":
    case "COMBINED":
      return "contest";
  }
}

/** Jenis lomba satu kompetisi. Tipe tidak dikenal dianggap "race" (jenis paling umum). */
export function kindOfCompetition(
  competition: Pick<Competition, "typeId">,
  types: CompetitionType[],
): CompetitionKind {
  const type = types.find((t) => t.id === competition.typeId);
  return type ? kindOfResultMode(type.resultMode) : "race";
}

/**
 * "5 race · 2 checkpoint · 1 time trial · 1 contest". Jenis yang jumlahnya 0 dilewati.
 * Tanda pemisah memakai titik tengah seperti desain.
 */
export function kindSummary(
  competitions: Pick<Competition, "typeId">[],
  types: CompetitionType[],
): string {
  const counts: Record<CompetitionKind, number> = {
    race: 0,
    checkpoint: 0,
    time_trial: 0,
    contest: 0,
  };
  for (const c of competitions) counts[kindOfCompetition(c, types)] += 1;
  return COMPETITION_KINDS.filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${COMPETITION_KIND_LABEL[k]}`)
    .join(" · ");
}

const LEVEL_LABEL: Record<string, string> = {
  PLATINUM: "platinum",
  GOLD: "gold",
  SILVER: "silver",
  BRONZE: "bronze",
  MEDIA_PARTNER: "media",
};
const LEVEL_ORDER = ["PLATINUM", "GOLD", "SILVER", "BRONZE", "MEDIA_PARTNER"];

/** "2 platinum · 2 gold · 2 media". Level yang tidak dikenal ditaruh di akhir dengan nama aslinya. */
export function sponsorSummary(byLevel: Record<string, number>): string {
  const known = LEVEL_ORDER.filter((l) => byLevel[l] > 0);
  const unknown = Object.keys(byLevel).filter(
    (l) => !LEVEL_ORDER.includes(l) && byLevel[l] > 0,
  );
  return [...known, ...unknown]
    .map((l) => `${byLevel[l]} ${LEVEL_LABEL[l] ?? l.toLowerCase()}`)
    .join(" · ");
}

/** Lebar bar 0-100 relatif terhadap nilai terbesar. Semua nol -> 0. */
export function barPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((value / max) * 100);
}

/** Satu baris checklist Setup. */
export type SetupStep = { label: string; done: boolean };

/** Teks jamak sederhana: plural(1, "competition") -> "1 competition". */
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * Checklist Setup di Overview. Hitungan yang gagal dimuat dikirim `null`
 * (contoh: akun tidak boleh melihat sponsor) dan dianggap belum selesai tanpa angka.
 */
export function setupSteps(input: {
  competitions: number | null;
  staff: number | null;
  sponsors: number | null;
  published: boolean;
}): SetupStep[] {
  const { competitions, staff, sponsors, published } = input;
  return [
    { label: "Event details", done: true },
    {
      label: competitions
        ? `${count(competitions, "competition")} added`
        : "Competitions added",
      done: (competitions ?? 0) > 0,
    },
    { label: "Committee invited", done: (staff ?? 0) > 0 },
    {
      label: sponsors
        ? `${count(sponsors, "sponsor")} linked`
        : "Sponsors linked",
      done: (sponsors ?? 0) > 0,
    },
    { label: "Event published", done: published },
  ];
}
