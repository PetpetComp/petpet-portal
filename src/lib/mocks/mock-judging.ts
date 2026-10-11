import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { JUDGING_TYPE_CODES } from "@/domains/judging/constants";
import { queueProgress } from "@/domains/judging/queue";
import {
  validateScorecard,
  weightedTotal,
  type CriterionRule,
} from "@/domains/judging/scoring";
import {
  JUDGE_ROLES,
  type ApiCriterionScore,
  type ApiJudging,
  type ApiJudgingJudge,
  type ApiJudgingParticipant,
  type ApiScorecard,
  type JudgeRole,
  type JudgingStatus,
  type ScoreMap,
  type ScorecardStatus,
} from "@/domains/judging/types";
import { criterionRecord } from "./mock-competitions";
import { eligibleEntries, roundUuidOf } from "./mock-drawing";
import {
  hasStaffAccess,
  invalid,
  notFound,
  participantInfo,
} from "./mock-matches";
import { callerFor, forbidUnless, hasPermission, iso } from "./mock-records";
import { staffStore, type MockStaffAssignment } from "./mock-staff";
import { store } from "./mock-store";
import type {
  MockCompetition,
  MockEntry,
  MockScoreCriterion,
  MockUser,
} from "./mock-types";

/**
 * Backend palsu untuk Judging Contest (kontrak petpet-docs/_draft-judging.md, bagian 15).
 * Route scorecard sudah ada di petpet-service (routes/api/scorecards.php) dan bentuk responsnya
 * SAMA PERSIS dengan `ScorecardData` dan `CriterionScoreData`. Yang baru (mock dulu):
 * `GET /competitions/{uuid}/judging` (kriteria + antrean urutan check-in + scorecard pemanggil).
 *
 * Konsep singkat: pada kompetisi Contest tiap JURI menilai tiap PESERTA pada KRITERIA kompetisi.
 * Satu lembar nilai (scorecard) = satu juri + satu peserta: DRAFT -> SUBMITTED -> LOCKED.
 *
 * Aturan akses (lebih ketat dari backend, celah ada di dokumen):
 * - Menulis (buat, isi, submit, lock): hanya user dengan penugasan AKTIF JUDGE atau HEAD_JUDGE di
 *   kompetisi itu (atau tim event), dan hanya scorecard MILIKNYA. Manajer event/organizer: 403.
 * - Membaca: juri (milik sendiri; HEAD_JUDGE semua), Competition PIC, Event manager, admin
 *   organisasi, super admin, atau terkait event dengan `scoring.view`.
 * Ronde yang dinilai dibuat malas: `round-<kompetisi>-1` (tanpa data tersimpan; selalu ada untuk
 * kompetisi Contest). Hasil gabungan beberapa juri sengaja TIDAK dibahas (temuan D13).
 *
 * Kode status: 401 tanpa login, 403 bukan hak pemanggil, 404 tidak ada, 422 isi request atau aturan
 * yang SUDAH ada di backend (pesannya disalin), 409 scorecard sudah tidak DRAFT (backend asli
 * memakai 422).
 */

/** Satu nilai kriteria tersimpan (`criterion_scores`). */
type StoredScore = {
  uuid: string;
  criterion_uuid: string;
  score: number;
  note: string | null;
};

/** Scorecard tersimpan. Juri disimpan sebagai user supaya tahan terhadap reset data staf. */
type StoredScorecard = {
  uuid: string;
  competition_uuid: string;
  entry_uuid: string;
  judge_user_uuid: string;
  status: ScorecardStatus;
  judge_note: string | null;
  submitted_at: string | null;
  locked_at: string | null;
  scores: StoredScore[];
};

export const judgingStore: { scorecards: StoredScorecard[] } = {
  scorecards: [],
};

let scorecardCounter = 0;
const nextScorecardUuid = () => `sc-${++scorecardCounter}`;

// ---------------------------------------------------------------------------
// Seed dan reset
// ---------------------------------------------------------------------------

const SEED_COMPETITION_UUID = "comp-beauty-class-open";
const SEED_JUDGE_USER_UUID = "u-competitor-5"; // farhan.hidayat@petpet.dev
/** Juri kedua pada seed, supaya hasil gabungan beberapa juri bisa dilihat di Results. */
const SEED_SECOND_JUDGE_USER_UUID = "u-competitor-4";

