import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventKeys } from "@/domains/events/queries";
import {
  getAssignmentRoles,
  getEventInvitations,
  getEventStaff,
  inviteStaff,
  revokeAssignment,
  revokeInvitation,
} from "./api";
import type { ApiStaffInvitationBody } from "./types";

export const staffKeys = {
  all: ["staff"] as const,
  roles: ["master", "assignment-roles"] as const,
  forEvent: (eventId: string) => [...staffKeys.all, "event", eventId] as const,
  invitations: (eventId: string) =>
    [...staffKeys.all, "invitations", eventId] as const,
};

/** Daftar peran untuk dropdown dan label chip. Jarang berubah: disimpan selama sesi. */
export function useAssignmentRoles() {
  return useQuery({
    queryKey: staffKeys.roles,
    queryFn: getAssignmentRoles,
    staleTime: Infinity,
  });
}

/** Penugasan aktif satu event (tim event + semua kompetisi). */
export function useEventStaff(eventId: string) {
  return useQuery({
    queryKey: staffKeys.forEvent(eventId),
    queryFn: () => getEventStaff(eventId),
  });
}

/** Undangan PENDING satu event. Dipisah dari penugasan: aturan akses backend-nya berbeda. */
export function useEventInvitations(eventId: string) {
  return useQuery({
    queryKey: staffKeys.invitations(eventId),
    queryFn: () => getEventInvitations(eventId),
  });
}

/**
 * Setelah undang atau cabut: muat ulang daftar tab ini dan hitungan checklist di Overview
 * ("Committee invited"). Dipanggil dari ketiga mutation di bawah.
 */
function useRefreshCommittee(eventId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: staffKeys.forEvent(eventId) }),
      client.invalidateQueries({ queryKey: staffKeys.invitations(eventId) }),
      client.invalidateQueries({ queryKey: eventKeys.counts(eventId) }),
    ]);
}

/** Kirim undangan baru. Error 422 dibaca pemanggil lewat `ApiError.errors`. */
export function useInviteStaff(eventId: string) {
  const refresh = useRefreshCommittee(eventId);
  return useMutation({
    mutationFn: (body: ApiStaffInvitationBody) => inviteStaff(body),
    onSuccess: refresh,
  });
}

/** Cabut penugasan aktif (tombol Remove). */
export function useRevokeAssignment(eventId: string) {
  const refresh = useRefreshCommittee(eventId);
  return useMutation({
    mutationFn: async (id: string) => {
      await revokeAssignment(id);
    },
    onSuccess: refresh,
  });
}

/** Cabut undangan Pending (tombol Revoke). */
export function useRevokeInvitation(eventId: string) {
  const refresh = useRefreshCommittee(eventId);
  return useMutation({
    mutationFn: async (id: string) => {
      await revokeInvitation(id);
    },
    onSuccess: refresh,
  });
}
