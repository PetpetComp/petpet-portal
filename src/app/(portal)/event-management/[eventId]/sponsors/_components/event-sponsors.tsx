"use client";
import { useState } from "react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Handshake, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PageColumns, SectionCard } from "@/components/common/page-layout";
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
  type Brand,
  type EventSponsor,
  type SponsorGroup,
} from "@/domains/sponsors/types";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { AddSponsorDrawer } from "./add-sponsor-drawer";

/** Warna titik di batang ringkasan. Tier tak dikenal abu-abu. */
const LEVEL_DOT: Record<string, string> = {
  PLATINUM: "bg-slate-600",
  GOLD: "bg-amber-600",
  SILVER: "bg-slate-400",
  BRONZE: "bg-orange-800",
  MEDIA_PARTNER: "bg-blue-600",
};

/** Warna latar tile inisial dan chip tier (tint lembut per tier). */
const LEVEL_TINT: Record<string, string> = {
  PLATINUM: "bg-slate-100 text-slate-700",
  GOLD: "bg-amber-100 text-amber-800",
  SILVER: "bg-slate-100 text-slate-600",
  BRONZE: "bg-orange-100 text-orange-900",
  MEDIA_PARTNER: "bg-blue-100 text-blue-800",
};
const FALLBACK_TINT = "bg-muted text-primary-dark";

/**
 * Ukuran kartu per tier (efek "sponsor wall"): grid lebih lebar dan tile lebih besar untuk tier
 * tinggi. Kelas ditulis utuh supaya Tailwind bisa mendeteksinya.
 */
const LEVEL_GRID: Record<string, string> = {
  PLATINUM: "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]",
  GOLD: "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]",
};
const DEFAULT_GRID =
  "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]";
const LEVEL_TILE: Record<string, string> = {
  PLATINUM: "size-16 text-lg",
  GOLD: "size-14 text-base",
};
const DEFAULT_TILE = "size-11 text-sm";

/** Jumlah brand yang ditampilkan pada kartu "Brands not sponsoring yet". */
const SUGGESTION_LIMIT = 6;

const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/** Isian awal drawer Add sponsor; `nonce` berubah tiap dibuka supaya drawer di-remount. */
type DrawerPreset = { nonce: number; brandId: string; level: string };

/**
 * Tab Sponsors (F2.4): sponsor event dikelompokkan per tier (kontrak 13 bagian 4).
 * Dipanggil dari `(workspace)/sponsors/page.tsx`. Menambah, memindah tier, dan menghapus hanya
 * muncul bila pengguna berhak `event.update` pada event ini (backend tetap yang memutuskan).
 * Tata letak: kolom utama = satu kartu per tier, kolom samping = ringkasan + brand yang belum
 * jadi sponsor.
 */
export function EventSponsors({ eventId }: { eventId: string }) {
  const { canOnEvent } = useAuth();
  const event = useEvent(eventId);
  const team = useEventSponsorTeam(eventId);
  const remove = useRemoveSponsor(eventId);
  const changeLevel = useChangeSponsorLevel(eventId);
  const [drawer, setDrawer] = useState<DrawerPreset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toRemove, setToRemove] = useState<EventSponsor | null>(null);
  const [search, setSearch] = useState("");

  const canEdit =
    !!event.data && canOnEvent(event.data, PERMISSION.EVENT_UPDATE);
  const busy = remove.isPending || changeLevel.isPending;

  /** Membuka drawer Add sponsor, opsional dengan brand/tier terpilih (drawer di-remount). */
  function openDrawer(brandId = "", level = "GOLD") {
    setDrawer((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, brandId, level }));
    setDrawerOpen(true);
  }

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

  const allSponsors = team.sponsors ?? [];
  const term = search.trim().toLowerCase();
  const visible = term
    ? allSponsors.filter((s) => s.brandName.toLowerCase().includes(term))
    : allSponsors;
  const groups = groupByLevel(visible);
  const available =
    team.brands && team.links ? unlinkedBrands(team.brands, team.links) : [];
  const emailByBrand = new Map((team.brands ?? []).map((b) => [b.id, b.email]));

  // Tier yang ditampilkan: semua tier baku (kosong pun tampil) + tier tak dikenal yang punya data.
  const extraLevels = groupByLevel(allSponsors)
    .map((g) => g.level)
    .filter((level) => !(SPONSOR_LEVELS as readonly string[]).includes(level));
  const tierList: string[] = [...SPONSOR_LEVELS, ...extraLevels];
  const groupOf = (level: string): SponsorGroup | undefined =>
    groups.find((g) => g.level === level);

  const noSponsors = !team.isLoading && allSponsors.length === 0;

  const main = team.isLoading ? (
    <div aria-busy className="grid gap-5">
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  ) : noSponsors ? (
    <SectionCard>
      <EmptyState
        icon={Handshake}
        message="No sponsors are linked to this event yet."
      />
    </SectionCard>
  ) : (
    <>
      <ListToolbar
        searchLabel="Search sponsors"
        search={search}
        onSearchChange={setSearch}
      />
      {term && visible.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No sponsor matches this search.
        </p>
      )}
      {tierList
        .filter((level) => !term || groupOf(level))
        .map((level) => (
          <TierSection
            key={level}
            level={level}
            sponsors={groupOf(level)?.sponsors ?? []}
            emailOf={(brandId) => emailByBrand.get(brandId) ?? null}
            canEdit={canEdit}
            busy={busy}
            onMove={moveTo}
            onRemove={setToRemove}
            onAdd={() => openDrawer("", level)}
          />
        ))}
    </>
  );

  const aside = team.isLoading ? (
    <>
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </>
  ) : (
    <>
      <SummaryCard
        total={allSponsors.length}
        counts={tierList.map((level) => ({
          level,
          count: allSponsors.filter((s) => s.level === level).length,
        }))}
      />
      <SuggestionsCard
        brands={available.slice(0, SUGGESTION_LIMIT)}
        total={available.length}
        canEdit={canEdit}
        onAdd={(brandId) => openDrawer(brandId)}
      />
    </>
  );

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Tier decides the order sponsors appear on Live Mode screens.
        </p>
        {canEdit && (
          <Button onClick={() => openDrawer()}>
            <Plus size={16} aria-hidden /> Add sponsor
          </Button>
        )}
      </div>

      <PageColumns main={main} aside={aside} />

      <AddSponsorDrawer
        key={drawer?.nonce ?? 0}
        eventId={eventId}
        brands={available}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialBrandId={drawer?.brandId}
        initialLevel={drawer?.level}
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

