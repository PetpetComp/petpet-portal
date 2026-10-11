import { afterEach, describe, expect, it } from "vitest";
import type {
  ApiJudging,
  ApiJudgingParticipant,
  ApiScorecard,
} from "@/domains/judging/types";
import { judgingStore, resetJudgingStore } from "./mock-judging";
import { mockRequest } from "./mock-request";
import { resetStaffStore, staffStore } from "./mock-staff";
import { DEMO_PASSWORD, store } from "./mock-store";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk sama dengan kontrak Judging (15). */
const BEAUTY = "comp-beauty-class-open"; // BEAUTY, ONGOING, 3 kriteria 40/30/30, 7 peserta berhak
const BEST_IN_SHOW = "comp-best-in-show-cat"; // COMBINED, tanpa kriteria
const SPRINT = "comp-glider-sprint-heats"; // Race, bukan Contest
const JAKARTA = "evt-jakarta-pet-festival";
const ROUND = `round-${BEAUTY}-1`;
const APPEARANCE = `crit-${BEAUTY}-appearance`;
const BEHAVIOR = `crit-${BEAUTY}-behavior`;
const PRESENTATION = `crit-${BEAUTY}-presentation`; // note_required
const entryId = (n: number) =>
  `entry-beauty-class-open-${String(n).padStart(3, "0")}`;
// Urutan check-in peserta berhak: bib 001, 002, 003, 007, 010, 014, 021.
const QUEUE = [1, 2, 3, 7, 10, 14, 21].map(entryId);

async function call<T>(
  method: string,
  url: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return (await mockRequest<{ data: T }>(method, url, body)).data;
}
const signIn = (email: string) =>
  call("POST", "/auth/login", { email, password: DEMO_PASSWORD });
const asJudge = () => signIn("farhan.hidayat@petpet.dev");
const asOrganizer = () => signIn("organizer@petpet.dev");
const asStranger = () => signIn("competitor@petpet.dev");

const judging = (competition = BEAUTY) =>
  call<ApiJudging>("GET", `/competitions/${competition}/judging`);
const rowOf = (data: ApiJudging, entry: string): ApiJudgingParticipant => {
  const found = data.participants.find((p) => p.entry_uuid === entry);
  if (!found) throw new Error(`no participant ${entry}`);
  return found;
};
const createCard = (entry: string, extra: Record<string, unknown> = {}) =>
  call<ApiScorecard>("POST", `/rounds/${ROUND}/scorecards`, {
    entry_id: entry,
    ...extra,
  });
const putScores = (
  card: string,
  scores: {
    criterion_id: string;
    score: number | string;
    note?: string | null;
  }[],
) =>
  call<ApiScorecard>("PUT", `/scorecards/${card}/criterion-scores`, { scores });
const patchCard = (card: string, body: Record<string, unknown>) =>
  call<ApiScorecard>("PATCH", `/scorecards/${card}`, body);
const lock = (card: string) =>
  call<ApiScorecard>("POST", `/scorecards/${card}/lock`);
const seedCardOf = (entry: string) => {
  const found = judgingStore.scorecards.find((c) => c.entry_uuid === entry);
  if (!found) throw new Error(`no seed card for ${entry}`);
  return found;
};

// Tes mengubah kompetisi, entry, staf, dan scorecard: kembalikan setelah tiap tes.
const seedCompetitions = structuredClone(store.competitions);
const seedEntriesCopy = structuredClone(store.entries);
afterEach(() => {
  store.competitions = structuredClone(seedCompetitions);
  store.entries = structuredClone(seedEntriesCopy);
  resetStaffStore();
  resetJudgingStore();
});

