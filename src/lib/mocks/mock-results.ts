import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { combineJudges, rankContest } from "@/domains/results/contest";
import type {
  ApiCompetitionResults,
  ApiResultActions,
  ApiResultRow,
  ResultStatus,
  ResultVariant,
} from "@/domains/results/types";
import {
  callerFor,
  forbidUnless,
  guard,
  hasPermission,
  iso,
} from "./mock-records";
import { contestScores, isContestCompetition } from "./mock-judging";
import { confirmedRows } from "./mock-matches";
import { timeTrialStandings } from "./mock-timetrial";
import { UNRESTRICTED, type MockCaller } from "./mock-rules";
import { findOrThrow, store } from "./mock-store";
import type { MockCompetition, MockUser } from "./mock-types";

/**
 * Backend palsu untuk hasil akhir kompetisi (draf kontrak petpet-docs/_draft-results.md).
 * Tiga jenis klasemen (`variant`): RACE (match yang di-Confirm), TIME_TRIAL (waktu valid terbaik
 * dari antrean) dan CONTEST (rata-rata total juri dari scorecard LOCKED, aturan 1A di
 * `@/domains/results/contest`).
 * Backend asli belum punya endpoint ini; bentuknya diturunkan dari tabel `results`,
 * `timer_results`, dan `result_verifications`. Aturan (urutan peringkat, siapa boleh
 * verifikasi) hidup di sini, layar hanya membaca `rank` dan `actions`.
 */

/** Satu hasil mentah seperti tersimpan: belum ada `rank`, dihitung saat dibaca. */
type StoredResult = {
  pet_uuid: string;
  status: ResultStatus;
  /** Milidetik termasuk penalti. Null bila tidak finish. */
  finish_time_ms: number | null;
};

type StoredVerification = { verified_at: string; verified_by_uuid: string };

const FUN_RUN_UUID = "comp-puppy-fun-run";

/**
 * Seed: Puppy Fun Run (Race, COMPLETED). Sengaja tidak berurutan supaya aturan
 * peringkat benar-benar diuji. Hewan dan pemilik memakai data pets/users yang sudah ada.
 */
function seedResults(): Record<string, StoredResult[]> {
  const finished = (
    pet_uuid: string,
    finish_time_ms: number,
  ): StoredResult => ({
    pet_uuid,
    status: "FINISHED",
    finish_time_ms,
  });
  return {
    [FUN_RUN_UUID]: [
      finished("pet-cooper", 41003),
      finished("pet-rufus", 38412),
      { pet_uuid: "pet-pepper", status: "DNF", finish_time_ms: null },
      finished("pet-teddy", 44520),
      { pet_uuid: "pet-daisy", status: "DQ", finish_time_ms: null },
      finished("pet-waffle", 39087),
    ],
  };
}

export const resultStore: {
  results: Record<string, StoredResult[]>;
  verifications: Record<string, StoredVerification>;
} = { results: seedResults(), verifications: {} };

/** Mengembalikan data hasil ke seed. Dipanggil dari tes. */
export function resetResultStore() {
  resultStore.results = seedResults();
  resultStore.verifications = {};
}

/** Pelari yang selesai di atas yang DNF, lalu DQ, lalu DNS (urutan seperti papan hasil lomba). */
const STATUS_ORDER: Record<ResultStatus, number> = {
  FINISHED: 0,
  DNF: 1,
  DQ: 2,
  DNS: 3,
};

/**
 * Aturan peringkat Race: status dulu (FINISHED, DNF, DQ, DNS), lalu waktu tercepat.
 * Waktu sama tetap berurutan menurut urutan simpan (belum ada aturan tie-break).
 * Dipanggil dari `resultsRecord`.
 */
export function rankResults(rows: StoredResult[]): (StoredResult & {
  rank: number;
})[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.row.status] - STATUS_ORDER[b.row.status] ||
        (a.row.finish_time_ms ?? 0) - (b.row.finish_time_ms ?? 0) ||
        a.index - b.index,
    )
    .map(({ row }, position) => ({ ...row, rank: position + 1 }));
}

/**
 * Hasil mentah satu kompetisi. Bila ada minimal satu match yang sudah di-Confirm (Run Match,
 * kontrak 13 bagian 13), klasemen dibangun dari peserta match-match itu saja: SATU ronde GENERAL,
 * semua match digabung lalu diurut oleh `rankResults` (FINISHED menurut `completed_time_ms`
 * tercepat lintas match, lalu DNF, DQ, DNS). Waktu sama diputus oleh nomor match lalu posisi di
 * match-nya (urutan masukan). Peserta di match yang belum selesai belum masuk klasemen.
 * Tanpa match terkonfirmasi, data seed tetap berlaku. Dipanggil dari `resultsRecord` dan verify.
 */
