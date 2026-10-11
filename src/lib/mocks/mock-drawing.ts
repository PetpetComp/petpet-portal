import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  buildDrawing,
  buildQueue,
  DEFAULT_LANES,
  queueLaneCount,
  swapInDrawing,
} from "@/domains/drawing/draw";
import { isDrawableType, isQueueType } from "@/domains/drawing/constants";
import type {
  ApiDrawing,
  ApiDrawingActions,
  ApiDrawingLane,
  ApiDrawingMatch,
  ApiDrawingParticipant,
  DrawingBlockedReason,
  MatchStatus,
} from "@/domains/drawing/types";
import { competitionRuleStore } from "./mock-competitions";
import { callerFor, forbidUnless, hasPermission, iso } from "./mock-records";
import { registerDrawnEntryLookup, type MockCaller } from "./mock-rules";
import { findOrThrow, store } from "./mock-store";
import type { MockCompetition, MockEntry, MockUser } from "./mock-types";

/**
 * Backend palsu untuk drawing kompetisi Race dan Time trial (draf kontrak petpet-docs/_draft-drawing.md,
 * bagian Time trial di kontrak 14).
 * Backend asli belum punya endpoint ini; di sana satu Lock ditulis dalam satu transaksi ke
 * `competition_rounds` (ronde 1, tipe GENERAL), `competition_heats` (satu per match), dan
 * `heat_entries` (satu per lane). Aturan (siapa boleh lock, syarat kompetisi, aturan swap)
 * hidup di sini; layar hanya membaca `actions` dan `lock_blocked_reason`.
 *
 * TIME_TRIAL memakai kontrak yang sama sebagai SATU antrean berurutan: drawing berisi tepat satu
 * match yang lane-nya adalah posisi antrean 1..N (`lanes` = N, jumlah peserta yang berhak). Di
 * backend asli ini ditulis sebagai ronde 1 (GENERAL) + `round_entries` (`queue_number`,
 * `queue_position`, `drawing_order`), tanpa heat; uuid match di respons = uuid ronde itu.
 * Aturan lain (eligibility, Lock, Swap, invalidasi saat registrasi dibuka lagi) sama dengan Race.
 */

/** Satu match tersimpan. Indeks `entry_uuids` + 1 = nomor lane (`heat_entries.lane_number`). */
export type StoredMatch = {
  uuid: string;
  match_number: number;
  status: MatchStatus;
  entry_uuids: string[];
};

/** Satu drawing terkunci (= satu ronde dengan `drawing_confirmed_at` terisi). */
export type StoredDrawing = {
  locked_at: string;
  locked_by_uuid: string;
  matches: StoredMatch[];
};

/** Benih tetap untuk seed supaya susunan awal sama di setiap reload. */
const SEED_SHUFFLE = 20261012;
const SEED_COMPETITION_UUID = "comp-glider-sprint-heats";
/** Time trial yang sudah di-lock dan sudah berjalan (attempt-nya di-seed mock-timetrial.ts). */
export const SEED_TIME_TRIAL_UUID = "comp-glider-speed-trial";

/**
 * Seed: Glider Sprint Heats (Race, SCHEDULED, registrasi tutup) sudah di-lock. Dengan 11 peserta
 * dan 5 lane hasilnya 4+4+3. Glider Derby sengaja tidak punya drawing supaya Shuffle dan Lock
 * bisa dicoba. Dipanggil saat modul dimuat dan dari `resetDrawingStore`.
 */
function seedDrawings(): Record<string, StoredDrawing> {
  const entryIds = eligibleEntries(SEED_COMPETITION_UUID).map((e) => e.uuid);
  const matches = buildDrawing(
    entryIds,
    laneLimit(SEED_COMPETITION_UUID),
    SEED_SHUFFLE,
  );
  // Time trial: satu antrean, matchnya sudah IN_PROGRESS karena attempt pertama sudah jalan.
  const queue = [seedTimeTrialOrder()];
  return {
    [SEED_COMPETITION_UUID]: {
      locked_at: "2026-10-11T07:00:00+00:00",
      locked_by_uuid: "u-organizer",
      matches: matches.map((ids, index) =>
        storedMatch(SEED_COMPETITION_UUID, index + 1, ids),
      ),
    },
    [SEED_TIME_TRIAL_UUID]: {
      locked_at: "2026-10-11T08:00:00+00:00",
      locked_by_uuid: "u-organizer",
      matches: queue.map((ids, index) => ({
        ...storedMatch(SEED_TIME_TRIAL_UUID, index + 1, ids),
        status: "IN_PROGRESS" as const,
      })),
    },
  };
}

