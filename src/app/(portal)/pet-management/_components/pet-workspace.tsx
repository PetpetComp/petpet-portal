"use client";
import { ApiWorkspace } from "@/components/common/api-workspace";
import type { ViewMode } from "@/types/portal";
export function PetWorkspace(props: {
  mode?: ViewMode;
  id?: string;
  eventId?: string;
}) {
  return <ApiWorkspace collection="pets" {...props} />;
}
