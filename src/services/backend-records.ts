import { collectRows } from "./common";
import { USER_SERVICES } from "./user-management";
import { PET_SERVICES } from "./pet-management";
import { SPONSOR_SERVICES } from "./sponsorship-brand";
import { EVENT_SERVICES } from "./event-management";
import { COMPETITION_SERVICES } from "./competition";
import {
  ENTRY_SERVICES,
  EVENT_SPONSOR_SERVICES,
  STAFF_SERVICES,
} from "./event-operations";
import type { ListParams, ListResponse, RecordResponse } from "@/types/api";
import type { Collection, PortalData, PortalRecord } from "@/types/portal";

export type Row = Record<string, unknown>;
export const emptyPortalData = (): PortalData => ({
  users: [],
  events: [],
  pets: [],
  brands: [],
  competitions: [],
  registrations: [],
  committee: [],
  partners: [],
  prizes: [],
});
const camel = (key: string) =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
const title = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(
      /(^|[_ ])([a-z])/g,
      (_, space: string, letter: string) =>
        (space ? " " : "") + letter.toUpperCase(),
    );
const text = (value: unknown) => (value == null ? "" : String(value));
export function mapRecord(
  collection: Collection,
  row: Row,
  context: Partial<PortalRecord> = {},
): PortalRecord {
  if (typeof row.uuid !== "string")
    throw new Error("The API returned a record without a UUID.");
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries({
    ...row,
    ...((row.profile as Row) ?? {}),
  })) {
    if (value == null || ["string", "number", "boolean"].includes(typeof value))
      flat[camel(key)] = text(value);
  }
  const record: PortalRecord = {
    ...flat,
    ...context,
    id: row.uuid,
    name: text(row.name ?? row.brand_name ?? row.user_name),
    status: title(row.status),
  };
  if (collection === "users")
    Object.assign(record, {
      name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      gender: title((row.profile as Row)?.gender),
      dob: text((row.profile as Row)?.date_of_birth),
      roles: (Array.isArray(row.roles) ? (row.roles as Row[]) : [])
        .map((role) => text(role.code))
        .join(","),
    });
  if (collection === "events")
    Object.assign(record, {
      organizationId: text(row.organization_uuid),
      startDate: text(row.start_at),
      endDate: text(row.end_at),
      location: text(row.venue_name),
      address: text(row.venue_address),
    });
  if (collection === "pets")
    Object.assign(record, {
      speciesId: text(row.species_uuid),
      morphId: text(row.morph_uuid),
      dob: text(row.birth_date),
      gender: title(row.gender),
      heightLength: text(row.height_cm),
      weight: text(row.weight_grams),
    });
  if (collection === "competitions")
    Object.assign(record, {
      eventId: text(row.event_uuid),
      competitionTypeId: text(row.competition_type_uuid),
      speciesId: text(row.species_uuid),
      startDate: text(row.scheduled_start_at),
      endDate: text(row.scheduled_end_at),
      location: text(row.arena_name),
      raceStatus: row.registration_closed_at ? "Closed" : "Open",
    });
  if (collection === "registrations")
    Object.assign(record, {
      name: "Entry " + text(row.bib_number ?? row.uuid),
      competitionId: text(row.competition_uuid),
      userId: text(row.owner_uuid),
      petId: text(row.pet_uuid),
      teamId: text(row.team_uuid),
      registrationPeriodId: text(row.registration_period_uuid),
      registrationFee: text(row.registration_fee),
      paymentStatus: title(row.payment_status),
      checkinStatus: title(row.checkin_status),
    });
  if (collection === "partners")
    Object.assign(record, {
      name: "Sponsorship " + row.uuid,
      eventId: text(row.event_uuid),
      brandId: text(row.sponsor_uuid),
      category: text(row.sponsorship_level),
      campaign: text(row.campaign_text),
      startDate: text(row.start_at),
      endDate: text(row.end_at),
    });
  if (collection === "committee")
    Object.assign(record, {
      name: text(row.user_name ?? row.email),
      kind: row.email ? "invitation" : "assignment",
      eventId: text(row.event_uuid ?? context.eventId),
      email: text(row.email),
      userId: text(row.user_uuid),
      competitionId: text(row.competition_uuid),
      role: text(row.assignment_role),
    });
  return record;
}
export interface LoadResult {
  data: PortalData;
  errors: Partial<Record<Collection, string>>;
}
export async function loadPortalData(): Promise<LoadResult> {
  const data = emptyPortalData();
  const errors: LoadResult["errors"] = {};
  async function load(
    collection: Collection,
    fetchPage: (params: ListParams) => Promise<ListResponse>,
    context: Partial<PortalRecord> = {},
  ) {
    try {
      data[collection].push(
        ...(await collectRows(fetchPage)).map((row) =>
          mapRecord(collection, row, context),
        ),
      );
    } catch (error) {
      errors[collection] =
        error instanceof Error ? error.message : "Unable to load data.";
    }
  }
  await Promise.all([
    load("events", EVENT_SERVICES.list),
    load("users", USER_SERVICES.list),
    load("pets", PET_SERVICES.list),
    load("brands", SPONSOR_SERVICES.list),
    load("committee", STAFF_SERVICES.invitations),
  ]);
  // Keep fan-out bounded for larger event catalogs.
  for (const event of data.events) {
    await Promise.all([
      load("competitions", (params) =>
        COMPETITION_SERVICES.list(event.id, params),
      ),
      load("partners", (params) =>
        EVENT_SPONSOR_SERVICES.list(event.id, params),
      ),
      load("committee", (params) => STAFF_SERVICES.forEvent(event.id, params), {
        eventId: event.id,
      }),
    ]);
  }
  for (const competition of data.competitions) {
    await Promise.all([
      load(
        "registrations",
        (params) => ENTRY_SERVICES.list(competition.id, params),
        {
          eventId: competition.eventId,
        },
      ),
      load(
        "committee",
        (params) => STAFF_SERVICES.forCompetition(competition.id, params),
        {
          eventId: competition.eventId,
        },
      ),
    ]);
  }
  for (const key of Object.keys(data) as Collection[])
    data[key] = Array.from(
      new Map(data[key].map((record) => [record.id, record])).values(),
    );
  return { data, errors };
}
type Mapping = Record<string, string>;
const maps: Partial<Record<Collection, Mapping>> = {
  committee: {
    eventId: "event_id",
    competitionId: "competition_id",
    email: "email",
    role: "assignment_role",
  },
  users: {
    firstName: "first_name",
    lastName: "last_name",
    phone: "phone",
    status: "status",
  },
  events: {
    name: "name",
    tagline: "tagline",
    description: "description",
    location: "venue_name",
    address: "venue_address",
    mapLocation: "map_location",
    timezone: "timezone",
    startDate: "start_at",
    endDate: "end_at",
  },
  pets: {
    name: "name",
    registrationNumber: "registration_number",
    gender: "gender",
    dob: "birth_date",
    heightLength: "height_cm",
    weight: "weight_grams",
  },
  brands: {
    name: "brand_name",
    phone: "phone",
    email: "email",
    websiteUrl: "website_url",
  },
  competitions: {
    name: "name",
    description: "description",
    location: "arena_name",
    capacity: "capacity",
    startDate: "scheduled_start_at",
    endDate: "scheduled_end_at",
    minimumJudges: "minimum_judges",
  },
  registrations: {
    petId: "pet_id",
    teamId: "team_id",
    registrationPeriodId: "registration_period_id",
  },
  partners: {
    brandId: "sponsor_id",
    category: "sponsorship_level",
    campaign: "campaign_text",
    displayOrder: "display_order",
    startDate: "start_at",
    endDate: "end_at",
  },
};
export function recordPayload(
  collection: Collection,
  record: PortalRecord,
  existing: boolean,
): Row {
  const mapping = { ...maps[collection] };
  if (collection === "users")
    Object.assign(
      mapping,
      existing
        ? {
            dob: "date_of_birth",
            gender: "gender",
            address: "address",
            city: "city",
            province: "province",
            nation: "nation",
          }
        : { username: "username", email: "email" },
    );
  if (collection === "pets" && !existing)
    Object.assign(mapping, { speciesId: "species_id", morphId: "morph_id" });
  if (collection === "competitions" && !existing)
    Object.assign(mapping, {
      competitionTypeId: "competition_type_id",
      speciesId: "species_id",
    });
  const body: Row = {};
  for (const [key, backend] of Object.entries(mapping)) {
    if (record[key] === undefined) continue;
    const value = record[key].trim();
    // Empty optional foreign keys must be omitted, rather than sent as invalid UUIDs.
    if (!value && (backend.endsWith("_id") || !existing)) continue;
    if (!value) {
      body[backend] = null;
      continue;
    }
    if (
      [
        "height_cm",
        "weight_grams",
        "capacity",
        "minimum_judges",
        "display_order",
      ].includes(backend)
    ) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0)
        throw new Error(key + " must be a non-negative number.");
      body[backend] = number;
    } else if (["status", "gender", "sponsorship_level"].includes(backend))
      body[backend] = value.toUpperCase().replaceAll(" ", "_");
    else if (backend.endsWith("_at")) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime()))
        throw new Error("Enter a valid date and time.");
      body[backend] = date.toISOString();
    } else body[backend] = value;
  }
  if (collection === "events" && !existing) {
    if (record.organizationId) body.organization_id = record.organizationId;
    else if (record.newOrganizationName?.trim())
      body.new_organization = { name: record.newOrganizationName.trim() };
    else
      throw new Error(
        "Choose an organization or enter a new organization name.",
      );
  }
  return body;
}
export async function saveRecord(
  collection: Collection,
  record: PortalRecord,
  existing: boolean,
): Promise<PortalRecord> {
  if (
    collection === "prizes" ||
    (existing &&
      ["partners", "registrations", "committee"].includes(collection))
  ) {
    throw new Error(
      "This update is not supported. Use the available action buttons.",
    );
  }
  if (
    collection === "competitions" &&
    ["raceBracket", "contestAssessments", "timeTrialResults"].some(
      (key) => record[key],
    )
  ) {
    throw new Error(
      "Saving race results is not available in the connected API.",
    );
  }
  const body = recordPayload(collection, record, existing);
  let result: RecordResponse;
  switch (collection) {
    case "users":
      result = existing
        ? await USER_SERVICES.update(record.id, body)
        : await USER_SERVICES.create({
            ...body,
            username: record.username ?? "",
            email: record.email ?? "",
            first_name: record.firstName ?? "",
          });
      break;
    case "pets":
      result = existing
        ? await PET_SERVICES.update(record.id, body)
        : await PET_SERVICES.create({
            ...body,
            name: record.name,
            species_id: record.speciesId,
          });
      break;
    case "brands":
      result = existing
        ? await SPONSOR_SERVICES.update(record.id, body)
        : await SPONSOR_SERVICES.create({ ...body, brand_name: record.name });
      break;
    case "events":
      result = existing
        ? await EVENT_SERVICES.update(record.id, body)
        : await EVENT_SERVICES.create({
            ...body,
            name: record.name,
            start_at: String(body.start_at ?? ""),
            end_at: String(body.end_at ?? ""),
          });
      break;
    case "competitions":
      result = existing
        ? await COMPETITION_SERVICES.update(record.id, body)
        : await COMPETITION_SERVICES.create(record.eventId, {
            ...body,
            name: record.name,
            competition_type_id: record.competitionTypeId,
            scheduled_start_at: String(body.scheduled_start_at ?? ""),
            scheduled_end_at: String(body.scheduled_end_at ?? ""),
          });
      break;
    case "registrations":
      result = await ENTRY_SERVICES.create(record.competitionId, body);
      break;
    case "partners":
      result = await EVENT_SPONSOR_SERVICES.create(record.eventId, {
        ...body,
        sponsor_id: record.brandId,
        sponsorship_level: String(body.sponsorship_level ?? ""),
      });
      break;
    case "committee":
      result = await STAFF_SERVICES.invite({
        ...body,
        event_id: record.eventId,
        email: record.email,
        assignment_role: record.role,
      });
      break;
    default:
      throw new Error("This action is not available yet.");
  }
  return mapRecord(
    collection,
    result.data,
    record.eventId ? { eventId: record.eventId } : {},
  );
}
export async function deleteRecord(
  collection: Collection,
  record: PortalRecord,
) {
  if (
    ![
      "events",
      "users",
      "pets",
      "registrations",
      "partners",
      "committee",
    ].includes(collection)
  )
    throw new Error("Deleting this record is not supported by the API.");
  switch (collection) {
    case "users":
      await USER_SERVICES.delete(record.id);
      break;
    case "pets":
      await PET_SERVICES.delete(record.id);
      break;
    case "events":
      await EVENT_SERVICES.delete(record.id);
      break;
    case "registrations":
      await ENTRY_SERVICES.delete(record.id);
      break;
    case "partners":
      await EVENT_SPONSOR_SERVICES.delete(record.eventId, record.id);
      break;
    case "committee":
      if (record.kind === "invitation")
        await STAFF_SERVICES.deleteInvitation(record.id);
      else await STAFF_SERVICES.deleteAssignment(record.id);
      break;
  }
}
