import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCompetitionRules,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import type { Competition } from "@/domains/competitions/types";
import { useDrawing } from "@/domains/drawing/queries";
import { eventKeys } from "@/domains/events/queries";
import {
  getAssignmentRoles,
  getEventInvitations,
  getEventStaff,
  inviteStaff,
  revokeAssignment,
  revokeInvitation,
} from "./api";
import { liveProgressLine } from "./live-progress";
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

/**
 * Baris progres kartu Live ("Match 2 of 9 - 5 lanes") untuk satu kompetisi.
 * Dipanggil dari kartu di My assignments dan kartu "Live now" di Home. Drawing hanya dibaca
 * untuk tipe Race; gagal membaca (mis. akun tidak berhak) tidak menjadi error layar, barisnya
 * jatuh ke teks cadangan (lane dari rule dan status).
 */
export function useLiveProgress(competition: Competition): string {
  const types = useCompetitionTypes();
  const isRace =
    types.data?.find((t) => t.id === competition.typeId)?.code === "RACE";
  const drawing = useDrawing(competition.id, isRace);
  const rules = useCompetitionRules(competition.id);
  const activeRule = rules.data?.find((r) => r.isActive) ?? null;
  return liveProgressLine({
    status: competition.status,
    isRace,
    drawing: drawing.data ?? null,
    laneTotal: activeRule?.laneTotal ?? null,
  });
}
