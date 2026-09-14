import type { PortalRecord } from "@/types/portal";
import { initials } from "@/lib/identity";

export {
  SPONSOR_CATEGORIES,
  canModifyAssignment,
  isDuplicateAssignment,
} from "@/lib/constants/sponsorship";

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "threads"
  | "x";

export const SOCIAL_FIELDS: { key: string; label: string; icon: SocialPlatform }[] = [
  { key: "instagramId", label: "Instagram ID", icon: "instagram" },
  { key: "tiktokId", label: "TikTok ID", icon: "tiktok" },
  { key: "facebookId", label: "Facebook ID", icon: "facebook" },
  { key: "youtubeId", label: "YouTube ID", icon: "youtube" },
  { key: "threadsId", label: "Threads ID", icon: "threads" },
  { key: "xId", label: "X ID", icon: "x" },
];

export function isDuplicateBrandName(
  brands: PortalRecord[],
  draft: PortalRecord,
): boolean {
  return brands.some(
    (brand) =>
      brand.id !== draft.id &&
      brand.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
  );
}

export function brandInitials(name: string): string {
  return initials(name, "B");
}
