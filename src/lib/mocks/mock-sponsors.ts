import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { SPONSOR_LEVELS, type ApiEventSponsor } from "@/domains/sponsors/types";
import { callerFor, forbidUnless, hasPermission } from "./mock-records";
import { findOrThrow, nextUuid, store } from "./mock-store";
import type { MockEventSponsor, MockUser } from "./mock-types";

/**
 * Backend palsu untuk sponsor event. Aturan mengikuti `EventSponsorService` backend dan
 * kontrak 13 bagian 4 (petpet-docs). Dipanggil dari route `/events/:uuid/sponsors*`
 * di mock-request.ts.
 */

/** Satu tautan event-sponsor sebagai response API (`EventSponsorData::toArray`). */
export function eventSponsorRecord(link: MockEventSponsor): ApiEventSponsor {
  return {
    uuid: link.uuid,
    event_uuid: link.event_uuid,
    sponsor_uuid: link.sponsor_uuid,
    sponsorship_level: link.sponsorship_level,
    campaign_text: link.campaign_text ?? null,
    display_order: link.display_order ?? 0,
    start_at: link.start_at ?? null,
    end_at: link.end_at ?? null,
    status: link.status,
  };
}

/** Pemanggil boleh mengubah sponsor event: `event.update` + mengelola event itu (403 bila tidak). */
function requireEventUpdate(user: MockUser, eventUuid: string) {
  const caller = callerFor(user, eventUuid);
  forbidUnless(
    caller.managesEvent && hasPermission(caller, PERMISSION.EVENT_UPDATE),
  );
}

/**
 * `GET /events/{uuid}/sponsors`: array DATAR, bukan `{ items, meta }`, seperti backend asli.
 * Tidak butuh login (rute publik di backend).
 */
export function listEventSponsorRecords(eventUuid: string): ApiEventSponsor[] {
  findOrThrow(store.events, eventUuid, "Event");
  return store.eventSponsors
    .filter((link) => link.event_uuid === eventUuid)
    .map(eventSponsorRecord);
}

/**
 * `POST /events/{uuid}/sponsors`. Urutan cek: pemanggil dulu (403), lalu data:
 * 404 brand tidak ada, 422 tier tidak dikenal, 422 brand sudah terhubung ke event itu.
 */
export function addEventSponsorRecord(
  user: MockUser,
  eventUuid: string,
  body: Record<string, unknown> | undefined,
): ApiEventSponsor {
  findOrThrow(store.events, eventUuid, "Event");
  requireEventUpdate(user, eventUuid);

  const brandId = String(body?.sponsor_id ?? "");
  const level = String(body?.sponsorship_level ?? "");
  if (!store.sponsors.some((brand) => brand.uuid === brandId))
    throw new ApiError(404, "Sponsor not found.");
  if (!(SPONSOR_LEVELS as readonly string[]).includes(level))
    throw new ApiError(422, "The selected sponsorship level is invalid.", {
      sponsorship_level: ["The selected sponsorship level is invalid."],
    });
  const alreadyLinked = store.eventSponsors.some(
    (link) => link.event_uuid === eventUuid && link.sponsor_uuid === brandId,
  );
  if (alreadyLinked)
    throw new ApiError(422, "This sponsor is already linked to this event.");

  const link: MockEventSponsor = {
    uuid: nextUuid(),
    event_uuid: eventUuid,
    sponsor_uuid: brandId,
    sponsorship_level: level,
    campaign_text: body?.campaign_text ? String(body.campaign_text) : undefined,
    display_order: Number(body?.display_order ?? 0),
    status: "ACTIVE",
  };
  store.eventSponsors.push(link);
  return eventSponsorRecord(link);
}

/** `DELETE /events/{uuid}/sponsors/{linkUuid}`: 404 bila tautan bukan milik event di URL. */
export function removeEventSponsorRecord(
  user: MockUser,
  eventUuid: string,
  linkUuid: string,
): null {
  findOrThrow(store.events, eventUuid, "Event");
  requireEventUpdate(user, eventUuid);
  const link = store.eventSponsors.find(
    (item) => item.uuid === linkUuid && item.event_uuid === eventUuid,
  );
  if (!link) throw new ApiError(404, "Event sponsor link not found.");
  store.eventSponsors = store.eventSponsors.filter(
    (item) => item.uuid !== linkUuid,
  );
  return null;
}
