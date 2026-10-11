/**
 * Tipe domain Judging (Live Mode, kompetisi Contest). Kontrak ada di
 * petpet-docs/_draft-judging.md (bagian "15. Judging (Live Mode, Contest)").
 *
 * Istilah (untuk yang baru di domain ini):
 * - CONTEST: kompetisi yang dinilai juri (Beauty, Best in Show), bukan diukur waktu atau posisi.
 * - KRITERIA (`score_criteria`): aspek yang dinilai, mis. Appearance 40%, Behavior 30%. Tiap
 *   kriteria punya bobot (weight), rentang nilai (min_score sampai max_score), dan bendera
 *   `note_required` (juri wajib menulis catatan untuk kriteria itu).
 * - SCORECARD: lembar nilai SATU juri untuk SATU peserta (entry). Status DRAFT (sedang diisi,
 *   boleh diubah) -> SUBMITTED (dikirim, sudah lengkap) -> LOCKED (final, tidak bisa diubah).
 * - CRITERION SCORE: nilai satu kriteria di satu scorecard (+ catatan).
 * - STAFF ASSIGNMENT: penugasan juri. Hanya user dengan penugasan JUDGE atau HEAD_JUDGE di
 *   kompetisi itu yang boleh membuat dan mengisi scorecard.
 * - ANTREAN JURI: peserta yang berhak dinilai (disetujui + lunas + sudah check-in) menurut
 *   URUTAN CHECK-IN, tanpa undian. Juri boleh membuka peserta mana pun secara bebas.
 *
 * Tipe `Api*` sama persis dengan petpet-service (snake_case, `ScorecardData::toArray`,
 * `CriterionScoreData::toArray`, `ScoreCriterionData::toArray`) atau dengan kontrak bila endpoint-nya
 * baru (`/judging`). Tipe tanpa awalan `Api` (camelCase) adalah bentuk untuk layar.
 */
import {
  criterionFromApi,
  type ApiScoreCriterion,
  type ScoreCriterion,
} from "@/domains/competitions/types";
import { weightedTotal } from "./scoring";

/** Status scorecard (`ScorecardConstant`). */
export const SCORECARD_STATUSES = ["DRAFT", "SUBMITTED", "LOCKED"] as const;
export type ScorecardStatus = (typeof SCORECARD_STATUSES)[number];

/**
 * Status peserta di antrean juri untuk pemanggil: NOT_SCORED berarti pemanggil belum punya
 * scorecard untuk peserta itu; selebihnya sama dengan status scorecard.
 */
export const JUDGING_STATUSES = [
  "NOT_SCORED",
  "DRAFT",
  "SUBMITTED",
  "LOCKED",
] as const;
export type JudgingStatus = (typeof JUDGING_STATUSES)[number];

export const JUDGING_STATUS_LABEL: Record<JudgingStatus, string> = {
  NOT_SCORED: "Not scored",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  LOCKED: "Locked",
};

/** Peran penugasan yang boleh menilai (`StaffConstant`). */
export const JUDGE_ROLES = ["JUDGE", "HEAD_JUDGE"] as const;
export type JudgeRole = (typeof JUDGE_ROLES)[number];

// ---------------------------------------------------------------------------
// Bentuk API
// ---------------------------------------------------------------------------

/** Nilai satu kriteria persis seperti dikirim API (`CriterionScoreData::toArray`). */
export type ApiCriterionScore = {
  uuid: string;
  criterion_uuid: string;
  score: number;
  /** Backend: `score * weight` (3 desimal). Bukan skor tampilan layar. */
  weighted_score: number;
  note: string | null;
};

/** Satu scorecard persis seperti dikirim API (`ScorecardData::toArray`). */
export type ApiScorecard = {
  uuid: string;
  round_uuid: string;
  entry_uuid: string;
  staff_assignment_uuid: string;
  status: ScorecardStatus;
  /** Backend: jumlah `score * weight` (bukan 0 sampai 100); null sebelum ada nilai. */
  weighted_total: number | null;
  judge_note: string | null;
  submitted_at: string | null;
  locked_at: string | null;
  /** Jumlah mentah skor. */
  total_score: number;
  /** Jumlah `max_score` dari kriteria yang SUDAH dinilai (bukan semua kriteria). */
  max_total_score: number;
  criterion_scores: ApiCriterionScore[];
};

