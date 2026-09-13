export type Collection =
  | "events"
  | "users"
  | "pets"
  | "brands"
  | "competitions"
  | "registrations"
  | "committee"
  | "partners"
  | "prizes";
export interface PortalRecord {
  id: string;
  name: string;
  [field: string]: string;
}
export type PortalData = Record<Collection, PortalRecord[]>;
export interface FieldDefinition {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "datetime-local"
    | "number"
    | "textarea"
    | "select"
    | "image";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
}
export type ViewMode = "list" | "create" | "detail" | "edit";
