/**
 * Data contoh untuk tes layar Judging dan shell (bentuk layar, bukan bentuk API).
 * Tiga kriteria: Appearance 40, Behavior 30, Presentation 30 (catatan wajib), rentang 0 sampai 10.
 */
import type { ScoreCriterion } from "@/domains/competitions/types";
import type {
  Judging,
  JudgingParticipant,
  JudgingStatus,
  ScoreMap,
} from "@/domains/judging/types";

function criterion(
  id: string,
  name: string,
  weight: number,
  order: number,
  noteRequired = false,
): ScoreCriterion {
  return {
    id,
    code: id.toUpperCase(),
    name,
    description: "",
    weight,
    min: 0,
    max: 10,
    noteRequired,
    displayOrder: order,
    active: true,
  };
}

export const CRITERIA: ScoreCriterion[] = [
  criterion("appearance", "Appearance", 40, 1),
  criterion("behavior", "Behavior", 30, 2),
  criterion("presentation", "Presentation", 30, 3, true),
];

/** Skor lengkap 8, 6, 9 (total 77) dengan catatan untuk Presentation. */
export const FULL_SCORES: ScoreMap = {
  appearance: { score: 8, note: "" },
  behavior: { score: 6, note: "" },
  presentation: { score: 9, note: "Great stage presence" },
};

/** Peserta n: Pet<n>, bib 00<n>, e<n>. NOT_SCORED tidak punya scorecard. */
export function participantFixture(
  n: number,
  status: JudgingStatus,
  scores: ScoreMap = {},
): JudgingParticipant {
  const editable = status === "NOT_SCORED" || status === "DRAFT";
  return {
    entryId: `e${n}`,
    queueNumber: n,
    bibNumber: `00${n}`,
    petName: `Pet${n}`,
    petMorphName: "Classic Grey",
    ownerName: `Owner${n}`,
    checkedInAt: null,
    scorecardId: status === "NOT_SCORED" ? null : `sc-${n}`,
    status,
    scores,
    judgeNote: "",
    total: null,
    submittedAt: null,
    lockedAt: null,
    actions: { score: editable, submit: false },
  };
}

/**
 * Antrean 4 peserta: Pet1 LOCKED, Pet2 DRAFT (Appearance 5), Pet3 dan Pet4 NOT_SCORED.
 * `over` menimpa field Judging (mis. `canScore: false`, `participants`).
 */
export function judgingFixture(over: Partial<Judging> = {}): Judging {
  return {
    competitionId: "c1",
    roundId: "round-c1-1",
    criteria: CRITERIA,
    participants: [
      participantFixture(1, "LOCKED", FULL_SCORES),
      participantFixture(2, "DRAFT", { appearance: { score: 5, note: "" } }),
      participantFixture(3, "NOT_SCORED"),
      participantFixture(4, "NOT_SCORED"),
    ],
    scoredCount: 1,
    totalCount: 4,
    judge: { staffAssignmentId: "sa-1", role: "JUDGE" },
    canScore: true,
    ...over,
  };
}