function storedResultsOf(competitionUuid: string): StoredResult[] {
  const confirmed = confirmedRows(competitionUuid);
  if (confirmed === null) return resultStore.results[competitionUuid] ?? [];
  return confirmed.map((row) => ({
    pet_uuid: row.pet_uuid,
    status: row.status,
    finish_time_ms: row.finish_time_ms,
  }));
}

/** Kompetisi yang sudah (atau sedang) menghasilkan hasil boleh diverifikasi. */
const VERIFIABLE_STATUSES = ["ONGOING", "COMPLETED"];

/**
 * Flag `actions` hasil (kontrak results). `verify` benar bila pemanggil mengelola event dan
 * punya `scoring.verify`, kompetisi ONGOING/COMPLETED, ada hasil, dan belum diverifikasi.
 * Dipanggil dari `resultsRecord` dan `verifyResultsRecord` (dengan UNRESTRICTED untuk 422 vs 403).
 */
export function resultActions(
  competitionStatus: string,
  rowCount: number,
  verified: boolean,
  caller: MockCaller,
  blocked = false,
): ApiResultActions {
  return {
    verify:
      !blocked &&
      caller.managesEvent &&
      hasPermission(caller, PERMISSION.SCORING_VERIFY) &&
      VERIFIABLE_STATUSES.includes(competitionStatus) &&
      rowCount > 0 &&
      !verified,
  };
}

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

/** Jenis klasemen menurut tipe kompetisi; tipe lain (mis. Checkpoint) 422 (keputusan D13). */
function variantOf(competition: MockCompetition): ResultVariant {
  const type = store.competitionTypes.find(
    (t) => t.uuid === competition.competition_type_uuid,
  );
  if (type?.code === "RACE") return "RACE";
  if (type?.code === "TIME_TRIAL") return "TIME_TRIAL";
  if (isContestCompetition(competition)) return "CONTEST";
  throw new ApiError(
    422,
    "Results are not available for this competition type.",
  );
}

/** Uuid hewan dari entry; entry yang masuk klasemen selalu punya hewan. */
function petOfEntry(entryUuid: string): string {
  const entry = findOrThrow(store.entries, entryUuid, "Entry");
  if (!entry.pet_uuid) throw new ApiError(422, "The entry has no pet.");
  return entry.pet_uuid;
}

/** Satu baris klasemen sebelum diberi nama: hasil mentah, peringkat, dan keterangan per jenis. */
type Standing = StoredResult & {
  rank: number;
  score?: number | null;
  judges?: number | null;
  attempts?: number | null;
};

/** Hasil kompetisi Time trial: waktu valid terbaik; urutan awal dari peringkat antrean (pemutus seri). */
function timeTrialRows(competition: MockCompetition): Standing[] {
  const standings = timeTrialStandings(competition).sort(
    (a, b) =>
      (a.bestRank ?? Number.MAX_SAFE_INTEGER) -
      (b.bestRank ?? Number.MAX_SAFE_INTEGER),
  );
  const attempts = new Map<string, number>();
  const stored = standings.map((row): StoredResult => {
    const petUuid = petOfEntry(row.entryUuid);
    attempts.set(petUuid, row.attemptsCounted);
    return {
      pet_uuid: petUuid,
      status: row.status,
      finish_time_ms: row.bestTimeMs,
    };
  });
  return rankResults(stored).map((row) => ({
    ...row,
    attempts: attempts.get(row.pet_uuid) ?? null,
  }));
}

/**
 * Hasil kompetisi Contest. Peserta berhak yang punya scorecard LOCKED diberi peringkat menurut
 * `rankContest` (seri berbagi peringkat); yang belum punya menjadi DNS ("Not scored") di bawah.
 * `openCards` > 0 (masih ada scorecard DRAFT/SUBMITTED) menahan verifikasi.
 */
function contestRows(competition: MockCompetition): {
  rows: Standing[];
  openCards: number;
} {
  const { criteria, entries } = contestScores(competition);
  const combined = entries.map((entry) => ({
    entry,
    ...combineJudges(criteria, entry.lockedCards),
  }));
  const ranks = rankContest(
    combined.map((c) => ({ entryId: c.entry.entryUuid, ...c })),
  );
  const scored = combined
    .filter((c) => c.score !== null)
    .sort(
      (a, b) =>
        (ranks.get(a.entry.entryUuid) as number) -
        (ranks.get(b.entry.entryUuid) as number),
    )
    .map((c): Standing => ({
      pet_uuid: petOfEntry(c.entry.entryUuid),
      status: "FINISHED",
      finish_time_ms: null,
      rank: ranks.get(c.entry.entryUuid) as number,
      score: c.score,
      judges: c.judges,
    }));
  const unscored = combined
    .filter((c) => c.score === null)
    .map((c, index): Standing => ({
      pet_uuid: petOfEntry(c.entry.entryUuid),
      status: "DNS",
      finish_time_ms: null,
      rank: scored.length + index + 1,
      score: null,
      judges: 0,
    }));
  return {
    rows: [...scored, ...unscored],
    openCards: entries.reduce((sum, e) => sum + e.openCards, 0),
  };
}