/** Membuat satu scorecard seed lengkap. */
function seedCard(
  entryUuid: string,
  status: ScorecardStatus,
  scoreRows: [number, string | null][],
  judgeNote: string | null,
  judgeUserUuid: string = SEED_JUDGE_USER_UUID,
): StoredScorecard {
  const uuid = nextScorecardUuid();
  const criteria = criteriaOf(SEED_COMPETITION_UUID);
  const scores: StoredScore[] = [];
  scoreRows.forEach(([score, note], index) => {
    const criterion = criteria[index];
    if (criterion)
      scores.push({
        uuid: `cs-${uuid}-${index + 1}`,
        criterion_uuid: criterion.uuid,
        score,
        note,
      });
  });
  return {
    uuid,
    competition_uuid: SEED_COMPETITION_UUID,
    entry_uuid: entryUuid,
    judge_user_uuid: judgeUserUuid,
    status,
    judge_note: judgeNote,
    submitted_at: status === "DRAFT" ? null : "2026-10-10T09:30:00+00:00",
    locked_at: status === "LOCKED" ? "2026-10-10T09:31:00+00:00" : null,
    scores,
  };
}

/**
 * Seed: Beauty Class Open (ONGOING), juri Farhan. Peserta pertama dan kedua menurut urutan
 * check-in sudah LOCKED, ketiga DRAFT (dua dari tiga kriteria terisi, Presentation belum),
 * sisanya NOT_SCORED. Presentation wajib catatan (`note_required`). Dipanggil saat modul dimuat
 * dan dari reset.
 */
function seedJudgingState() {
  scorecardCounter = 0;
  judgingStore.scorecards = [];
  const [first, second, third] = queueEntries(SEED_COMPETITION_UUID);
  if (!first || !second || !third) return;
  judgingStore.scorecards.push(
    seedCard(
      first.uuid,
      "LOCKED",
      [
        [8, null],
        [7, null],
        [9, "Calm on stage and very well presented."],
      ],
      "Strong overall.",
    ),
    seedCard(
      second.uuid,
      "LOCKED",
      [
        [6, null],
        [8, null],
        [7, "Handler kept a good pace."],
      ],
      null,
    ),
    seedCard(
      third.uuid,
      "DRAFT",
      [
        [7, null],
        [6, null],
      ],
      null,
    ),
    // Juri kedua menilai dua peserta pertama (LOCKED): hasil gabungan dua juri tampil di Results.
    seedCard(
      first.uuid,
      "LOCKED",
      [
        [7, null],
        [8, null],
        [8, "Good energy."],
      ],
      null,
      SEED_SECOND_JUDGE_USER_UUID,
    ),
    seedCard(
      second.uuid,
      "LOCKED",
      [
        [8, null],
        [7, null],
        [7, "Steady and calm."],
      ],
      null,
      SEED_SECOND_JUDGE_USER_UUID,
    ),
  );
}

seedJudgingState();

/** Mengembalikan data Judging ke seed. Dipanggil dari tes. */
export function resetJudgingStore() {
  seedJudgingState();
}

// ---------------------------------------------------------------------------
// Data bantu
// ---------------------------------------------------------------------------

const READ_ROLES = [
  ...JUDGE_ROLES,
  "COMPETITION_PIC",
  "EVENT_MANAGER",
] as const;

/** Status kompetisi yang masih boleh dinilai (sama dengan Run Match). */
const SCORABLE_COMPETITION_STATUSES = ["SCHEDULED", "ONGOING"];

const typeCodeOf = (competition: MockCompetition): string | null =>
  store.competitionTypes.find(
    (t) => t.uuid === competition.competition_type_uuid,
  )?.code ?? null;

const isContest = (competition: MockCompetition) =>
  (JUDGING_TYPE_CODES as readonly string[]).includes(
    typeCodeOf(competition) ?? "",
  );

const findCompetition = (uuid: string): MockCompetition => {
  const found = store.competitions.find((c) => c.uuid === uuid);
  if (!found) throw notFound("Competition");
  return found;
};