/**
 * Satu kartu seksi per tier: grid kartu sponsor, atau kotak putus-putus bila tier kosong.
 * Dipanggil dari `EventSponsors`. Ukuran kartu mengikuti tier (platinum paling besar).
 */
function TierSection({
  level,
  sponsors,
  emailOf,
  canEdit,
  busy,
  onMove,
  onRemove,
  onAdd,
}: {
  level: string;
  sponsors: EventSponsor[];
  emailOf: (brandId: string) => string | null;
  canEdit: boolean;
  busy: boolean;
  onMove: (sponsor: EventSponsor, level: string) => void;
  onRemove: (sponsor: EventSponsor) => void;
  onAdd: () => void;
}) {
  return (
    <SectionCard
      title={levelLabel(level)}
      description={
        sponsors.length > 0
          ? `${sponsors.length} ${sponsors.length === 1 ? "sponsor" : "sponsors"}`
          : undefined
      }
    >
      {sponsors.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-4 text-sm">
          <span>No sponsors in this tier</span>
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onAdd}
              aria-label={`Add ${levelLabel(level)} sponsor`}
            >
              <Plus size={14} aria-hidden /> Add
            </Button>
          )}
        </div>
      ) : (
        <ul
          aria-label={`${levelLabel(level)} sponsors`}
          className={cn("grid gap-3", LEVEL_GRID[level] ?? DEFAULT_GRID)}
        >
          {sponsors.map((sponsor) => (
            <SponsorCard
              key={sponsor.linkId}
              sponsor={sponsor}
              email={emailOf(sponsor.brandId)}
              canEdit={canEdit}
              busy={busy}
              onMove={(next) => onMove(sponsor, next)}
              onRemove={() => onRemove(sponsor)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Kartu samping "Sponsorship summary": total sponsor dan batang jumlah per tier. */
function SummaryCard({
  total,
  counts,
}: {
  total: number;
  counts: { level: string; count: number }[];
}) {
  return (
    <SectionCard title="Sponsorship summary">
      <p className="text-3xl font-extrabold">
        {total}
        <span className="text-muted-foreground ml-2 text-sm font-semibold">
          {total === 1 ? "sponsor" : "sponsors"}
        </span>
      </p>
      <ul className="grid gap-3">
        {counts.map(({ level, count }) => (
          <li key={level} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 rounded-full",
                    LEVEL_DOT[level] ?? "bg-muted-foreground",
                  )}
                />
                {levelLabel(level)}
              </span>
              <span className="text-muted-foreground font-mono">{count}</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full",
                  LEVEL_DOT[level] ?? "bg-muted-foreground",
                )}
                style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** Kartu samping "Brands not sponsoring yet": maksimal enam brand dengan tombol Add cepat. */
function SuggestionsCard({
  brands,
  total,
  canEdit,
  onAdd,
}: {
  brands: Brand[];
  total: number;
  canEdit: boolean;
  onAdd: (brandId: string) => void;
}) {
  return (
    <SectionCard
      title="Brands not sponsoring yet"
      description={total > 0 ? `${total} available` : undefined}
    >
      {brands.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Every brand is already linked to this event.
        </p>
      ) : (
        <ul className="grid gap-2">
          {brands.map((brand) => (
            <li key={brand.id} className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-muted text-primary-dark grid size-9 shrink-0 place-items-center rounded-lg text-xs font-extrabold"
              >
                {brandInitials(brand.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {brand.name}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onAdd(brand.id)}
                  aria-label={`Add ${brand.name} as sponsor`}
                >
                  Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        href={ROUTES.sponsorshipBrand}
        className="text-primary text-sm font-semibold hover:underline"
      >
        View all brands
      </Link>
    </SectionCard>
  );
}

/** Satu kartu sponsor: tile inisial, nama, chip tier, kontak, dan menu (hanya untuk yang berhak). */
function SponsorCard({
  sponsor,
  email,
  canEdit,
  busy,
  onMove,
  onRemove,
}: {
  sponsor: EventSponsor;
  email: string | null;
  canEdit: boolean;
  busy: boolean;
  onMove: (level: string) => void;
  onRemove: () => void;
}) {
  const tint = LEVEL_TINT[sponsor.level] ?? FALLBACK_TINT;
  return (
    <li className="bg-card border-border flex items-center gap-3 rounded-2xl border px-4 py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-xl font-extrabold",
          LEVEL_TILE[sponsor.level] ?? DEFAULT_TILE,
          tint,
        )}
      >
        {brandInitials(sponsor.brandName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="line-clamp-2 break-words">{sponsor.brandName}</b>
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-[11px] font-bold",
            tint,
          )}
        >
          {levelLabel(sponsor.level)}
        </span>
        <span className="text-muted-foreground truncate font-mono text-xs">
          {sponsor.phone ?? "-"}
        </span>
        {email && (
          <span className="text-muted-foreground truncate text-xs">
            {email}
          </span>
        )}
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