/**
 * Urutan antrean seed Time trial yang sudah di-lock (entry uuid, posisi 1..N). Acak berbenih
 * tetap, jadi sama di setiap reload. Dipakai seed drawing di sini dan seed attempt di
 * mock-timetrial.ts supaya keduanya merujuk peserta yang sama.
 */
export function seedTimeTrialOrder(): string[] {
  return (
    buildQueue(
      eligibleEntries(SEED_TIME_TRIAL_UUID).map((e) => e.uuid),
      SEED_SHUFFLE,
    )[0] ?? []
  );
}

export const drawingStore: { drawings: Record<string, StoredDrawing> } = {
  drawings: {},
};

/**
 * Pendengar perubahan drawing. Modul Run Match (mock-matches.ts) mendaftar di sini supaya sesi,
 * finish, dan penalti match ikut dibuang saat drawing dihapus (`null` = semua, saat reset).
 * Dipanggil SEBELUM data drawing dihapus supaya pendengar masih bisa membaca heat-nya.
 */
export const drawingChangeListeners: ((
  competitionUuid: string | null,
) => void)[] = [];

/** Mengembalikan data drawing ke seed. Dipanggil dari tes. */
export function resetDrawingStore() {
  drawingChangeListeners.forEach((listener) => listener(null));
  drawingStore.drawings = seedDrawings();
}

/**
 * Mencari satu match (= heat) menurut uuid-nya di semua drawing terkunci. Dipakai mock-matches.ts.
 * Mengembalikan null bila tidak ada.
 */
export function findStoredMatch(heatUuid: string): {
  competitionUuid: string;
  drawing: StoredDrawing;
  match: StoredMatch;
} | null {
  for (const [competitionUuid, drawing] of Object.entries(
    drawingStore.drawings,
  )) {
    const match = drawing.matches.find((m) => m.uuid === heatUuid);
    if (match) return { competitionUuid, drawing, match };
  }
  return null;
}

/** True bila entry berada di salah satu match drawing terkunci (keputusan 0A, lihat mock-rules.ts). */
export function isEntryInLockedDrawing(entryUuid: string): boolean {
  return Object.values(drawingStore.drawings).some((d) =>
    d.matches.some((m) => m.entry_uuids.includes(entryUuid)),
  );
}

registerDrawnEntryLookup(isEntryInLockedDrawing);

/**
 * Menghapus drawing terkunci satu kompetisi. Dipanggil dari route `reopen-registration`
 * (temuan D6): peserta bisa berubah lagi, jadi undian lama tidak berlaku.
 */
export function invalidateDrawing(competitionUuid: string) {
  drawingChangeListeners.forEach((listener) => listener(competitionUuid));
  delete drawingStore.drawings[competitionUuid];
}

/**
 * Uuid ronde 1 satu kompetisi di mock (juga dipakai Run Match dan Time trial). Untuk Time trial
 * uuid ini menjadi uuid "match" antrean (tidak ada heat).
 */
export const roundUuidOf = (competitionUuid: string) =>
  `round-${competitionUuid}-1`;

/** Kode tipe (`RACE`, `TIME_TRIAL`, ...) dari uuid tipe kompetisi; null bila tidak dikenal. */
function typeCodeOf(competitionTypeUuid: string): string | null {
  return (
    store.competitionTypes.find((t) => t.uuid === competitionTypeUuid)?.code ??
    null
  );
}

/** True bila kompetisi ini TIME_TRIAL (drawing berupa satu antrean). */
export function isQueueCompetition(competitionUuid: string): boolean {
  const competition = store.competitions.find(
    (c) => c.uuid === competitionUuid,
  );
  return competition
    ? isQueueType(typeCodeOf(competition.competition_type_uuid))
    : false;
}

/**
 * Match tersimpan baru. Uuid heat di mock dibuat dari nomor kompetisi dan match; untuk Time trial
 * uuid-nya adalah uuid ronde (satu antrean, tanpa heat).
 */
function storedMatch(
  competitionUuid: string,
  matchNumber: number,
  entryUuids: string[],
): StoredMatch {
  return {
    uuid: isQueueCompetition(competitionUuid)
      ? roundUuidOf(competitionUuid)
      : `heat-${competitionUuid.replace(/^comp-/, "")}-${matchNumber}`,
    match_number: matchNumber,
    status: "SCHEDULED",
    entry_uuids: entryUuids,
  };
}