/** Kompetisi dari uuid ronde mock (`round-<kompetisi>-1`); 404 bila bukan ronde yang dikenal. */
function competitionOfRound(roundUuid: string): MockCompetition {
  const match = /^round-(.+)-1$/.exec(roundUuid);
  const competition = match
    ? store.competitions.find((c) => c.uuid === match[1])
    : undefined;
  if (!competition || !isContest(competition)) throw notFound("Round");
  return competition;
}

/** Kriteria ACTIVE kompetisi menurut `display_order`. */
function criteriaOf(competitionUuid: string): MockScoreCriterion[] {
  return store.scoreCriteria
    .filter(
      (c) => c.competition_uuid === competitionUuid && c.status === "ACTIVE",
    )
    .sort((a, b) => a.display_order - b.display_order);
}

/** Kriteria mock -> bentuk untuk fungsi murni domain. */
const ruleOf = (c: MockScoreCriterion): CriterionRule => ({
  id: c.uuid,
  name: c.name,
  weight: c.weight,
  min: c.min_score,
  max: c.max_score,
  noteRequired: c.note_required,
});

/**
 * Penugasan juri AKTIF milik user di kompetisi ini: penugasan kompetisi itu, atau penugasan tim
 * event (competition_uuid null) di event yang sama. Null bila bukan juri.
 */
function judgeAssignmentOf(
  user: MockUser,
  competition: MockCompetition,
): (MockStaffAssignment & { assignment_role: JudgeRole }) | null {
  const found = staffStore.assignments.find(
    (a) =>
      a.user_uuid === user.uuid &&
      a.status === "ACTIVE" &&
      (JUDGE_ROLES as readonly string[]).includes(a.assignment_role) &&
      a.event_uuid === competition.event_uuid &&
      (a.competition_uuid === null || a.competition_uuid === competition.uuid),
  );
  return found as (MockStaffAssignment & { assignment_role: JudgeRole }) | null;
}

/** Hak membaca: staf terkait (termasuk juri), admin organisasi, super admin, atau `scoring.view` di event. */
function canView(user: MockUser, competition: MockCompetition): boolean {
  const caller = callerFor(user, competition.event_uuid);
  return (
    (caller.relatedToEvent && hasPermission(caller, PERMISSION.SCORING_VIEW)) ||
    hasStaffAccess(user, competition, READ_ROLES)
  );
}

/** Hanya tipe Contest (BEAUTY, BEST_IN_SHOW) dinilai juri; tipe lain 422. */
function requireContest(competition: MockCompetition) {
  if (!isContest(competition))
    throw new ApiError(
      422,
      "Judging is not available for this competition type.",
    );
}

/** Menilai hanya selama kompetisi SCHEDULED atau ONGOING (422 bila tidak). */
function requireScorable(competition: MockCompetition) {
  if (!SCORABLE_COMPETITION_STATUSES.includes(competition.status))
    throw new ApiError(
      422,
      "Scoring is only possible while the competition is scheduled or ongoing.",
    );
}

/**
 * Peserta yang berhak dinilai menurut URUTAN CHECK-IN (waktu check-in, lalu nomor bib).
 * Berhak = REGISTERED, APPROVED, PAID, CHECKED_IN (`eligibleEntries`).
 */