/** Nilai satu kriteria di ringkasan antrean (`/judging`). */
export type ApiJudgingScore = {
  criterion_uuid: string;
  score: number;
  note: string | null;
};

/** Apa yang boleh dilakukan pemanggil pada satu peserta (aturan dipegang backend/mock). */
export type ApiJudgingParticipantActions = {
  /** Mengubah nilai: pemanggil juri kompetisi ini dan scorecard belum ada atau masih DRAFT. */
  score: boolean;
  /** Submit dan lock: boleh `score` DAN semua kriteria sudah dinilai (catatan wajib terisi). */
  submit: boolean;
};

/** Satu peserta antrean juri (`GET /competitions/{uuid}/judging`). Baru: MOCK dulu. */
export type ApiJudgingParticipant = {
  entry_uuid: string;
  /** Urutan check-in 1..n (bukan nomor bib). */
  queue_number: number;
  bib_number: string | null;
  pet_name: string | null;
  pet_morph_name: string | null;
  owner_name: string;
  checked_in_at: string | null;
  /** Scorecard PEMANGGIL untuk peserta ini; null bila belum dibuat. */
  scorecard_uuid: string | null;
  status: JudgingStatus;
  scores: ApiJudgingScore[];
  judge_note: string | null;
  /** Skor tampilan 0 sampai 100 (rumus `weightedTotal`); null bila belum ada nilai. */
  total: number | null;
  submitted_at: string | null;
  locked_at: string | null;
  actions: ApiJudgingParticipantActions;
};

/** Penugasan juri milik pemanggil di kompetisi ini; null bila pemanggil bukan juri. */
export type ApiJudgingJudge = {
  staff_assignment_uuid: string;
  assignment_role: JudgeRole;
};

/** `data` dari `GET /competitions/{uuid}/judging`. */
export type ApiJudging = {
  competition_uuid: string;
  /** Ronde yang dinilai; dipakai untuk `POST /rounds/{uuid}/scorecards`. */
  round_uuid: string;
  /** Kriteria ACTIVE menurut `display_order`. */
  criteria: ApiScoreCriterion[];
  /** Menurut urutan check-in. */
  participants: ApiJudgingParticipant[];
  /** Peserta yang sudah SUBMITTED atau LOCKED oleh pemanggil. */
  scored_count: number;
  total_count: number;
  judge: ApiJudgingJudge | null;
  actions: {
    /** True bila pemanggil boleh menilai sekarang (juri, kompetisi SCHEDULED atau ONGOING, ada kriteria). */
    can_score: boolean;
  };
};

/** Body `POST /rounds/{uuid}/scorecards` (`CreateScorecardRequest`). */
export type ApiCreateScorecardBody = {
  entry_id: string;
  staff_assignment_id?: string;
};

/** Body `PUT /scorecards/{uuid}/criterion-scores` (`PutCriterionScoresRequest`). */
export type ApiPutCriterionScoresBody = {
  scores: { criterion_id: string; score: number; note?: string | null }[];
};

/** Body `PATCH /scorecards/{uuid}` (`UpdateScorecardRequest`). */
export type ApiUpdateScorecardBody = {
  judge_note?: string | null;
  status?: "SUBMITTED";
};

// ---------------------------------------------------------------------------
// Bentuk layar
// ---------------------------------------------------------------------------

/** Nilai satu kriteria untuk layar; `score` null berarti belum diisi. */
export type ScoreEntry = { score: number | null; note: string };

/** Nilai per id kriteria. Dipakai layar, `weightedTotal`, dan `validateScorecard`. */
export type ScoreMap = Record<string, ScoreEntry>;

export type JudgingParticipantActions = {
  score: boolean;
  submit: boolean;
};

