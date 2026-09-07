import type { AuditFields } from "@/types/common";
import type { Gender } from "@/types/user";

export interface Pet extends AuditFields {
  id: string;
  name: string;
  animal: string;
  variant: string;
  ownerUserId: string;
  ownerName: string;
  gender: Gender | "";
  dob: string;
  heightLength: string;
  weight: string;
}
