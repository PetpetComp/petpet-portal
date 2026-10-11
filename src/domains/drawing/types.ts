/**
 * Tipe domain Drawing (undian peserta Race ke match/heat). Kontrak ada di
 * petpet-docs/_draft-drawing.md (bagian "11. Drawing (Live Mode)").
 * Backend belum punya endpoint ini: bentuknya dibangun di atas tabel `competition_rounds`,
 * `competition_heats`, dan `heat_entries` yang sudah ada di petpet-service.
 */

/** Keadaan drawing satu kompetisi. NOT_DRAWN = belum pernah di-lock, LOCKED = sudah disimpan. */
export const DRAWING_STATUSES = ["NOT_DRAWN", "LOCKED"] as const;
export type DrawingStatus = (typeof DRAWING_STATUSES)[number];

/** Status satu match (= `competition_heats.status`). Swap hanya boleh bila SCHEDULED. */
export const MATCH_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** Kenapa Lock tidak tersedia (data yang melarang, bukan hak pemanggil). Null bila tidak ada hambatan data. */
export const DRAWING_BLOCKED_REASONS = [
  "REGISTRATION_OPEN",
  "COMPETITION_STATUS",
  "NO_PARTICIPANTS",
  "ALREADY_LOCKED",
] as const;
export type DrawingBlockedReason = (typeof DRAWING_BLOCKED_REASONS)[number];

export const DRAWING_BLOCKED_LABEL: Record<DrawingBlockedReason, string> = {
  REGISTRATION_OPEN: "Close registration before drawing.",
  COMPETITION_STATUS: "Only upcoming or live competitions can be drawn.",
  NO_PARTICIPANTS: "No participant is checked in and paid yet.",
  ALREADY_LOCKED: "The drawing is already locked.",
};

/** Satu peserta yang berhak diundi (entry APPROVED + PAID + CHECKED_IN), persis seperti dikirim API. */
export type ApiDrawingParticipant = {
  entry_uuid: string;
  /** Null untuk entry tim. */
  pet_name: string | null;
  owner_name: string;
  bib_number: string | null;
};

/** Satu lane dalam match yang sudah di-lock (= satu baris `heat_entries`). */
export type ApiDrawingLane = ApiDrawingParticipant & {
  /** 1..lanes. Sama dengan `start_order`. */
  lane_number: number;
};

/** Satu match (= satu baris `competition_heats`). */
export type ApiDrawingMatch = {
  uuid: string;
  /** 1..n, urut. Sama dengan `heat_number`. */
  match_number: number;
  status: MatchStatus;
  /** Urut menurut `lane_number`. */
  lanes: ApiDrawingLane[];
};

/** Apa yang boleh dilakukan pemanggil (aturan dipegang backend). */
export type ApiDrawingActions = { lock: boolean; swap: boolean };

/** `data` dari `GET /competitions/{uuid}/drawing`, `POST .../drawing`, dan `POST .../drawing/swap`. */
export type ApiDrawing = {
  competition_uuid: string;
  status: DrawingStatus;
  /** Jumlah lane per match dari rule aktif (`lane_total`), bawaan 4 bila rule belum mengisinya. */
  lanes: number;
  locked_at: string | null;
  locked_by_uuid: string | null;
  locked_by_name: string | null;
  /** Peserta yang berhak diundi sekarang, urut menurut bib. Bahan Shuffle di layar. */
  participants: ApiDrawingParticipant[];
  /** Kosong selama NOT_DRAWN. */
  matches: ApiDrawingMatch[];
  /** Alasan Lock tidak tersedia karena data; null bila tidak ada hambatan. */
  lock_blocked_reason: DrawingBlockedReason | null;
  actions: ApiDrawingActions;
};

/** Body `POST /competitions/{uuid}/drawing`. Urutan `matches` menjadi nomor match 1..n. */
export type ApiLockDrawingBody = {
  matches: { lanes: { lane_number: number; entry_uuid: string }[] }[];
};

/** Body `POST /competitions/{uuid}/drawing/swap`. */
export type ApiSwapDrawingBody = {
  entry_uuid_a: string;
  entry_uuid_b: string;
};

/** Bentuk untuk layar. */
export type DrawingParticipant = {
  entryId: string;
  petName: string;
  ownerName: string;
  bibNumber: string;
};

export type DrawingLane = DrawingParticipant & { laneNumber: number };

export type DrawingMatch = {
  /** Uuid heat dari API; "draft-N" untuk hasil Shuffle yang belum di-lock. */
  id: string;
  number: number;
  status: MatchStatus;
  lanes: DrawingLane[];
};

export type CompetitionDrawing = {
  competitionId: string;
  locked: boolean;
  lanes: number;
  lockedAt: string | null;
  lockedByName: string | null;
  participants: DrawingParticipant[];
  matches: DrawingMatch[];
  lockBlockedReason: DrawingBlockedReason | null;
  actions: { lock: boolean; swap: boolean };
};

/** Mengubah satu peserta API ke bentuk layar. Dipanggil dari `fromApi`. */
export function participantFromApi(
  row: ApiDrawingParticipant,
): DrawingParticipant {
  return {
    entryId: row.entry_uuid,
    petName: row.pet_name ?? "Unnamed pet",
    ownerName: row.owner_name,
    bibNumber: row.bib_number ?? "",
  };
}

/** Mengubah satu match API ke bentuk layar; lane diurutkan menurut nomor lane. */
export function matchFromApi(match: ApiDrawingMatch): DrawingMatch {
  return {
    id: match.uuid,
    number: match.match_number,
    status: match.status,
    lanes: match.lanes
      .map((lane) => ({
        ...participantFromApi(lane),
        laneNumber: lane.lane_number,
      }))
      .sort((a, b) => a.laneNumber - b.laneNumber),
  };
}

/** Mengubah respons API ke bentuk layar. Dipanggil dari api.ts; match diurutkan menurut nomornya. */
export function fromApi(data: ApiDrawing): CompetitionDrawing {
  return {
    competitionId: data.competition_uuid,
    locked: data.status === "LOCKED",
    lanes: data.lanes,
    lockedAt: data.locked_at,
    lockedByName: data.locked_by_name,
    participants: data.participants.map(participantFromApi),
    matches: data.matches.map(matchFromApi).sort((a, b) => a.number - b.number),
    lockBlockedReason: data.lock_blocked_reason,
    actions: { lock: data.actions.lock, swap: data.actions.swap },
  };
}
