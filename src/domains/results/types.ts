/**
 * Tipe domain Results (hasil akhir satu kompetisi). Kontrak ada di petpet-docs/_draft-results.md.
 * Backend belum punya endpoint ini: bentuknya diturunkan dari tabel `results`,
 * `result_verifications`, dan `timer_results` yang sudah ada di petpet-service.
 */

/** Status akhir satu peserta (diturunkan dari `attempts.status` + `timer_results`). */
export const RESULT_STATUSES = ["FINISHED", "DNF", "DQ", "DNS"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

/** Label di kolom waktu bila peserta tidak punya waktu finish. */
export const RESULT_STATUS_LABEL: Record<ResultStatus, string> = {
  FINISHED: "Finished",
  DNF: "DNF",
  DQ: "DQ",
  DNS: "DNS",
};

/**
 * Jenis klasemen: Race dan Time trial diurut menurut waktu, Contest menurut nilai juri
 * (rata-rata total 0-100 dari scorecard LOCKED). Dikirim API; layar memilih kolom nilai dari sini.
 */
export const RESULT_VARIANTS = ["RACE", "TIME_TRIAL", "CONTEST"] as const;
export type ResultVariant = (typeof RESULT_VARIANTS)[number];

/** Keadaan verifikasi hasil satu kompetisi. */
export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Satu baris klasemen persis seperti dikirim API. */
export type ApiResultRow = {
  entry_uuid: string;
  /** Urutan 1..n sudah final; diputuskan backend, jangan dihitung ulang di layar. */
  rank: number;
  pet_name: string | null;
  owner_name: string;
  bib_number: string | null;
  /** Milidetik, sudah termasuk penalti (`timer_results.final_duration_ms`). Null bila tidak finish. */
  finish_time_ms: number | null;
  status: ResultStatus;
  /** Contest: rata-rata total juri 0-100 (1 desimal). Null untuk Race dan Time trial. */
  score?: number | null;
  /** Contest: jumlah juri yang scorecard-nya LOCKED dan ikut dihitung. */
  judges_scored?: number | null;
  /** Time trial: jumlah attempt yang dihitung ke jatah peserta. */
  attempts_used?: number | null;
};

/** Apa yang boleh dilakukan pemanggil (aturan dipegang backend). */
export type ApiResultActions = { verify: boolean };

/** `data` dari `GET /competitions/{uuid}/results` dan `POST .../results/verify`. */
export type ApiCompetitionResults = {
  competition_uuid: string;
  variant: ResultVariant;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verified_by_uuid: string | null;
  verified_by_name: string | null;
  /** Seluruh klasemen, sudah terurut menurut `rank`. */
  items: ApiResultRow[];
  actions: ApiResultActions;
};

/** Bentuk untuk layar. */
export type ResultRow = {
  entryId: string;
  rank: number;
  petName: string;
  ownerName: string;
  bibNumber: string;
  finishTimeMs: number | null;
  status: ResultStatus;
  score: number | null;
  judgesScored: number | null;
  attemptsUsed: number | null;
};

export type CompetitionResults = {
  competitionId: string;
  variant: ResultVariant;
  verified: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
  rows: ResultRow[];
  actions: { verify: boolean };
};

/** Mengubah satu baris API ke bentuk layar. Dipanggil dari `fromApi`. */
export function rowFromApi(row: ApiResultRow): ResultRow {
  return {
    entryId: row.entry_uuid,
    rank: row.rank,
    petName: row.pet_name ?? "Unnamed pet",
    ownerName: row.owner_name,
    bibNumber: row.bib_number ?? "",
    finishTimeMs: row.finish_time_ms,
    status: row.status,
    score: row.score ?? null,
    judgesScored: row.judges_scored ?? null,
    attemptsUsed: row.attempts_used ?? null,
  };
}

/** Mengubah respons API ke bentuk layar. Dipanggil dari api.ts; baris diurutkan menurut rank. */
export function fromApi(data: ApiCompetitionResults): CompetitionResults {
  return {
    competitionId: data.competition_uuid,
    variant: data.variant,
    verified: data.verification_status === "VERIFIED",
    verifiedAt: data.verified_at,
    verifiedByName: data.verified_by_name,
    rows: data.items.map(rowFromApi).sort((a, b) => a.rank - b.rank),
    actions: { verify: data.actions.verify },
  };
}