/**
 * Jumlah lane per match dari rule aktif (yang `is_active`, kalau tidak ada versi tertinggi).
 * Bawaan 4 bila rule belum ada atau `lane_total` kosong. Dipanggil dari seed dan `drawingRecord`.
 * TIME_TRIAL: jumlah peserta yang berhak (minimal 1), karena semua peserta ada di satu antrean.
 */
export function laneLimit(competitionUuid: string): number {
  if (isQueueCompetition(competitionUuid))
    return queueLaneCount(eligibleEntries(competitionUuid).length);
  const rules = competitionRuleStore.rules.filter(
    (r) => r.competition_uuid === competitionUuid,
  );
  const current =
    rules.find((r) => r.is_active) ??
    rules.reduce<(typeof rules)[number] | null>(
      (best, r) => (!best || r.version > best.version ? r : best),
      null,
    );
  return current?.lane_total ?? DEFAULT_LANES;
}

/**
 * Peserta yang berhak diundi: entry masih REGISTERED, APPROVED, PAID, dan CHECKED_IN
 * (check-in sendiri sudah mensyaratkan lunas, kontrak 13 bagian 2). Urut menurut nomor bib.
 */
export function eligibleEntries(competitionUuid: string): MockEntry[] {
  return store.entries
    .filter(
      (e) =>
        e.competition_uuid === competitionUuid &&
        e.status === "REGISTERED" &&
        e.eligibility_status === "APPROVED" &&
        e.payment_status === "PAID" &&
        e.checkin_status === "CHECKED_IN",
    )
    .sort((a, b) =>
      (a.bib_number ?? "").localeCompare(b.bib_number ?? "", undefined, {
        numeric: true,
      }),
    );
}

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

/** Hanya tipe RACE dan TIME_TRIAL punya drawing; tipe lain 422. */
function requireDrawable(competitionTypeUuid: string) {
  if (!isDrawableType(typeCodeOf(competitionTypeUuid)))
    throw new ApiError(
      422,
      "Drawing is not available for this competition type.",
    );
}

/** Nama hewan, pemilik, dan bib satu entry diambil dari pets/users yang sudah ada. */
function participantRecord(entry: MockEntry): ApiDrawingParticipant {
  const pet = store.pets.find((p) => p.uuid === entry.pet_uuid);
  const owner = store.users.find((u) => u.uuid === entry.owner_uuid);
  return {
    entry_uuid: entry.uuid,
    pet_name: pet?.name ?? null,
    owner_name: owner ? fullName(owner) : "Unknown owner",
    bib_number: entry.bib_number,
  };
}

/** Hak mengubah drawing: mengelola event dan punya `competition.update`. */
const canChange = (caller: MockCaller) =>
  caller.managesEvent && hasPermission(caller, PERMISSION.COMPETITION_UPDATE);

/** Hak melihat drawing: terkait event dan punya `scoring.view` (sama dengan Results). */
const canView = (caller: MockCaller) =>
  caller.relatedToEvent && hasPermission(caller, PERMISSION.SCORING_VIEW);

/**
 * Alasan Lock ditolak oleh DATA (bukan oleh hak pemanggil). Urutan penting: yang pertama gagal
 * menjadi alasan. Dipanggil dari `drawingActions` dan `lockDrawingRecord`.
 */
export function lockBlockedReason(
  competition: Pick<MockCompetition, "status" | "registration_closed_at">,
  eligibleCount: number,
  locked: boolean,
): DrawingBlockedReason | null {
  if (locked) return "ALREADY_LOCKED";
  if (competition.status !== "SCHEDULED" && competition.status !== "ONGOING")
    return "COMPETITION_STATUS";
  if (competition.registration_closed_at === null) return "REGISTRATION_OPEN";
  if (eligibleCount === 0) return "NO_PARTICIPANTS";
  return null;
}

/** Pesan 422/409 yang terbaca untuk tiap alasan Lock ditolak. */
const BLOCKED_MESSAGE: Record<DrawingBlockedReason, string> = {
  ALREADY_LOCKED: "The drawing is already locked.",
  COMPETITION_STATUS: "Only an upcoming or ongoing competition can be drawn.",
  REGISTRATION_OPEN: "Close registration before locking the drawing.",
  NO_PARTICIPANTS: "There is no checked-in and paid participant to draw.",
};

