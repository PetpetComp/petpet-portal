import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  CompetitionPayload,
  CriterionPayload,
  PeriodPayload,
  RulePayload,
  ListParams,
  ListResponse,
  RecordResponse,
  MutationResponse,
} from "@/types/api";
export const COMPETITION_SERVICES = {
  list: (eventId: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.events.competitions(eventId), params),
    ),
  detail: (id: string) =>
    apiClient.get<RecordResponse>(ENDPOINTS.competitions.detail(id)),
  create: (eventId: string, payload: CompetitionPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.events.competitions(eventId), {
      ...payload,
    }),
  update: (
    id: string,
    payload: Partial<
      Omit<CompetitionPayload, "competition_type_id" | "species_id">
    >,
  ) =>
    apiClient.patch<RecordResponse>(ENDPOINTS.competitions.detail(id), {
      ...payload,
    }),
  closeRegistration: (id: string) =>
    apiClient.post<RecordResponse>(
      ENDPOINTS.competitions.closeRegistration(id),
    ),
  rules: (id: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.competitions.rules(id), params),
    ),
  createRule: (id: string, payload: RulePayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.competitions.rules(id), {
      ...payload,
    }),
  periods: (id: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.competitions.periods(id), params),
    ),
  createPeriod: (id: string, payload: PeriodPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.competitions.periods(id), {
      ...payload,
    }),
  updatePeriod: (
    id: string,
    payload: Partial<Omit<PeriodPayload, "period_type">>,
  ) =>
    apiClient.patch<RecordResponse>(ENDPOINTS.periods.detail(id), {
      ...payload,
    }),
  deletePeriod: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.periods.detail(id)),
  criteria: (id: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.competitions.criteria(id), params),
    ),
  createCriterion: (id: string, payload: CriterionPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.competitions.criteria(id), {
      ...payload,
    }),
  updateCriterion: (
    id: string,
    payload: Partial<Omit<CriterionPayload, "code">>,
  ) =>
    apiClient.patch<RecordResponse>(ENDPOINTS.criteria.detail(id), {
      ...payload,
    }),
  deleteCriterion: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.criteria.detail(id)),
};
