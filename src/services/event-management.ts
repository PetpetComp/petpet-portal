import type { ApiResponse, Paginated } from "@/types/common";
import type { EventItem } from "@/types/event";
import type { Competition } from "@/types/competition";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockEvents } from "@/lib/mocks/events";
import { mockCompetitions } from "@/lib/mocks/competitions";
import { delay, ok, paginate } from "@/services/common";

export const eventService = {
  list: (): Promise<Paginated<EventItem>> =>
    // return apiClient.get<Paginated<EventItem>>(ENDPOINTS.events.list);
    delay(paginate(mockEvents)),

  detail: (id: string): Promise<ApiResponse<EventItem>> => {
    // return apiClient.get<ApiResponse<EventItem>>(ENDPOINTS.events.detail(id));
    const event = mockEvents.find((e) => e.id === id) ?? mockEvents[0];
    return delay(ok(event));
  },

  competitions: (eventId: string): Promise<Paginated<Competition>> => {
    // return apiClient.get<Paginated<Competition>>(ENDPOINTS.events.competitions(eventId));
    return delay(
      paginate(mockCompetitions.filter((c) => c.eventId === eventId)),
    );
  },
};