/**
 * Flag `actions` drawing. `lock` benar bila pemanggil boleh mengubah dan tidak ada hambatan data.
 * `swap` benar bila pemanggil boleh mengubah, drawing terkunci, dan minimal dua peserta masih
 * berada di match yang belum mulai. Dipanggil dari `drawingRecord`.
 */
export function drawingActions(
  competition: Pick<MockCompetition, "status" | "registration_closed_at">,
  eligibleCount: number,
  drawing: StoredDrawing | undefined,
  caller: MockCaller,
): ApiDrawingActions {
  const changer = canChange(caller);
  const swappable = (drawing?.matches ?? [])
    .filter((m) => m.status === "SCHEDULED")
    .reduce((sum, m) => sum + m.entry_uuids.length, 0);
  return {
    lock:
      changer &&
      lockBlockedReason(competition, eligibleCount, drawing !== undefined) ===
        null,
    swap: changer && drawing !== undefined && swappable >= 2,
  };
}

/** Satu match tersimpan menjadi bentuk API, lengkap dengan nama dan bib tiap lane. */
function matchRecord(match: StoredMatch): ApiDrawingMatch {
  const lanes: ApiDrawingLane[] = match.entry_uuids.map((entryUuid, index) => ({
    ...participantRecord(findOrThrow(store.entries, entryUuid, "Entry")),
    lane_number: index + 1,
  }));
  return {
    uuid: match.uuid,
    match_number: match.match_number,
    status: match.status,
    lanes,
  };
}

/** Bentuk respons `data` untuk satu kompetisi. Dipakai GET, POST lock, dan POST swap. */
function drawingRecord(
  competition: MockCompetition,
  caller: MockCaller,
): ApiDrawing {
  const drawing = drawingStore.drawings[competition.uuid];
  const eligible = eligibleEntries(competition.uuid);
  const locker = drawing
    ? store.users.find((u) => u.uuid === drawing.locked_by_uuid)
    : undefined;
  return {
    competition_uuid: competition.uuid,
    status: drawing ? "LOCKED" : "NOT_DRAWN",
    lanes: laneLimit(competition.uuid),
    locked_at: drawing?.locked_at ?? null,
    locked_by_uuid: drawing?.locked_by_uuid ?? null,
    locked_by_name: locker ? fullName(locker) : null,
    participants: eligible.map(participantRecord),
    matches: (drawing?.matches ?? []).map(matchRecord),
    lock_blocked_reason: lockBlockedReason(
      competition,
      eligible.length,
      drawing !== undefined,
    ),
    actions: drawingActions(competition, eligible.length, drawing, caller),
  };
}

/** Melempar 422 dengan satu pesan untuk field `matches`, seperti validasi Laravel. */
function invalidMatches(message: string): never {
  throw new ApiError(422, message, { matches: [message] });
}

/**
 * Memeriksa body Lock dan mengubahnya menjadi susunan entry id per match (urut lane).
 * Aturan: `matches` array tidak kosong; tiap match punya 1..lanes lane bernomor 1..k tanpa lubang;
 * setiap `entry_uuid` berhak diundi; tidak ada yang dobel; SEMUA yang berhak harus ada.
 * `singleMatch` (Time trial): tepat SATU match, karena itu satu antrean.
 * Dipanggil dari `lockDrawingRecord`.
 */
function parseLockBody(
  body: Record<string, unknown> | undefined,
  lanes: number,
  eligibleIds: string[],
  singleMatch = false,
): string[][] {
  const matches = body?.matches;
  if (!Array.isArray(matches) || matches.length === 0)
    invalidMatches("The matches field is required.");
  if (singleMatch && (matches as unknown[]).length !== 1)
    invalidMatches(
      "A time trial has one running order: send exactly one match.",
    );
  const result: string[][] = [];
  const seen = new Set<string>();
  for (const match of matches as unknown[]) {
    const laneRows = (match as { lanes?: unknown } | null)?.lanes;
    if (!Array.isArray(laneRows) || laneRows.length === 0)
      invalidMatches("Every match needs at least one lane.");
    if (laneRows.length > lanes)
      invalidMatches(`A match can have at most ${lanes} lanes.`);
    const ordered: string[] = [];
    const sorted = [...(laneRows as Record<string, unknown>[])].sort(
      (a, b) => Number(a?.lane_number) - Number(b?.lane_number),
    );
    sorted.forEach((lane, index) => {
      if (Number(lane?.lane_number) !== index + 1)
        invalidMatches("Lane numbers must run 1, 2, 3 ... without gaps.");
      const entryUuid = lane?.entry_uuid;
      if (typeof entryUuid !== "string" || !eligibleIds.includes(entryUuid))
        invalidMatches(
          "Every entry must be a checked-in and paid participant of this competition.",
        );
      if (seen.has(entryUuid))
        invalidMatches("An entry can be drawn only once.");
      seen.add(entryUuid);
      ordered.push(entryUuid);
    });
    result.push(ordered);
  }
  if (seen.size !== eligibleIds.length)
    invalidMatches(
      "Every checked-in and paid participant must be part of the drawing.",
    );
  return result;
}

