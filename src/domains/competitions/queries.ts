import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeRegistrationPeriod,
  createCompetition,
  getCompetition,
  listCompetitionRules,
  listCompetitionTypes,
  listEventCompetitions,
  listRegistrationPeriods,
  listScoreCriteria,
  listSpecies,
  runCompetitionAction,
  saveCompetitionSettings,
  updateCompetition,
} from "./api";
import type { ApiCompetitionUpdate, NewCompetition } from "./schema";
import type { SettingsChanges } from "./settings";
import type { CompetitionAction } from "./types";
import { drawingKeys } from "@/domains/drawing/keys";
import { timetrialKeys } from "@/domains/timetrial/keys";
import { entryKeys } from "@/domains/entries/queries";

export const competitionKeys = {
  all: ["competitions"] as const,
  forEvent: (eventId: string) =>
    [...competitionKeys.all, "event", eventId] as const,
  detail: (id: string) => [...competitionKeys.all, "detail", id] as const,
  rules: (id: string) => [...competitionKeys.all, "rules", id] as const,
  periods: (id: string) => [...competitionKeys.all, "periods", id] as const,
  criteria: (id: string) => [...competitionKeys.all, "criteria", id] as const,
  types: ["master", "competition-types"] as const,
  species: ["master", "species"] as const,
};

export function useEventCompetitions(eventId: string, enabled = true) {
  return useQuery({
    queryKey: competitionKeys.forEvent(eventId),
    queryFn: () => listEventCompetitions(eventId),
    enabled,
  });
}

/** One competition: header, Overview and Settings share this cache entry. */
export function useCompetition(id: string) {
  return useQuery({
    queryKey: competitionKeys.detail(id),
    queryFn: () => getCompetition(id),
  });
}

/** Rule versions (oldest first). Needs login; a failure only hides the lanes and cut-off. */
export function useCompetitionRules(id: string) {
  return useQuery({
    queryKey: competitionKeys.rules(id),
    queryFn: () => listCompetitionRules(id),
  });
}

export function useRegistrationPeriods(id: string) {
  return useQuery({
    queryKey: competitionKeys.periods(id),
    queryFn: () => listRegistrationPeriods(id),
  });
}

/** Judging criteria. `enabled` lets callers skip the request for non-judged types. */
export function useScoreCriteria(id: string, enabled = true) {
  return useQuery({
    queryKey: competitionKeys.criteria(id),
    queryFn: () => listScoreCriteria(id),
    enabled,
  });
}

/** Master data rarely changes: keep it for the whole session. */
export function useCompetitionTypes() {
  return useQuery({
    queryKey: competitionKeys.types,
    queryFn: listCompetitionTypes,
    staleTime: Infinity,
  });
}

export function useSpecies() {
  return useQuery({
    queryKey: competitionKeys.species,
    queryFn: listSpecies,
    staleTime: Infinity,
  });
}

/** Saves the basics from the Edit page, then refreshes every competition query. */
export function useUpdateCompetition(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiCompetitionUpdate) => updateCompetition(id, body),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: competitionKeys.all }),
  });
}

/**
 * "Save changes" of the Settings tab. Refreshes on error too: some steps may have been saved.
 * The detail is refreshed as well because the active registration period comes from it.
 */
export function useSaveCompetitionSettings(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: SettingsChanges) =>
      saveCompetitionSettings(id, changes),
    // Jumlah lane (rule) memengaruhi pembagian match, jadi drawing ikut disegarkan.
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: competitionKeys.all }),
        client.invalidateQueries({ queryKey: drawingKeys.all }),
        client.invalidateQueries({ queryKey: timetrialKeys.all }),
      ]),
  });
}

/** Closes one registration channel (the API keeps the row as CLOSED). */
export function useCloseRegistrationPeriod() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      await closeRegistrationPeriod(periodId);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: competitionKeys.all }),
  });
}

export function useCreateCompetition(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: NewCompetition) => createCompetition(eventId, values),
    // Also on error: a partial create still added a competition.
    onSettled: () =>
      client.invalidateQueries({ queryKey: competitionKeys.forEvent(eventId) }),
  });
}

/**
 * Publish / start / complete / close registration / cancel. Entries are
 * refreshed too: their `actions` depend on the competition status.
 */
export function useCompetitionAction(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; action: CompetitionAction }) => {
      await runCompetitionAction(v.id, v.action);
    },
    onSettled: () =>
      Promise.all([
        // All competition queries: the workspace header reads the detail entry.
        client.invalidateQueries({ queryKey: competitionKeys.all }),
        client.invalidateQueries({ queryKey: entryKeys.forEvent(eventId) }),
        // Reopen registration deletes the locked drawing (contract 13 section 11).
        client.invalidateQueries({ queryKey: drawingKeys.all }),
        // Antrean Time trial ikut hilang bersama undiannya.
        client.invalidateQueries({ queryKey: timetrialKeys.all }),
      ]),
  });
}
