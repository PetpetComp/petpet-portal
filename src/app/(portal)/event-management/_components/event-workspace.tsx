"use client";
import { ApiWorkspace } from "@/components/common/api-workspace";
import type { ViewMode } from "@/types/portal";
export function EventWorkspace(props: {
  mode?: ViewMode;
  id?: string;
  eventId?: string;
}) {
  return <ApiWorkspace collection="events" {...props} />;
}