export type JudgingParticipant = {
  entryId: string;
  queueNumber: number;
  bibNumber: string;
  petName: string;
  petMorphName: string;
  ownerName: string;
  checkedInAt: string | null;
  scorecardId: string | null;
  status: JudgingStatus;
  scores: ScoreMap;
  judgeNote: string;
  /** Skor tampilan 0 sampai 100, dihitung di klien (rumus `weightedTotal`); null tanpa nilai. */
  total: number | null;
  submittedAt: string | null;
  lockedAt: string | null;
  actions: JudgingParticipantActions;
};

export type Judging = {
  competitionId: string;
  roundId: string;
  criteria: ScoreCriterion[];
  participants: JudgingParticipant[];
  scoredCount: number;
  totalCount: number;
  judge: { staffAssignmentId: string; role: JudgeRole } | null;
  canScore: boolean;
};

/** Scorecard untuk layar (hasil POST, PUT, PATCH, lock). */
export type Scorecard = {
  id: string;
  roundId: string;
  entryId: string;
  staffAssignmentId: string;
  status: ScorecardStatus;
  judgeNote: string;
  submittedAt: string | null;
  lockedAt: string | null;
  scores: ScoreMap;
};

// ---------------------------------------------------------------------------
// Pemetaan API -> layar
// ---------------------------------------------------------------------------

/** Daftar nilai API -> peta per kriteria (catatan kosong jadi ""). Dipakai kedua mapper. */
function scoreMapOf(
  rows: { criterion_uuid: string; score: number; note: string | null }[],
): ScoreMap {
  const map: ScoreMap = {};
  for (const row of rows)
    map[row.criterion_uuid] = { score: row.score, note: row.note ?? "" };
  return map;
}

/** Mengubah satu scorecard API ke bentuk layar. Dipanggil dari api.ts. */
export function scorecardFromApi(row: ApiScorecard): Scorecard {
  return {
    id: row.uuid,
    roundId: row.round_uuid,
    entryId: row.entry_uuid,
    staffAssignmentId: row.staff_assignment_uuid,
    status: row.status,
    judgeNote: row.judge_note ?? "",
    submittedAt: row.submitted_at,
    lockedAt: row.locked_at,
    scores: scoreMapOf(row.criterion_scores),
  };
}

/**
 * Mengubah satu peserta antrean API ke bentuk layar. `total` SELALU dihitung ulang di klien dari
 * kriteria dan nilai (rumus `weightedTotal`), bukan dibaca dari API, supaya sama di mock dan di
 * backend asli (yang menghitung total dengan rumus lain, temuan D1).
 */
export function participantFromApi(
  row: ApiJudgingParticipant,
  criteria: readonly ScoreCriterion[],
): JudgingParticipant {
  const scores = scoreMapOf(row.scores);
  return {
    entryId: row.entry_uuid,
    queueNumber: row.queue_number,
    bibNumber: row.bib_number ?? "",
    petName: row.pet_name ?? "Unnamed pet",
    petMorphName: row.pet_morph_name ?? "",
    ownerName: row.owner_name,
    checkedInAt: row.checked_in_at,
    scorecardId: row.scorecard_uuid,
    status: row.status,
    scores,
    judgeNote: row.judge_note ?? "",
    total: row.scores.length > 0 ? weightedTotal(criteria, scores) : null,
    submittedAt: row.submitted_at,
    lockedAt: row.locked_at,
    actions: { score: row.actions.score, submit: row.actions.submit },
  };
}

/** Mengubah respons `/judging` ke bentuk layar. Dipanggil dari api.ts. */
export function fromApi(data: ApiJudging): Judging {
  const criteria = data.criteria
    .map(criterionFromApi)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    competitionId: data.competition_uuid,
    roundId: data.round_uuid,
    criteria,
    participants: data.participants
      .map((p) => participantFromApi(p, criteria))
      .sort((a, b) => a.queueNumber - b.queueNumber),
    scoredCount: data.scored_count,
    totalCount: data.total_count,
    judge: data.judge
      ? {
          staffAssignmentId: data.judge.staff_assignment_uuid,
          role: data.judge.assignment_role,
        }
      : null,
    canScore: data.actions.can_score,
  };
}
