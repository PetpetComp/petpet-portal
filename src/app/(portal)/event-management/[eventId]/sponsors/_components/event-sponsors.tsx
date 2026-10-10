"use client";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Handshake, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { useEvent } from "@/domains/events/queries";
import {
  useChangeSponsorLevel,
  useEventSponsorTeam,
  useRemoveSponsor,
} from "@/domains/sponsors/queries";
import {
  SPONSOR_LEVELS,
  brandInitials,
  groupByLevel,
  levelLabel,
  unlinkedBrands,
  type EventSponsor,
} from "@/domains/sponsors/types";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { AddSponsorDrawer } from "./add-sponsor-drawer";

/** Warna titik di judul grup tier (utility bawaan Tailwind, bukan hex baru). Tier tak dikenal abu-abu. */
const LEVEL_DOT: Record<string, string> = {
  PLATINUM: "bg-slate-600",
  GOLD: "bg-amber-600",
  SILVER: "bg-slate-400",
  BRONZE: "bg-orange-800",
  MEDIA_PARTNER: "bg-blue-600",
};

const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/**
 * Tab Sponsors (F2.4): sponsor event dikelompokkan per tier (kontrak 13 bagian 4).
 * Dipanggil dari `(workspace)/sponsors/page.tsx`. Menambah, memindah tier, dan menghapus hanya
 * muncul bila pengguna berhak `event.update` pada event ini (backend tetap yang memutuskan).
 */
export function EventSponsors({ eventId }: { eventId: string }) {
  const { canOnEvent } = useAuth();
  const event = useEvent(eventId);
  const team = useEventSponsorTeam(eventId);
  const remove = useRemoveSponsor(eventId);
  const changeLevel = useChangeSponsorLevel(eventId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toRemove, setToRemove] = useState<EventSponsor | null>(null);

  const canEdit =
    !!event.data && canOnEvent(event.data, PERMISSION.EVENT_UPDATE);
  const busy = remove.isPending || changeLevel.isPending;

  /** Memindahkan satu sponsor ke tier lain (hapus + buat ulang di belakang layar). */
  function moveTo(sponsor: EventSponsor, level: string) {
    changeLevel.mutate(
      {
        link: {
          id: sponsor.linkId,
          brandId: sponsor.brandId,
          level: sponsor.level,
        },
        level,
      },
      {
        onSuccess: () =>
          toast.success(`${sponsor.brandName} moved to ${levelLabel(level)}`),
        onError: (cause) =>
          toast.error(errorText(cause, "Unable to change the tier.")),
      },
    );
  }

  /** Menghapus sponsor dari event setelah dikonfirmasi. */
  function confirmRemove(sponsor: EventSponsor) {
    remove.mutate(sponsor.linkId, {
      onSuccess: () => toast.success(`${sponsor.brandName} removed`),
      onError: (cause) =>
        toast.error(errorText(cause, "Unable to remove the sponsor.")),
    });
  }

  if (team.isError)
    return (
      <ErrorState
        error={team.error}
        fallback="Unable to load sponsors."
        onRetry={team.refetch}
      />
    );

  const groups = team.sponsors ? groupByLevel(team.sponsors) : [];
  const available =
    team.brands && team.links ? unlinkedBrands(team.brands, team.links) : [];

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Tier decides the order sponsors appear on Live Mode screens.
        </p>
        {canEdit && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus size={16} aria-hidden /> Add sponsor
          </Button>
        )}
      </div>

      {team.isLoading ? (
        <div aria-busy className="grid gap-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Handshake}
          message="No sponsors are linked to this event yet."
        />
      ) : (
        groups.map((group) => (
          <section
            key={group.level}
            aria-label={`${levelLabel(group.level)} sponsors`}
            className="grid gap-3"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <span
                aria-hidden
                className={`size-2.5 rounded-full ${LEVEL_DOT[group.level] ?? "bg-muted-foreground"}`}
              />
              {levelLabel(group.level)}
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3">
              {group.sponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.linkId}
                  sponsor={sponsor}
                  canEdit={canEdit}
                  busy={busy}
                  onMove={(level) => moveTo(sponsor, level)}
                  onRemove={() => setToRemove(sponsor)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <AddSponsorDrawer
        eventId={eventId}
        brands={available}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remove sponsor"
        description={`Remove ${toRemove?.brandName ?? "this sponsor"} from this event? The brand itself is not deleted.`}
        confirmLabel="Remove"
        onConfirm={() => toRemove && confirmRemove(toRemove)}
      />
    </section>
  );
}

/** Satu kartu sponsor: avatar inisial, nama, telepon, dan menu (hanya untuk yang berhak). */
function SponsorCard({
  sponsor,
  canEdit,
  busy,
  onMove,
  onRemove,
}: {
  sponsor: EventSponsor;
  canEdit: boolean;
  busy: boolean;
  onMove: (level: string) => void;
  onRemove: () => void;
}) {
  return (
    <li className="bg-card border-border flex items-center gap-3 rounded-2xl border px-4 py-3.5">
      <span
        aria-hidden
        className="bg-muted text-primary-dark grid size-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold"
      >
        {brandInitials(sponsor.brandName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate">{sponsor.brandName}</b>
        <span className="text-muted-foreground truncate font-mono text-xs">
          {sponsor.phone ?? "-"}
        </span>
      </span>
      {canEdit && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`Actions for ${sponsor.brandName}`}
            >
              <MoreHorizontal size={18} aria-hidden />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="dropdown-content"
              align="end"
              sideOffset={6}
            >
              {SPONSOR_LEVELS.filter((level) => level !== sponsor.level).map(
                (level) => (
                  <DropdownMenu.Item
                    key={level}
                    className="dropdown-item"
                    onSelect={() => onMove(level)}
                  >
                    Move to {levelLabel(level)}
                  </DropdownMenu.Item>
                ),
              )}
              <DropdownMenu.Separator className="bg-border my-1 h-px" />
              <DropdownMenu.Item
                className="dropdown-item text-danger"
                onSelect={onRemove}
              >
                Remove
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </li>
  );
}