/**
 * `GET /competitions/{uuid}/drawing`. Butuh login, terkait event, dan `scoring.view`.
 * Tipe selain Race dan Time trial 422. Kompetisi tanpa drawing mengembalikan `status: NOT_DRAWN`, `matches: []`.
 */
export function getDrawingRecord(
  user: MockUser,
  competitionUuid: string,
): ApiDrawing {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(canView(caller));
  requireDrawable(competition.competition_type_uuid);
  return drawingRecord(competition, caller);
}

/**
 * `POST /competitions/{uuid}/drawing` (Lock). Urutan cek: 404, 403 (bukan pengelola), 422 (bukan
 * Race), 409 (sudah terkunci), 422 (status, registrasi masih buka, tidak ada peserta), lalu 422
 * untuk isi body. Sukses menyimpan seluruh drawing sekaligus; ronde tetap SCHEDULED.
 */
export function lockDrawingRecord(
  user: MockUser,
  competitionUuid: string,
  body: Record<string, unknown> | undefined,
): ApiDrawing {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(canChange(caller));
  requireDrawable(competition.competition_type_uuid);
  const eligible = eligibleEntries(competitionUuid);
  const reason = lockBlockedReason(
    competition,
    eligible.length,
    competitionUuid in drawingStore.drawings,
  );
  if (reason !== null)
    throw new ApiError(
      reason === "ALREADY_LOCKED" ? 409 : 422,
      BLOCKED_MESSAGE[reason],
    );
  const matches = parseLockBody(
    body,
    laneLimit(competitionUuid),
    eligible.map((e) => e.uuid),
    isQueueCompetition(competitionUuid),
  );
  drawingStore.drawings[competitionUuid] = {
    locked_at: iso(new Date()),
    locked_by_uuid: user.uuid,
    matches: matches.map((ids, index) =>
      storedMatch(competitionUuid, index + 1, ids),
    ),
  };
  return drawingRecord(competition, caller);
}

/**
 * `POST /competitions/{uuid}/drawing/swap`. Menukar match dan lane dua peserta. Urutan cek: 404,
 * 403, 422 (bukan Race atau Time trial, body salah, peserta tidak ada di drawing), 409 (belum di-lock, atau salah
 * satu match sudah mulai).
 */
export function swapDrawingRecord(
  user: MockUser,
  competitionUuid: string,
  body: Record<string, unknown> | undefined,
): ApiDrawing {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(canChange(caller));
  requireDrawable(competition.competition_type_uuid);
  const a = body?.entry_uuid_a;
  const b = body?.entry_uuid_b;
  if (typeof a !== "string" || typeof b !== "string")
    throw new ApiError(422, "entry_uuid_a and entry_uuid_b are required.");
  if (a === b) throw new ApiError(422, "Pick two different participants.");
  const drawing = drawingStore.drawings[competitionUuid];
  if (!drawing)
    throw new ApiError(409, "The drawing is not locked yet; shuffle freely.");
  const matchOf = (entryUuid: string) =>
    drawing.matches.find((m) => m.entry_uuids.includes(entryUuid));
  const matchA = matchOf(a);
  const matchB = matchOf(b);
  if (!matchA || !matchB)
    throw new ApiError(422, "Both participants must be part of the drawing.");
  if (matchA.status !== "SCHEDULED" || matchB.status !== "SCHEDULED")
    throw new ApiError(
      409,
      "A participant in a match that already started cannot be swapped.",
    );
  // Aturan tukar yang sama dengan pratinjau di layar (`swapInDrawing`).
  const swapped = swapInDrawing(
    drawing.matches.map((m) => m.entry_uuids),
    a,
    b,
  );
  drawing.matches.forEach((m, index) => (m.entry_uuids = swapped[index]));
  return drawingRecord(competition, caller);
}

resetDrawingStore();
