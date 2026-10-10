import type {
  Competition,
  CompetitionType,
} from "@/domains/competitions/types";
import {
  kindOfCompetition,
  type CompetitionKind,
} from "@/domains/events/overview";
import { EVENT_TARGET_VALUE } from "@/domains/staff/schema";
import type {
  AssignmentRole,
  PendingInvitation,
  StaffMember,
} from "@/domains/staff/types";

/**
 * Logika murni tab Committee (tanpa React): menyusun grup "Event team" + satu grup per
 * kompetisi, urutan isi grup, teks hitungan, dan kelas warna chip.
 */

/** Satu kartu di tab Committee: tim event atau satu kompetisi. */
export type CommitteeGroup = {
  /** `EVENT_TARGET_VALUE` untuk tim event, selain itu id kompetisi (sama dengan nilai dropdown target). */
  key: string;
  title: string;
  /** Null untuk tim event. */
  competitionId: string | null;
  /** Jenis lomba untuk chip; null untuk tim event. */
  kind: CompetitionKind | null;
  members: StaffMember[];
  invitations: PendingInvitation[];
};

/** Posisi peran di daftar (menurut `sortOrder`); kode tidak dikenal ditaruh di akhir. */
function roleRank(roles: AssignmentRole[], code: string): number {
  return (
    roles.find((r) => r.code === code)?.sortOrder ?? Number.MAX_SAFE_INTEGER
  );
}

/** Anggota diurutkan menurut peran (urutan daftar peran), lalu nama. */
function sortMembers(
  members: StaffMember[],
  roles: AssignmentRole[],
): StaffMember[] {
  return [...members].sort(
    (a, b) =>
      roleRank(roles, a.role) - roleRank(roles, b.role) ||
      a.name.localeCompare(b.name),
  );
}

/** Undangan diurutkan menurut peran, lalu email. */
function sortInvitations(
  invitations: PendingInvitation[],
  roles: AssignmentRole[],
): PendingInvitation[] {
  return [...invitations].sort(
    (a, b) =>
      roleRank(roles, a.role) - roleRank(roles, b.role) ||
      a.email.localeCompare(b.email),
  );
}

/**
 * Menyusun grup tab Committee: "Event team" dulu, lalu kompetisi sesuai urutan `competitions`.
 * Penugasan dan undangan dimasukkan ke grup menurut `competitionId` (null = tim event).
 * Yang menunjuk kompetisi yang tidak ada di daftar dilewati (kompetisi tidak pernah dihapus,
 * hanya dibatalkan, jadi ini hanya terjadi bila data tidak konsisten).
 * Dipanggil dari komponen tab setelah semua data selesai dimuat.
 */
export function buildCommitteeGroups(input: {
  competitions: Competition[];
  types: CompetitionType[];
  roles: AssignmentRole[];
  members: StaffMember[];
  invitations: PendingInvitation[];
}): CommitteeGroup[] {
  const { competitions, types, roles, members, invitations } = input;
  const groupOf = (
    key: string,
    title: string,
    competitionId: string | null,
    kind: CompetitionKind | null,
  ): CommitteeGroup => ({
    key,
    title,
    competitionId,
    kind,
    members: sortMembers(
      members.filter((m) => m.competitionId === competitionId),
      roles,
    ),
    invitations: sortInvitations(
      invitations.filter((i) => i.competitionId === competitionId),
      roles,
    ),
  });
  return [
    groupOf(EVENT_TARGET_VALUE, "Event team", null, null),
    ...competitions.map((c) =>
      groupOf(c.id, c.name, c.id, kindOfCompetition(c, types)),
    ),
  ];
}

/**
 * Grup yang terbuka saat layar pertama muncul: tim event, dan kompetisi pertama yang sudah
 * berisi orang (seperti desain: satu kartu terbuka, lainnya terlipat).
 */
export function defaultOpenKeys(groups: CommitteeGroup[]): string[] {
  const firstWithPeople = groups.find(
    (g) =>
      g.competitionId !== null && g.members.length + g.invitations.length > 0,
  );
  return [
    EVENT_TARGET_VALUE,
    ...(firstWithPeople ? [firstWithPeople.key] : []),
  ];
}

/**
 * Teks hitungan di header kartu: "4 people", "1 person", "2 people · 1 pending".
 * Undangan Pending belum menjadi orang, jadi dihitung terpisah.
 */
export function groupCountLabel(group: CommitteeGroup): string {
  const people = group.members.length;
  const text = `${people} ${people === 1 ? "person" : "people"}`;
  return group.invitations.length > 0
    ? `${text} · ${group.invitations.length} pending`
    : text;
}

/** Chip peran: Judge dan Head judge ungu (seperti desain), peran lain lilac. */
export function roleChipClass(code: string): string {
  return code === "JUDGE" || code === "HEAD_JUDGE"
    ? "bg-contest/10 text-contest"
    : "bg-primary-soft text-primary-dark";
}

/** Kelas chip jenis lomba. Warna selalu dipasangkan dengan label teks (DS-Foundations). */
export const KIND_CHIP_CLASS: Record<CompetitionKind, string> = {
  race: "bg-event-day-soft text-event-day-ink",
  checkpoint: "bg-warning-soft text-checkpoint",
  time_trial: "bg-time-trial-soft text-time-trial-ink",
  contest: "bg-contest/10 text-contest",
};

/** Label chip jenis lomba dengan huruf pertama besar: "Time trial". */
export function kindChipLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}
