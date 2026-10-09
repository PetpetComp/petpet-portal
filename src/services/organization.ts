import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  ApiRecord,
  ListParams,
  ListResponse,
  RecordResponse,
} from "@/types/api";
import type { Organization, OrganizationDraft } from "@/types/organization";

export interface OrganizationRecord extends ApiRecord {
  name: string;
  campaign?: string | null;
  photo_url?: string | null;
  pics?: { uuid: string; name: string }[];
}

export function mapOrganization(record: OrganizationRecord): Organization {
  return {
    id: record.uuid,
    name: record.name,
    campaign: record.campaign ?? "",
    photo: record.photo_url ?? "",
    pics: (record.pics ?? []).map((pic) => ({ id: pic.uuid, name: pic.name })),
  };
}

export function organizationPayload(
  draft: OrganizationDraft,
  updating = false,
): FormData {
  const form = new FormData();
  form.set("name", draft.name.trim());
  form.set("campaign", draft.campaign.trim());
  draft.picIds.forEach((id) => form.append("pic_ids[]", id));
  if (updating) form.set("_method", "PATCH");
  if (draft.photo.startsWith("data:")) {
    const match =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
        draft.photo,
      );
    if (!match) throw new Error("Choose a PNG, JPEG, or WebP photo.");
    const bytes = Uint8Array.from(atob(match[2]), (character) =>
      character.charCodeAt(0),
    );
    if (bytes.length > 2 * 1024 * 1024)
      throw new Error("Choose a photo under 2 MB.");
    const extension = match[1].split("/")[1];
    form.set(
      "photo",
      new Blob([bytes], { type: match[1] }),
      "organization." + extension,
    );
  } else if (updating && !draft.photo) {
    form.set("remove_photo", "1");
  }
  return form;
}

export const ORGANIZATION_SERVICES = {
  list: (params?: ListParams) =>
    apiClient.get<ListResponse<OrganizationRecord>>(
      buildUrl(ENDPOINTS.organizations.list, params),
    ),
  detail: (id: string) =>
    apiClient.get<RecordResponse<OrganizationRecord>>(
      ENDPOINTS.organizations.detail(id),
    ),
  create: (draft: OrganizationDraft) =>
    apiClient.postForm<RecordResponse<OrganizationRecord>>(
      ENDPOINTS.organizations.list,
      organizationPayload(draft),
    ),
  update: (id: string, draft: OrganizationDraft) =>
    apiClient.postForm<RecordResponse<OrganizationRecord>>(
      ENDPOINTS.organizations.detail(id),
      organizationPayload(draft, true),
    ),
};