/** Satu baris klasemen: nama hewan, pemilik, dan bib diambil dari entry/pet/user yang sudah ada. */
function rowRecord(competitionUuid: string, row: Standing): ApiResultRow {
  const pet = findOrThrow(store.pets, row.pet_uuid, "Pet");
  const owner = findOrThrow(store.users, pet.owner_uuid, "User");
  const entry = store.entries.find(
    (e) => e.competition_uuid === competitionUuid && e.pet_uuid === pet.uuid,
  );
  return {
    // MOCK ONLY: seed memuat lebih banyak peserta daripada entry yang ada, jadi uuid dibuat.
    entry_uuid: entry?.uuid ?? `entry-${competitionUuid}-${pet.uuid}`,
    rank: row.rank,
    pet_name: pet.name,
    owner_name: fullName(owner),
    bib_number: entry?.bib_number ?? null,
    finish_time_ms: row.status === "FINISHED" ? row.finish_time_ms : null,
    status: row.status,
    score: row.score ?? null,
    judges_scored: row.judges ?? null,
    attempts_used: row.attempts ?? null,
  };
}

/** Baris klasemen, jenisnya, dan apakah ada hal yang menahan verifikasi, menurut jenis kompetisi. */
function standingsOf(competition: MockCompetition): {
  variant: ResultVariant;
  rows: Standing[];
  /** Jumlah baris yang benar-benar punya hasil (Contest: tanpa yang "Not scored"). */
  count: number;
  blocked: boolean;
} {
  const variant = variantOf(competition);
  if (variant === "TIME_TRIAL") {
    const rows = timeTrialRows(competition);
    return { variant, rows, count: rows.length, blocked: false };
  }
  if (variant === "CONTEST") {
    const { rows, openCards } = contestRows(competition);
    return {
      variant,
      rows,
      count: rows.filter((row) => row.status === "FINISHED").length,
      blocked: openCards > 0,
    };
  }
  const rows = rankResults(storedResultsOf(competition.uuid));
  return { variant, rows, count: rows.length, blocked: false };
}

/** Bentuk respons `data` untuk satu kompetisi. Dipakai GET dan POST verify. */
function resultsRecord(
  competition: MockCompetition,
  caller: MockCaller,
): ApiCompetitionResults {
  const competitionUuid = competition.uuid;
  const { variant, rows, count, blocked } = standingsOf(competition);
  const verification = resultStore.verifications[competitionUuid] ?? null;
  const verifier = verification
    ? store.users.find((u) => u.uuid === verification.verified_by_uuid)
    : undefined;
  return {
    competition_uuid: competitionUuid,
    variant,
    verification_status: verification ? "VERIFIED" : "PENDING",
    verified_at: verification?.verified_at ?? null,
    verified_by_uuid: verification?.verified_by_uuid ?? null,
    verified_by_name: verifier ? fullName(verifier) : null,
    items: rows.map((row) => rowRecord(competitionUuid, row)),
    actions: resultActions(
      competition.status,
      count,
      verification !== null,
      caller,
      blocked,
    ),
  };
}

/**
 * `GET /competitions/{uuid}/results`. Butuh login, terkait event, dan `scoring.view`.
 * Tipe selain Race, Time trial, dan Contest 422. Kompetisi tanpa hasil mengembalikan `items: []`.
 */
export function getResultsRecord(
  user: MockUser,
  competitionUuid: string,
): ApiCompetitionResults {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(
    caller.relatedToEvent && hasPermission(caller, PERMISSION.SCORING_VIEW),
  );
  return resultsRecord(competition, caller);
}

/**
 * `POST /competitions/{uuid}/results/verify`. 403 bila pemanggil tidak boleh mengelola
 * kompetisi, 422 bila data melarang (belum ada hasil, belum mulai, sudah diverifikasi).
 */
export function verifyResultsRecord(
  user: MockUser,
  competitionUuid: string,
): ApiCompetitionResults {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(
    caller.relatedToEvent && hasPermission(caller, PERMISSION.SCORING_VIEW),
  );
  const { count, blocked } = standingsOf(competition);
  if (blocked)
    throw new ApiError(
      422,
      "Results can be verified once every scorecard is locked.",
    );
  const verified = competitionUuid in resultStore.verifications;
  guard(
    resultActions(competition.status, count, verified, caller).verify,
    resultActions(competition.status, count, verified, UNRESTRICTED).verify,
    "Only results of a started competition that are not yet verified can be verified.",
  );
  resultStore.verifications[competitionUuid] = {
    verified_at: iso(new Date()),
    verified_by_uuid: user.uuid,
  };
  return resultsRecord(competition, caller);
}
