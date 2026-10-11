import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import type {
  ApiCompetitionResults,
  ApiResultActions,
  ApiResultRow,
  ResultStatus,
} from "@/domains/results/types";
import {
  callerFor,
  forbidUnless,
  guard,
  hasPermission,
  iso,
} from "./mock-records";
import { confirmedRows } from "./mock-matches";
import { UNRESTRICTED, type MockCaller } from "./mock-rules";
import { findOrThrow, store } from "./mock-store";
import type { MockUser } from "./mock-types";

/**
 * Backend palsu untuk hasil akhir kompetisi Race (draf kontrak petpet-docs/_draft-results.md).
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
): ApiResultActions {
  return {
    verify:
      caller.managesEvent &&
      hasPermission(caller, PERMISSION.SCORING_VERIFY) &&
      VERIFIABLE_STATUSES.includes(competitionStatus) &&
      rowCount > 0 &&
      !verified,
  };
}

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

/** Hanya tipe RACE punya hasil; tipe lain 422 (keputusan D13). */
function requireRace(competitionTypeUuid: string) {
  const type = store.competitionTypes.find(
    (t) => t.uuid === competitionTypeUuid,
  );
  if (type?.code !== "RACE")
    throw new ApiError(
      422,
      "Results are not available for this competition type.",
    );
}

/** Satu baris klasemen: nama hewan, pemilik, dan bib diambil dari entry/pet/user yang sudah ada. */
function rowRecord(
  competitionUuid: string,
  row: StoredResult & { rank: number },
): ApiResultRow {
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
  };
}

/** Bentuk respons `data` untuk satu kompetisi. Dipakai GET dan POST verify. */
function resultsRecord(
  competitionUuid: string,
  caller: MockCaller,
): ApiCompetitionResults {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const ranked = rankResults(storedResultsOf(competitionUuid));
  const verification = resultStore.verifications[competitionUuid] ?? null;
  const verifier = verification
    ? store.users.find((u) => u.uuid === verification.verified_by_uuid)
    : undefined;
  return {
    competition_uuid: competitionUuid,
    verification_status: verification ? "VERIFIED" : "PENDING",
    verified_at: verification?.verified_at ?? null,
    verified_by_uuid: verification?.verified_by_uuid ?? null,
    verified_by_name: verifier ? fullName(verifier) : null,
    items: ranked.map((row) => rowRecord(competitionUuid, row)),
    actions: resultActions(
      competition.status,
      ranked.length,
      verification !== null,
      caller,
    ),
  };
}

/**
 * `GET /competitions/{uuid}/results`. Butuh login, terkait event, dan `scoring.view`.
 * Tipe selain Race 422. Kompetisi tanpa hasil mengembalikan `items: []`.
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
  requireRace(competition.competition_type_uuid);
  return resultsRecord(competitionUuid, caller);
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
  requireRace(competition.competition_type_uuid);
  const rows = storedResultsOf(competitionUuid);
  const verified = competitionUuid in resultStore.verifications;
  guard(
    resultActions(competition.status, rows.length, verified, caller).verify,
    resultActions(competition.status, rows.length, verified, UNRESTRICTED)
      .verify,
    "Only results of a started competition that are not yet verified can be verified.",
  );
  resultStore.verifications[competitionUuid] = {
    verified_at: iso(new Date()),
    verified_by_uuid: user.uuid,
  };
  return resultsRecord(competitionUuid, caller);
}