describe("seed and reading", () => {
  it("lists the criteria, 7 participants in check-in order and the judge's seeded scorecards", async () => {
    await asJudge();
    const data = await judging();
    expect(data).toMatchObject({
      competition_uuid: BEAUTY,
      round_uuid: ROUND,
      scored_count: 2,
      total_count: 7,
      judge: { assignment_role: "JUDGE" },
      actions: { can_score: true },
    });
    expect(
      data.criteria.map((c) => [c.code, c.weight, c.note_required]),
    ).toEqual([
      ["APPEARANCE", "40.00", false],
      ["BEHAVIOR", "30.00", false],
      ["PRESENTATION", "30.00", true],
    ]);
    expect(data.participants.map((p) => p.entry_uuid)).toEqual(QUEUE);
    expect(data.participants.map((p) => p.queue_number)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(data.participants.map((p) => p.status)).toEqual([
      "LOCKED",
      "LOCKED",
      "DRAFT",
      "NOT_SCORED",
      "NOT_SCORED",
      "NOT_SCORED",
      "NOT_SCORED",
    ]);
  });

  it("shows the participant details, the display total and the flags per status", async () => {
    await asJudge();
    const data = await judging();
    const locked = rowOf(data, QUEUE[0]);
    expect(locked).toMatchObject({
      bib_number: "001",
      pet_name: "Chibi",
      total: 80, // (80 * 40 + 70 * 30 + 90 * 30) / 100
      judge_note: "Strong overall.",
      actions: { score: false, submit: false },
    });
    expect(locked.scores).toHaveLength(3);
    expect(rowOf(data, QUEUE[1]).total).toBe(69);
    const draft = rowOf(data, QUEUE[2]);
    expect(draft.scores.map((s) => s.criterion_uuid)).toEqual([
      APPEARANCE,
      BEHAVIOR,
    ]);
    expect(draft.total).toBe(46); // (70 * 40 + 60 * 30) / 100
    expect(draft.actions).toEqual({ score: true, submit: false });
    const fresh = rowOf(data, QUEUE[3]);
    expect(fresh).toMatchObject({
      scorecard_uuid: null,
      scores: [],
      total: null,
      actions: { score: true, submit: false },
    });
  });

  it("orders the queue by check-in time, not by bib number", async () => {
    // Peserta pertama check-in paling akhir: pindah ke ujung antrean.
    store.entries.find((e) => e.uuid === QUEUE[0])!.checked_in_at =
      "2026-10-10T12:00:00+00:00";
    await asJudge();
    const data = await judging();
    expect(data.participants.map((p) => p.entry_uuid)).toEqual([
      ...QUEUE.slice(1),
      QUEUE[0],
    ]);
    expect(data.participants[6].queue_number).toBe(7);
    // Waktu sama: nomor bib yang menentukan.
    for (const e of store.entries.filter((x) => QUEUE.includes(x.uuid)))
      e.checked_in_at = "2026-10-10T07:00:00+00:00";
    expect((await judging()).participants.map((p) => p.entry_uuid)).toEqual(
      QUEUE,
    );
  });

  it("includes a newly checked-in participant at the end and drops one who is no longer eligible", async () => {
    await asJudge();
    const mika = entryId(4); // disetujui dan lunas, belum check-in
    expect(
      (await judging()).participants.map((p) => p.entry_uuid),
    ).not.toContain(mika);
    store.entries.find((e) => e.uuid === mika)!.checkin_status = "CHECKED_IN";
    store.entries.find((e) => e.uuid === mika)!.checked_in_at =
      "2026-10-10T15:00:00+00:00";
    const after = await judging();
    expect(after.total_count).toBe(8);
    expect(after.participants[7].entry_uuid).toBe(mika);
    store.entries.find((e) => e.uuid === QUEUE[6])!.payment_status = "UNPAID";
    expect((await judging()).total_count).toBe(7);
  });

  it("lets a manager read everything but never score", async () => {
    await asOrganizer();
    const data = await judging();
    expect(data.judge).toBeNull();
    expect(data.actions.can_score).toBe(false);
    expect(data.total_count).toBe(7);
    expect(data.participants.every((p) => p.status === "NOT_SCORED")).toBe(
      true,
    );
    expect(data.participants.every((p) => !p.actions.score)).toBe(true);
    const cards = await call<ApiScorecard[]>(
      "GET",
      `/rounds/${ROUND}/scorecards`,
    );
    expect(cards).toHaveLength(3);
    const one = await call<ApiScorecard>("GET", `/scorecards/${cards[0].uuid}`);
    expect(one.criterion_scores).toHaveLength(3);
  });

  it("returns a Best in Show competition without criteria and cannot be scored", async () => {
    await asOrganizer();
    const data = await judging(BEST_IN_SHOW);
    expect(data.criteria).toEqual([]);
    expect(data.actions.can_score).toBe(false);
  });

  it("rejects unknown competitions, non-Contest types, strangers and no session", async () => {
    await asOrganizer();
    await expect(judging("comp-nope")).rejects.toMatchObject({ status: 404 });
    await expect(judging(SPRINT)).rejects.toMatchObject({ status: 422 });
    await asStranger();
    await expect(judging()).rejects.toMatchObject({ status: 403 });
    await call("POST", "/auth/logout");
    await expect(judging()).rejects.toMatchObject({ status: 401 });
  });

  it("serializes a scorecard like ScorecardData (backend weighted_total = sum of score * weight)", async () => {
    await asJudge();
    const card = await call<ApiScorecard>(
      "GET",
      `/scorecards/${seedCardOf(QUEUE[0]).uuid}`,
    );
    expect(card).toMatchObject({
      round_uuid: ROUND,
      entry_uuid: QUEUE[0],
      status: "LOCKED",
      weighted_total: 800, // 8 * 40 + 7 * 30 + 9 * 30
      total_score: 24,
      max_total_score: 30,
      judge_note: "Strong overall.",
    });
    expect(card.staff_assignment_uuid).toBe(
      staffStore.assignments.find(
        (a) =>
          a.user_uuid === "u-competitor-5" && a.competition_uuid === BEAUTY,
      )!.uuid,
    );
    expect(card.criterion_scores[0]).toMatchObject({
      criterion_uuid: APPEARANCE,
      score: 8,
      weighted_score: 320,
      note: null,
    });
    expect(card.locked_at).not.toBeNull();
  });
});

describe("scoring a participant end to end", () => {
  it("creates lazily, saves partially, saves the rest, submits and locks", async () => {
    await asJudge();
    const entry = QUEUE[3];
    const created = await createCard(entry);
    expect(created).toMatchObject({
      status: "DRAFT",
      entry_uuid: entry,
      weighted_total: null,
      criterion_scores: [],
    });
    expect(rowOf(await judging(), entry)).toMatchObject({
      scorecard_uuid: created.uuid,
      status: "DRAFT",
    });

    const first = await putScores(created.uuid, [
      { criterion_id: APPEARANCE, score: 9 },
    ]);
    expect(first.criterion_scores).toHaveLength(1);
    expect(first.weighted_total).toBe(360);
    // Hanya kriteria yang dikirim yang berubah; Appearance tetap 9.
    const second = await putScores(created.uuid, [
      { criterion_id: BEHAVIOR, score: "7.5" },
    ]);
    expect(
      second.criterion_scores.map((s) => [s.criterion_uuid, s.score]),
    ).toEqual([
      [APPEARANCE, 9],
      [BEHAVIOR, 7.5],
    ]);
    expect(rowOf(await judging(), entry).actions.submit).toBe(false);

    await putScores(created.uuid, [
      { criterion_id: PRESENTATION, score: 8, note: "Confident" },
    ]);
    const ready = rowOf(await judging(), entry);
    expect(ready.actions).toEqual({ score: true, submit: true });
    expect(ready.total).toBe(82.5); // (90 * 40 + 75 * 30 + 80 * 30) / 100

    const submitted = await patchCard(created.uuid, {
      status: "SUBMITTED",
      judge_note: "Lovely",
    });
    expect(submitted).toMatchObject({
      status: "SUBMITTED",
      judge_note: "Lovely",
    });
    expect(submitted.submitted_at).not.toBeNull();
    const locked = await lock(created.uuid);
    expect(locked.status).toBe("LOCKED");
    expect(locked.locked_at).not.toBeNull();

    const after = await judging();
    expect(rowOf(after, entry)).toMatchObject({
      status: "LOCKED",
      actions: { score: false, submit: false },
    });
    expect(after.scored_count).toBe(3);
  });

  it("is idempotent: the same judge and entry get the same scorecard", async () => {
    await asJudge();
    const a = await createCard(QUEUE[4]);
    const b = await createCard(QUEUE[4]);
    expect(b.uuid).toBe(a.uuid);
    expect(
      judgingStore.scorecards.filter((c) => c.entry_uuid === QUEUE[4]),
    ).toHaveLength(1);
    // Scorecard seed yang sudah ada juga dikembalikan, tanpa mengubahnya.
    const seeded = await createCard(QUEUE[0]);
    expect(seeded).toMatchObject({ status: "LOCKED" });
  });

  it("finishes the seeded draft too", async () => {
    await asJudge();
    const draft = seedCardOf(QUEUE[2]);
    await putScores(draft.uuid, [
      { criterion_id: PRESENTATION, score: 6, note: "Nervous but fine" },
    ]);
    await patchCard(draft.uuid, { status: "SUBMITTED" });
    expect((await lock(draft.uuid)).status).toBe("LOCKED");
  });

  it("saves the judge note on its own and keeps the scorecard a draft", async () => {
    await asJudge();
    const draft = seedCardOf(QUEUE[2]);
    const card = await patchCard(draft.uuid, { judge_note: "Check again" });
    expect(card).toMatchObject({ status: "DRAFT", judge_note: "Check again" });
  });

  it("lets the note of a criterion stay when only the score is sent", async () => {
    await asJudge();
    const card = await createCard(QUEUE[5]);
    await putScores(card.uuid, [
      { criterion_id: PRESENTATION, score: 5, note: "Note" },
    ]);
    const again = await putScores(card.uuid, [
      { criterion_id: PRESENTATION, score: 6 },
    ]);
    expect(again.criterion_scores[0]).toMatchObject({ score: 6, note: "Note" });
  });
});

describe("validation", () => {
  it("rejects submit with a missing criterion (422)", async () => {
    await asJudge();
    const draft = seedCardOf(QUEUE[2]); // Presentation belum dinilai
    await expect(
      patchCard(draft.uuid, { status: "SUBMITTED" }),
    ).rejects.toMatchObject({ status: 422 });
    expect(draft.status).toBe("DRAFT");
  });

  it("rejects submit when a required note is missing (422), then accepts it with the note", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    // Autosave boleh menyimpan skor tanpa catatan; catatan diperiksa saat Submit.
    await putScores(card.uuid, [
      { criterion_id: APPEARANCE, score: 8 },
      { criterion_id: BEHAVIOR, score: 8 },
      { criterion_id: PRESENTATION, score: 8 },
    ]);
    await expect(
      patchCard(card.uuid, { status: "SUBMITTED" }),
    ).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("A note is required for Presentation"),
    });
    await putScores(card.uuid, [
      { criterion_id: PRESENTATION, score: 8, note: "  " },
    ]);
    await expect(
      patchCard(card.uuid, { status: "SUBMITTED" }),
    ).rejects.toMatchObject({ status: 422 });
    await putScores(card.uuid, [
      { criterion_id: PRESENTATION, score: 8, note: "Poised" },
    ]);
    await expect(
      patchCard(card.uuid, { status: "SUBMITTED" }),
    ).resolves.toMatchObject({
      status: "SUBMITTED",
    });
  });

  it("keeps the judge note out of a refused submit", async () => {
    await asJudge();
    const draft = seedCardOf(QUEUE[2]);
    await expect(
      patchCard(draft.uuid, { status: "SUBMITTED", judge_note: "Done" }),
    ).rejects.toMatchObject({ status: 422 });
    expect(draft.judge_note).toBeNull();
  });

  it("refuses to lock a scorecard that was never submitted (422)", async () => {
    await asJudge();
    await expect(lock(seedCardOf(QUEUE[2]).uuid)).rejects.toMatchObject({
      status: 422,
      message: "Only a submitted scorecard can be locked.",
    });
    const fresh = await createCard(QUEUE[3]);
    await expect(lock(fresh.uuid)).rejects.toMatchObject({ status: 422 });
  });

  it("re-checks completeness at lock when a criterion was added after submit", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    await putScores(card.uuid, [
      { criterion_id: APPEARANCE, score: 8 },
      { criterion_id: BEHAVIOR, score: 8 },
      { criterion_id: PRESENTATION, score: 8, note: "Poised" },
    ]);
    await patchCard(card.uuid, { status: "SUBMITTED" });
    // Kriteria baru ditambahkan setelah Submit: Lock memeriksa ulang kelengkapan.
    store.scoreCriteria.push({
      uuid: "crit-extra",
      competition_uuid: BEAUTY,
      code: "EXTRA",
      name: "Extra",
      description: null,
      weight: 10,
      min_score: 0,
      max_score: 10,
      note_required: false,
      display_order: 4,
      status: "ACTIVE",
    });
    try {
      await expect(lock(card.uuid)).rejects.toMatchObject({ status: 422 });
    } finally {
      store.scoreCriteria = store.scoreCriteria.filter(
        (c) => c.uuid !== "crit-extra",
      );
    }
  });

  it("rejects bad score bodies (422)", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    for (const scores of [
      [], // kosong
      [{ criterion_id: APPEARANCE, score: 11 }], // di atas max
      [{ criterion_id: APPEARANCE, score: -1 }], // di bawah min
      [{ criterion_id: APPEARANCE, score: "abc" }], // bukan angka
      [{ criterion_id: "crit-nope", score: 5 }], // kriteria asing
      [{ criterion_id: APPEARANCE, score: 5, note: 3 as unknown as string }],
    ])
      await expect(putScores(card.uuid, scores)).rejects.toMatchObject({
        status: 422,
      });
    await expect(
      call("PUT", `/scorecards/${card.uuid}/criterion-scores`, {}),
    ).rejects.toMatchObject({ status: 422 });
    // Seluruh permintaan ditolak bersama: tidak ada skor yang tersimpan sebagian.
    await expect(
      putScores(card.uuid, [
        { criterion_id: APPEARANCE, score: 5 },
        { criterion_id: BEHAVIOR, score: 99 },
      ]),
    ).rejects.toMatchObject({ status: 422 });
    expect(rowOf(await judging(), QUEUE[3]).scores).toEqual([]);
  });

  it("accepts the limits of the range", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    const saved = await putScores(card.uuid, [
      { criterion_id: APPEARANCE, score: 0 },
      { criterion_id: BEHAVIOR, score: 10 },
    ]);
    expect(saved.criterion_scores.map((s) => s.score)).toEqual([0, 10]);
  });

  it("rejects a status other than SUBMITTED and a non-string note (422)", async () => {
    await asJudge();
    const draft = seedCardOf(QUEUE[2]);
    await expect(
      patchCard(draft.uuid, { status: "LOCKED" }),
    ).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      patchCard(draft.uuid, { judge_note: 5 }),
    ).rejects.toMatchObject({
      status: 422,
    });
  });

  it("rejects creating for a missing, foreign or not eligible entry (422)", async () => {
    await asJudge();
    await expect(createCard("")).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", `/rounds/${ROUND}/scorecards`, {}),
    ).rejects.toMatchObject({ status: 422 });
    await expect(createCard("entry-nope")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      createCard("entry-glider-sprint-heats-001"),
    ).rejects.toMatchObject({ status: 422 });
    // Disetujui dan lunas tetapi belum check-in.
    await expect(createCard(entryId(4))).rejects.toMatchObject({ status: 422 });
  });

  it("rejects an unknown round and a round of a non-Contest competition (404)", async () => {
    await asJudge();
    await expect(
      call("POST", "/rounds/round-nope-1/scorecards", { entry_id: QUEUE[3] }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      call("POST", `/rounds/round-${SPRINT}-1/scorecards`, {
        entry_id: QUEUE[3],
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(call("GET", "/scorecards/sc-nope")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuses to score while the competition is not scheduled or ongoing (422)", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    store.competitions.find((c) => c.uuid === BEAUTY)!.status = "COMPLETED";
    const data = await judging();
    expect(data.actions.can_score).toBe(false);
    expect(rowOf(data, QUEUE[3]).actions.score).toBe(false);
    await expect(createCard(QUEUE[4])).rejects.toMatchObject({ status: 422 });
    await expect(
      putScores(card.uuid, [{ criterion_id: APPEARANCE, score: 5 }]),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("a locked scorecard cannot change", () => {
  it("answers 409 to every write", async () => {
    await asJudge();
    const locked = seedCardOf(QUEUE[0]);
    await expect(
      putScores(locked.uuid, [{ criterion_id: APPEARANCE, score: 1 }]),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      patchCard(locked.uuid, { judge_note: "x" }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      patchCard(locked.uuid, { status: "SUBMITTED" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(lock(locked.uuid)).rejects.toMatchObject({ status: 409 });
    expect(locked.scores[0].score).toBe(8);
  });

  it("also refuses edits to a submitted scorecard (409)", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    await putScores(card.uuid, [
      { criterion_id: APPEARANCE, score: 8 },
      { criterion_id: BEHAVIOR, score: 8 },
      { criterion_id: PRESENTATION, score: 8, note: "Poised" },
    ]);
    await patchCard(card.uuid, { status: "SUBMITTED" });
    await expect(
      putScores(card.uuid, [{ criterion_id: APPEARANCE, score: 1 }]),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      patchCard(card.uuid, { status: "SUBMITTED" }),
    ).rejects.toMatchObject({
      status: 409,
    });
    // Lock tetap bisa diulang dari keadaan SUBMITTED.
    await expect(lock(card.uuid)).resolves.toMatchObject({ status: "LOCKED" });
  });
});

describe("access", () => {
  it("forbids an event manager to write (403)", async () => {
    await asOrganizer();
    const draft = seedCardOf(QUEUE[2]);
    await expect(createCard(QUEUE[3])).rejects.toMatchObject({ status: 403 });
    await expect(
      putScores(draft.uuid, [{ criterion_id: APPEARANCE, score: 5 }]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      patchCard(draft.uuid, { judge_note: "x" }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(lock(draft.uuid)).rejects.toMatchObject({ status: 403 });
  });

  it("forbids a user without any relation (403) to read or write", async () => {
    await asStranger();
    await expect(createCard(QUEUE[3])).rejects.toMatchObject({ status: 403 });
    await expect(
      call("GET", `/rounds/${ROUND}/scorecards`),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      call("GET", `/scorecards/${seedCardOf(QUEUE[0]).uuid}`),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("lets a judge touch only their own scorecards", async () => {
    // Juri kedua di kompetisi yang sama.
    staffStore.assignments.push({
      uuid: "sa-second-judge",
      event_uuid: JAKARTA,
      competition_uuid: BEAUTY,
      user_uuid: "u-competitor",
      assignment_role: "JUDGE",
      status: "ACTIVE",
    });
    await asStranger(); // competitor@petpet.dev sekarang juri
    const other = await createCard(QUEUE[3]);
    expect(other.staff_assignment_uuid).toBe("sa-second-judge");
    // Antrean juri kedua: miliknya sendiri, bukan scorecard Farhan.
    const mine = await judging();
    expect(mine.judge).toEqual({
      staff_assignment_uuid: "sa-second-judge",
      assignment_role: "JUDGE",
    });
    expect(mine.scored_count).toBe(0);
    expect(rowOf(mine, QUEUE[0]).status).toBe("NOT_SCORED");
    expect(rowOf(mine, QUEUE[3]).status).toBe("DRAFT");
    expect(
      (await call<ApiScorecard[]>("GET", `/rounds/${ROUND}/scorecards`)).map(
        (c) => c.uuid,
      ),
    ).toEqual([other.uuid]);

    // Farhan tidak boleh menyentuh scorecard juri kedua, dan sebaliknya.
    await asJudge();
    await expect(
      putScores(other.uuid, [{ criterion_id: APPEARANCE, score: 5 }]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      patchCard(other.uuid, { judge_note: "x" }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(lock(other.uuid)).rejects.toMatchObject({ status: 403 });
    await expect(
      call("GET", `/scorecards/${other.uuid}`),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await call<ApiScorecard[]>("GET", `/rounds/${ROUND}/scorecards`),
    ).toHaveLength(3);
    await asStranger();
    await expect(
      putScores(seedCardOf(QUEUE[2]).uuid, [
        { criterion_id: APPEARANCE, score: 5 },
      ]),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("lets a head judge read every scorecard but still write only their own", async () => {
    staffStore.assignments.push({
      uuid: "sa-head-judge",
      event_uuid: JAKARTA,
      competition_uuid: null, // tim event
      user_uuid: "u-competitor",
      assignment_role: "HEAD_JUDGE",
      status: "ACTIVE",
    });
    await asStranger();
    expect(
      await call<ApiScorecard[]>("GET", `/rounds/${ROUND}/scorecards`),
    ).toHaveLength(3);
    const own = await createCard(QUEUE[3]);
    expect(own.staff_assignment_uuid).toBe("sa-head-judge");
    await expect(
      putScores(seedCardOf(QUEUE[2]).uuid, [
        { criterion_id: APPEARANCE, score: 5 },
      ]),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      call("GET", `/scorecards/${seedCardOf(QUEUE[0]).uuid}`),
    ).resolves.toMatchObject({ status: "LOCKED" });
  });

  it("ignores a revoked assignment and rejects a foreign staff_assignment_id (403)", async () => {
    await asJudge();
    await expect(
      createCard(QUEUE[3], { staff_assignment_id: "sa-someone-else" }),
    ).rejects.toMatchObject({ status: 403 });
    const own = staffStore.assignments.find(
      (a) => a.user_uuid === "u-competitor-5" && a.competition_uuid === BEAUTY,
    )!;
    await expect(
      createCard(QUEUE[3], { staff_assignment_id: own.uuid }),
    ).resolves.toMatchObject({ status: "DRAFT" });
    own.status = "REVOKED";
    await expect(judging()).rejects.toMatchObject({ status: 403 });
    await expect(createCard(QUEUE[4])).rejects.toMatchObject({ status: 403 });
  });
});

describe("reset", () => {
  it("brings the seed back", async () => {
    await asJudge();
    const card = await createCard(QUEUE[3]);
    await putScores(card.uuid, [{ criterion_id: APPEARANCE, score: 5 }]);
    expect(judgingStore.scorecards).toHaveLength(4);
    resetJudgingStore();
    expect(judgingStore.scorecards.map((c) => c.status)).toEqual([
      "LOCKED",
      "LOCKED",
      "DRAFT",
    ]);
    expect(rowOf(await judging(), QUEUE[3]).status).toBe("NOT_SCORED");
  });
});