function queueEntries(competitionUuid: string): MockEntry[] {
  return eligibleEntries(competitionUuid).sort((a, b) => {
    const byTime = (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? "");
    if (byTime !== 0) return byTime;
    return (a.bib_number ?? "").localeCompare(b.bib_number ?? "", undefined, {
      numeric: true,
    });
  });
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Uuid penugasan juri pemilik scorecard (yang aktif sekarang; cadangan bila sudah dicabut). */
function assignmentUuidOf(card: StoredScorecard): string {
  const competition = findCompetition(card.competition_uuid);
  const user = store.users.find((u) => u.uuid === card.judge_user_uuid);
  const assignment = user ? judgeAssignmentOf(user, competition) : null;
  return assignment?.uuid ?? `sa-${card.judge_user_uuid}`;
}

/** Nilai tersimpan -> peta per kriteria (dipakai fungsi murni domain). */
const scoreMapOf = (card: StoredScorecard): ScoreMap =>
  Object.fromEntries(
    card.scores.map((s) => [
      s.criterion_uuid,
      { score: s.score, note: s.note ?? "" },
    ]),
  );

/** Scorecard tersimpan -> `ScorecardData::toArray`. `weighted_total` memakai rumus backend (jumlah score * weight). */
function scorecardRecord(card: StoredScorecard): ApiScorecard {
  const criteria = criteriaOf(card.competition_uuid);
  const rows: ApiCriterionScore[] = [];
  let weightedSum = 0;
  let totalScore = 0;
  let maxTotal = 0;
  for (const criterion of criteria) {
    const stored = card.scores.find((s) => s.criterion_uuid === criterion.uuid);
    if (!stored) continue;
    const weighted = round3(stored.score * criterion.weight);
    weightedSum += weighted;
    totalScore += stored.score;
    maxTotal += criterion.max_score;
    rows.push({
      uuid: stored.uuid,
      criterion_uuid: criterion.uuid,
      score: stored.score,
      weighted_score: weighted,
      note: stored.note,
    });
  }
  return {
    uuid: card.uuid,
    round_uuid: roundUuidOf(card.competition_uuid),
    entry_uuid: card.entry_uuid,
    staff_assignment_uuid: assignmentUuidOf(card),
    status: card.status,
    weighted_total: rows.length > 0 ? round3(weightedSum) : null,
    judge_note: card.judge_note,
    submitted_at: card.submitted_at,
    locked_at: card.locked_at,
    total_score: totalScore,
    max_total_score: maxTotal,
    criterion_scores: rows,
  };
}

const cardOf = (uuid: string): StoredScorecard => {
  const card = judgingStore.scorecards.find((c) => c.uuid === uuid);
  if (!card) throw notFound("Scorecard");
  return card;
};

const cardFor = (
  competitionUuid: string,
  entryUuid: string,
  userUuid: string,
): StoredScorecard | undefined =>
  judgingStore.scorecards.find(
    (c) =>
      c.competition_uuid === competitionUuid &&
      c.entry_uuid === entryUuid &&
      c.judge_user_uuid === userUuid,
  );

/**
 * Izin menulis pada scorecard yang sudah ada: pemanggil harus juri kompetisi itu DAN pemiliknya.
 * Urutan: 403 bukan juri, 403 milik juri lain. Dipanggil sebelum cek keadaan data.
 */
function requireOwnerJudge(user: MockUser, card: StoredScorecard) {
  const competition = findCompetition(card.competition_uuid);
  forbidUnless(judgeAssignmentOf(user, competition) !== null);
  forbidUnless(card.judge_user_uuid === user.uuid);
  return competition;
}

/** Scorecard hanya bisa diubah selagi DRAFT; SUBMITTED dan LOCKED -> 409. */
function requireDraft(card: StoredScorecard) {
  if (card.status !== "DRAFT")
    throw new ApiError(409, "This scorecard is no longer editable.");
}

/** Skor numerik dari angka atau string angka (aturan `numeric` Laravel); null bila bukan. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim()))
    return Number(value);
  return null;
}

// ---------------------------------------------------------------------------
// Data untuk Results (dipakai mock-results.ts)
// ---------------------------------------------------------------------------

/** Nilai satu peserta Contest: scorecard LOCKED yang dihitung dan jumlah scorecard yang belum LOCKED. */
export type ContestEntryScores = {
  entryUuid: string;
  lockedCards: { scores: ScoreMap }[];
  openCards: number;
};

/**
 * Bahan klasemen Contest: kriteria aktif dan, per peserta berhak (urutan check-in), scorecard LOCKED
 * serta jumlah scorecard yang masih DRAFT/SUBMITTED. Hasil verifikasi menunggu `openCards` semua 0.
 * Dipanggil dari `mock-results.ts`.
 */
export function contestScores(competition: MockCompetition): {
  criteria: CriterionRule[];
  entries: ContestEntryScores[];
} {
  const criteria = criteriaOf(competition.uuid).map(ruleOf);
  const entries = queueEntries(competition.uuid).map((entry) => {
    const cards = judgingStore.scorecards.filter(
      (c) =>
        c.competition_uuid === competition.uuid && c.entry_uuid === entry.uuid,
    );
    return {
      entryUuid: entry.uuid,
      lockedCards: cards
        .filter((c) => c.status === "LOCKED")
        .map((c) => ({ scores: scoreMapOf(c) })),
      openCards: cards.filter((c) => c.status !== "LOCKED").length,
    };
  });
  return { criteria, entries };
}

/** True bila kompetisi bertipe Contest (BEAUTY atau BEST_IN_SHOW). */
export const isContestCompetition = isContest;

// ---------------------------------------------------------------------------
// Route: antrean juri (mock)
// ---------------------------------------------------------------------------

/** Status antrean dari scorecard pemanggil (tidak ada -> NOT_SCORED). */
const judgingStatusOf = (card: StoredScorecard | undefined): JudgingStatus =>
  card ? card.status : "NOT_SCORED";

/**
 * `GET /competitions/{uuid}/judging`. Urutan cek: 404 kompetisi, 403 (bukan staf terkait), 422
 * (bukan Contest). Mengembalikan kriteria aktif, peserta menurut urutan check-in beserta
 * scorecard PEMANGGIL (manajer yang bukan juri melihat semua NOT_SCORED tanpa hak menilai),
 * `scored_count`/`total_count`, dan `actions`.
 *
 * Pemetaan ke backend asli: `round_uuid` = ronde kompetisi (dibuat saat pertama dibutuhkan),
 * peserta = entry yang disetujui, lunas, check-in; scorecard = scorecard dengan
 * `staff_assignment` pemanggil di ronde itu.
 */
export function getJudgingRecord(
  user: MockUser,
  competitionUuid: string,
): ApiJudging {
  const competition = findCompetition(competitionUuid);
  forbidUnless(canView(user, competition));
  requireContest(competition);

  const mockCriteria = criteriaOf(competition.uuid);
  const rules = mockCriteria.map(ruleOf);
  const assignment = judgeAssignmentOf(user, competition);
  const canScore =
    assignment !== null &&
    SCORABLE_COMPETITION_STATUSES.includes(competition.status) &&
    mockCriteria.length > 0;

  const participants: ApiJudgingParticipant[] = queueEntries(
    competition.uuid,
  ).map((entry, index) => {
    const card = cardFor(competition.uuid, entry.uuid, user.uuid);
    const scores = card ? scoreMapOf(card) : {};
    const editable = canScore && (!card || card.status === "DRAFT");
    return {
      entry_uuid: entry.uuid,
      queue_number: index + 1,
      ...participantInfo(entry.uuid),
      checked_in_at: entry.checked_in_at,
      scorecard_uuid: card?.uuid ?? null,
      status: judgingStatusOf(card),
      scores: (card?.scores ?? []).map((s) => ({
        criterion_uuid: s.criterion_uuid,
        score: s.score,
        note: s.note,
      })),
      judge_note: card?.judge_note ?? null,
      total:
        card && card.scores.length > 0 ? weightedTotal(rules, scores) : null,
      submitted_at: card?.submitted_at ?? null,
      locked_at: card?.locked_at ?? null,
      actions: {
        score: editable,
        submit: editable && validateScorecard(rules, scores).valid,
      },
    };
  });

  const judge: ApiJudgingJudge | null = assignment
    ? {
        staff_assignment_uuid: assignment.uuid,
        assignment_role: assignment.assignment_role,
      }
    : null;
  return {
    competition_uuid: competition.uuid,
    round_uuid: roundUuidOf(competition.uuid),
    criteria: mockCriteria.map(criterionRecord),
    participants,
    scored_count: queueProgress(participants).scored,
    total_count: participants.length,
    judge,
    actions: { can_score: canScore },
  };
}

// ---------------------------------------------------------------------------
// Route: scorecard (backend asli)
// ---------------------------------------------------------------------------

/**
 * `POST /rounds/{uuid}/scorecards` (`CreateScorecardRequest`). Urutan cek: 404 ronde, 403 (bukan
 * juri kompetisi ini), 422 (kompetisi tidak bisa dinilai, `entry_id` kosong, entry bukan milik
 * kompetisi atau belum berhak), 403 (`staff_assignment_id` milik juri lain). IDEMPOTEN (mock-first):
 * bila juri ini sudah punya scorecard untuk entry itu, scorecard tersebut dikembalikan
 * (backend asli: 422 "You already have a scorecard...").
 */
export function createScorecardRecord(
  user: MockUser,
  roundUuid: string,
  body: Record<string, unknown> | undefined,
): ApiScorecard {
  const competition = competitionOfRound(roundUuid);
  const assignment = judgeAssignmentOf(user, competition);
  forbidUnless(assignment !== null);
  requireScorable(competition);

  const entryUuid = body?.entry_id;
  if (typeof entryUuid !== "string" || entryUuid === "")
    invalid({ entry_id: ["The entry id field is required."] });
  const entry = store.entries.find((e) => e.uuid === entryUuid);
  if (!entry || entry.competition_uuid !== competition.uuid)
    throw new ApiError(
      422,
      "This entry does not belong to the round's competition.",
    );
  if (!queueEntries(competition.uuid).some((e) => e.uuid === entry.uuid))
    throw new ApiError(
      422,
      "Only approved, paid and checked-in participants can be scored.",
    );
  const requestedAssignment = body?.staff_assignment_id;
  forbidUnless(
    requestedAssignment === undefined ||
      requestedAssignment === assignment?.uuid,
  );

  const existing = cardFor(competition.uuid, entry.uuid, user.uuid);
  if (existing) return scorecardRecord(existing);
  const card: StoredScorecard = {
    uuid: nextScorecardUuid(),
    competition_uuid: competition.uuid,
    entry_uuid: entry.uuid,
    judge_user_uuid: user.uuid,
    status: "DRAFT",
    judge_note: null,
    submitted_at: null,
    locked_at: null,
    scores: [],
  };
  judgingStore.scorecards.push(card);
  return scorecardRecord(card);
}

/**
 * `GET /rounds/{uuid}/scorecards`. 404 ronde, 403 bukan pembaca. Juri hanya melihat scorecard
 * miliknya; HEAD_JUDGE, Competition PIC, manajer, dan admin melihat semuanya (backend asli
 * mengembalikan semua scorecard ronde ke juri mana pun).
 */
export function listRoundScorecardsRecord(
  user: MockUser,
  roundUuid: string,
): ApiScorecard[] {
  const competition = competitionOfRound(roundUuid);
  forbidUnless(canView(user, competition));
  const assignment = judgeAssignmentOf(user, competition);
  const seesAll =
    assignment === null || assignment.assignment_role === "HEAD_JUDGE";
  return judgingStore.scorecards
    .filter(
      (c) =>
        c.competition_uuid === competition.uuid &&
        (seesAll || c.judge_user_uuid === user.uuid),
    )
    .map(scorecardRecord);
}

/** `GET /scorecards/{uuid}`. 404, 403 (bukan pembaca, atau juri biasa membaca milik juri lain). */
export function getScorecardRecord(
  user: MockUser,
  scorecardUuid: string,
): ApiScorecard {
  const card = cardOf(scorecardUuid);
  const competition = findCompetition(card.competition_uuid);
  forbidUnless(canView(user, competition));
  const assignment = judgeAssignmentOf(user, competition);
  forbidUnless(
    assignment === null ||
      assignment.assignment_role === "HEAD_JUDGE" ||
      card.judge_user_uuid === user.uuid,
  );
  return scorecardRecord(card);
}

/**
 * `PUT /scorecards/{uuid}/criterion-scores` (`PutCriterionScoresRequest`): upsert per kriteria,
 * kriteria yang tidak ada di body tidak disentuh. Urutan cek: 404, 403 (bukan juri pemilik),
 * 409 (bukan DRAFT), 422 (kompetisi tidak bisa dinilai; `scores` kosong; kriteria bukan milik
 * kompetisi; skor di luar rentang). Semua baris divalidasi dulu, baru disimpan (atomik).
 * Catatan wajib TIDAK diperiksa di sini (autosave boleh menyimpan skor dulu); dicek saat Submit.
 * Backend asli memeriksanya di setiap PUT (celah di dokumen).
 */
export function putCriterionScoresRecord(
  user: MockUser,
  scorecardUuid: string,
  body: Record<string, unknown> | undefined,
): ApiScorecard {
  const card = cardOf(scorecardUuid);
  const competition = requireOwnerJudge(user, card);
  requireDraft(card);
  requireScorable(competition);

  const rows = body?.scores;
  if (!Array.isArray(rows) || rows.length === 0)
    invalid({ scores: ["The scores field is required."] });
  const criteria = criteriaOf(competition.uuid);
  const parsed: {
    criterion: MockScoreCriterion;
    score: number;
    note: string | null | undefined;
  }[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const criterion = criteria.find((c) => c.uuid === raw?.criterion_id);
    if (!criterion)
      throw new ApiError(
        422,
        `Criterion ${String(raw?.criterion_id)} does not belong to this competition or is not active.`,
      );
    const score = toNumber(raw.score);
    if (score === null)
      invalid({ "scores.score": ["The score field must be a number."] });
    if (score < criterion.min_score || score > criterion.max_score)
      throw new ApiError(
        422,
        `Score for criterion ${criterion.name} must be between ${criterion.min_score.toFixed(2)} and ${criterion.max_score.toFixed(2)}.`,
      );
    const note = raw.note;
    if (note !== undefined && note !== null && typeof note !== "string")
      invalid({ "scores.note": ["The note field must be a string."] });
    parsed.push({ criterion, score, note: note as string | null | undefined });
  }

  for (const { criterion, score, note } of parsed) {
    const existing = card.scores.find(
      (s) => s.criterion_uuid === criterion.uuid,
    );
    if (existing) {
      existing.score = score;
      if (note !== undefined) existing.note = note;
    } else {
      card.scores.push({
        uuid: `cs-${card.uuid}-${criterion.uuid}`,
        criterion_uuid: criterion.uuid,
        score,
        note: note ?? null,
      });
    }
  }
  return scorecardRecord(card);
}

/** Pesan 422 gabungan dari hasil `validateScorecard` (satu baris per kriteria bermasalah). */
function invalidScorecard(errors: Record<string, string>): never {
  invalid(
    Object.fromEntries(
      Object.entries(errors).map(([id, message]) => [
        `scores.${id}`,
        [message],
      ]),
    ),
  );
}

/**
 * `PATCH /scorecards/{uuid}` (`UpdateScorecardRequest`): `judge_note` dan/atau `status: SUBMITTED`.
 * Urutan cek: 404, 403, 409 (bukan DRAFT), 422 (`status` selain SUBMITTED; kompetisi tidak bisa
 * dinilai; Submit dengan kriteria belum terisi atau catatan wajib kosong). Submit dan catatan
 * disimpan bersama atau tidak sama sekali.
 */
export function updateScorecardRecord(
  user: MockUser,
  scorecardUuid: string,
  body: Record<string, unknown> | undefined,
): ApiScorecard {
  const card = cardOf(scorecardUuid);
  const competition = requireOwnerJudge(user, card);
  requireDraft(card);
  requireScorable(competition);

  const note = body?.judge_note;
  if (note !== undefined && note !== null && typeof note !== "string")
    invalid({ judge_note: ["The judge note field must be a string."] });
  const status = body?.status;
  if (status !== undefined && status !== "SUBMITTED")
    invalid({ status: ["The selected status is invalid."] });
  if (status === "SUBMITTED") {
    const check = validateScorecard(
      criteriaOf(competition.uuid).map(ruleOf),
      scoreMapOf(card),
    );
    if (!check.valid) invalidScorecard(check.errors);
  }

  if (note !== undefined) card.judge_note = note as string | null;
  if (status === "SUBMITTED") {
    card.status = "SUBMITTED";
    card.submitted_at = iso(new Date());
  }
  return scorecardRecord(card);
}

/**
 * `POST /scorecards/{uuid}/lock`. Urutan cek: 404, 403 (bukan juri pemilik; backend asli hanya
 * HEAD_JUDGE, celah di dokumen), 409 (sudah LOCKED), 422 (belum SUBMITTED; kriteria belum
 * lengkap atau catatan wajib kosong). Sukses: LOCKED, tidak bisa diubah lagi.
 */
export function lockScorecardRecord(
  user: MockUser,
  scorecardUuid: string,
): ApiScorecard {
  const card = cardOf(scorecardUuid);
  const competition = requireOwnerJudge(user, card);
  if (card.status === "LOCKED")
    throw new ApiError(409, "This scorecard is already locked.");
  requireScorable(competition);
  if (card.status !== "SUBMITTED")
    throw new ApiError(422, "Only a submitted scorecard can be locked.");
  const check = validateScorecard(
    criteriaOf(competition.uuid).map(ruleOf),
    scoreMapOf(card),
  );
  if (!check.valid) invalidScorecard(check.errors);
  card.status = "LOCKED";
  card.locked_at = iso(new Date());
  return scorecardRecord(card);
}
