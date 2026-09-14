import type { AuditFields } from "@/types/common";

export type Gender = "Male" | "Female";

export interface User extends AuditFields {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender | "";
  dob: string;
  address: string;
  city: string;
  province: string;
  postalCode?: string;
  nation: string;
}
