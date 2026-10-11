import type { Competition } from "@/domains/competitions/types";
import type { Event } from "@/domains/events/types";

/**
 * Logika murni layar My assignments (tanpa React): dari penugasan milik akun yang login
 * (`useAuth().assignments`, asalnya `staff_assignments` di `GET /auth/me`) menjadi daftar kartu
 * kompetisi HARI INI. Dipanggil dari `use-my-assignments.ts`, dites di `my-assignments.test.ts`.
 */

/** Satu penugasan milik akun yang login. `competitionId` null = penugasan level event. */
export type MyAssignment = {
  eventId: string;
  competitionId: string | null;
  role: string;
};

/** Satu kartu: satu kompetisi dengan satu peran. */
export type AssignmentCardData = {
  /** Unik per kompetisi + peran, dipakai sebagai key React. */
  key: string;
  role: string;
  competition: Competition;
};

/** Kartu satu event, urut menurut jam mulai kompetisi. */
export type AssignmentGroup = { event: Event; cards: AssignmentCardData[] };

/** Kompetisi yang masih bisa dijalankan di Live Mode: bukan Draft dan bukan Cancelled. */
export function isRunnable(competition: Competition): boolean {
  return competition.status !== "DRAFT" && competition.status !== "CANCELLED";
}

/**
 * Membentuk kartu dari penugasan.
 * Input: penugasan akun, event yang berlangsung hari ini, dan kompetisi per id event.
 * Output: grup per event (urut jam mulai event), tiap grup berisi kartu.
 * Aturan: penugasan kompetisi menjadi satu kartu; penugasan level event (competitionId null,
 * mis. Event manager) menjadi satu kartu untuk setiap kompetisi event itu. Penugasan yang
 * event-nya bukan hari ini dibuang. Peran ganda pada kompetisi yang sama tetap dua kartu,
 * penugasan yang persis sama (kompetisi + peran) hanya satu.
 */
export function buildAssignmentGroups(
  assignments: MyAssignment[],
  todayEvents: Event[],
  competitionsByEvent: Record<string, Competition[]>,
): AssignmentGroup[] {
  const groups: AssignmentGroup[] = [];
  const byStart = (a: { startAt: string }, b: { startAt: string }) =>
    a.startAt.localeCompare(b.startAt);

  for (const event of [...todayEvents].sort(byStart)) {
    const competitions = (competitionsByEvent[event.id] ?? []).filter(
      isRunnable,
    );
    const cards = new Map<string, AssignmentCardData>();
    for (const a of assignments.filter((x) => x.eventId === event.id)) {
      const targets = a.competitionId
        ? competitions.filter((c) => c.id === a.competitionId)
        : competitions;
      for (const competition of targets) {
        const key = `${competition.id}:${a.role}`;
        if (!cards.has(key)) cards.set(key, { key, role: a.role, competition });
      }
    }
    if (cards.size > 0)
      groups.push({
        event,
        cards: [...cards.values()].sort((a, b) =>
          byStart(a.competition, b.competition),
        ),
      });
  }
  return groups;
}

/** Kode peran unik dari semua kartu, urut kemunculan. Dipakai untuk kartu "Your role as ...". */
export function distinctRoles(groups: AssignmentGroup[]): string[] {
  return [...new Set(groups.flatMap((g) => g.cards.map((card) => card.role)))];
}
