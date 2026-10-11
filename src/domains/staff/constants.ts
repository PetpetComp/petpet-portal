/**
 * Semua teks layar My assignments dan Home di satu tempat (keputusan D17: siap diterjemahkan
 * nanti). Dipakai oleh `app/(portal)/assignments` dan `app/(portal)/home`.
 */

/** Penjelasan singkat per kode peran untuk kartu "Your role as ...". Kunci = `assignment_role`. */
export const ROLE_GUIDE: Record<string, string> = {
  EVENT_MANAGER:
    "Oversee the whole event. Open any competition to follow it live and step in when a PIC needs help.",
  COMPETITION_PIC:
    "Start each match, record finishes per lane, and confirm results before the next match.",
  HEAD_JUDGE:
    "Lead the judging panel. Check that every judge has scored, then confirm the final scores.",
  JUDGE:
    "Score each participant on the criteria shown and add a note when asked.",
  TIMER_OPERATOR:
    "Record the time of each runner at the finish line, lane by lane.",
  MARSHAL:
    "Keep the track clear and the participants in order between matches.",
};

/** Teks bila kode peran belum punya penjelasan (peran baru dari backend). */
export const ROLE_GUIDE_FALLBACK =
  "Open Live Mode to see what is expected from you in this competition.";

export const ASSIGNMENTS_TEXT = {
  title: "My assignments",
  greeting: "Hi",
  openLive: "Open Live Mode",
  roleTitle: (roleLabel: string) => `Your role as ${roleLabel}`,
  todayHeading: (eventName: string) => `Today - ${eventName}`,
  footer: "Only competitions you are assigned to appear here.",
  emptyTitle: "No assignment today",
  emptyMessage:
    "You have no competition to run today. Assignments for an event show up here on the day of the event.",
  loadError: "We could not load your assignments.",
} as const;
