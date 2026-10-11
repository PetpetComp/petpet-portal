"use client";
import Link from "next/link";
import {
  PageColumns,
  InfoList,
  SectionCard,
} from "@/components/common/page-layout";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayTime, formatWindow } from "@/domains/competitions/format";
import {
  progressSteps,
  type ProgressStep,
} from "@/domains/competitions/overview";
import {
  useCompetition,
  useCompetitionRules,
  useCompetitionTypes,
  useRegistrationPeriods,
  useScoreCriteria,
  useSpecies,
} from "@/domains/competitions/queries";
import { PERIOD_LABEL, usesCriteria } from "@/domains/competitions/schema";
import { formatCutoff } from "@/domains/competitions/settings";
import {
  COMPETITION_STATUS_LABEL,
  REGISTRATION_CLOSED_REASON_LABEL,
  currentRule,
  type Competition,
} from "@/domains/competitions/types";
import { PAYMENT_LABEL } from "@/domains/entries/types";
import { useEventEntries } from "@/domains/entries/queries";
import { useAssignmentRoles, useEventStaff } from "@/domains/staff/queries";
import { roleLabel } from "@/domains/staff/roles";
import { rupiah } from "@/lib/format/label";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const BAR_COLOR: Record<ProgressStep["state"], string> = {
  done: "bg-done",
  active: "bg-race",
  idle: "bg-muted",
};

/**
 * Tab Overview kompetisi (desain A-Competition): kartu Progress, tiga angka ringkas, lima
 * peserta terbaru, lalu di kolom samping detail, rules, Registration & pricing, dan Committee.
 * Semua data lewat hook domain dan berbagi cache dengan header dan tab Settings.
 * Data yang gagal dimuat (mis. peserta untuk akun tanpa hak) hanya mengosongkan kartunya,
 * tidak menjatuhkan halaman. Dipanggil dari `(workspace)/page.tsx`.
 */
export function CompetitionOverview({
  eventId,
  competitionId,
}: {
  eventId: string;
  competitionId: string;
}) {
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const species = useSpecies();
  const periods = useRegistrationPeriods(competitionId);
  const rules = useCompetitionRules(competitionId);
  const roles = useAssignmentRoles();
  const staff = useEventStaff(eventId);
  const recent = useEventEntries(eventId, {
    competitionId,
    sort: "registered_at",
    direction: "desc",
    page: 1,
    perPage: 5,
  });
  const paid = useEventEntries(eventId, {
    competitionId,
    payment: "PAID",
    page: 1,
    perPage: 1,
  });

  const c = competition.data;
  const type = c && types.data?.find((t) => t.id === c.typeId);
  const judged = !!type && usesCriteria(type.resultMode);
  const criteria = useScoreCriteria(competitionId, judged);

  if (!c)
    return (
      <div className="grid gap-5" aria-busy>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  const summary = recent.data?.summary ?? null;
  const steps = progressSteps(
    c,
    summary ? { total: summary.total, checkedIn: summary.checkedIn } : null,
  );
  const base = ROUTES.eventManagement.competitionDetail(eventId, competitionId);
  const rule = currentRule(rules.data ?? []);
  const members = (staff.data ?? []).filter(
    (m) => m.competitionId === competitionId,
  );

  return (
    <PageColumns
      main={
        <>
          <ProgressCard steps={steps} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
            <Stat
              label="Entries"
              value={summary?.total}
              failed={recent.isError}
              note={summary ? `${summary.approved} approved` : ""}
            />
            <Stat
              label="Checked in"
              value={summary?.checkedIn}
              failed={recent.isError}
              note={summary ? `of ${summary.total} entries` : ""}
            />
            <Stat
              label="Paid"
              value={paid.data?.meta.total}
              failed={paid.isError}
              note="payments received"
            />
          </div>
          <SectionCard
            title="Participants"
            action={
              summary && summary.total > 0 ? (
                <Link
                  href={base + "/participants"}
                  className="text-primary font-semibold"
                >
                  View all {summary.total}
                </Link>
              ) : undefined
            }
          >
            <ParticipantsTable
              loading={recent.isPending}
              failed={recent.isError}
              rows={recent.data?.items ?? []}
            />
          </SectionCard>
          {judged && (
            <SectionCard
              title="Judging criteria"
              description="Each score is scaled to its weight; the weights add up to 100."
            >
              <CriteriaList
                loading={criteria.isPending}
                failed={criteria.isError}
                rows={criteria.data ?? []}
              />
            </SectionCard>
          )}
        </>
      }
      aside={
        <>
          <SectionCard title="Details">
            <InfoList
              items={[
                { label: "Type", value: type?.name },
                {
                  label: "Animal",
                  value: c.speciesId
                    ? species.data?.find((s) => s.id === c.speciesId)?.name
                    : "Any animal",
                },
                { label: "Status", value: COMPETITION_STATUS_LABEL[c.status] },
                { label: "Arena", value: c.arenaName },
                { label: "Starts", value: formatDayTime(c.startAt) },
                { label: "Ends", value: formatDayTime(c.endAt) },
                {
                  label: "Slots",
                  value: c.capacity === null ? "No limit" : String(c.capacity),
                },
                {
                  label: "Registration",
                  value: <RegistrationBadge competition={c} />,
                },
              ]}
            />
          </SectionCard>
          <SectionCard title="Registration & pricing">
            <PricingList
              loading={periods.isPending}
              failed={periods.isError}
              rows={periods.data ?? []}
              settingsHref={base + "/settings"}
            />
          </SectionCard>
          <SectionCard title={judged ? "Judging" : "Rules"}>
            {judged ? (
              <InfoList
                items={[
                  { label: "Minimum judges", value: String(c.minimumJudges) },
                ]}
              />
            ) : rule ? (
              <InfoList
                items={[
                  {
                    label: "Lanes per match",
                    value: rule.laneTotal?.toString(),
                  },
                  {
                    label: "Cut-off time",
                    value: formatCutoff(rule.timeLimitMs),
                  },
                  ...(rule.checkpointTotal !== null
                    ? [
                        {
                          label: "Checkpoints",
                          value: String(rule.checkpointTotal),
                        },
                      ]
                    : []),
                  { label: "Rule version", value: `v${rule.version}` },
                ]}
              />
            ) : (
              <p className="text-muted-foreground">
                {rules.isError ? (
                  "Rules are not available for your account."
                ) : (
                  <>
                    No rules saved yet.{" "}
                    <Link
                      href={base + "/settings"}
                      className="text-primary font-semibold"
                    >
                      Set them in Settings
                    </Link>
                  </>
                )}
              </p>
            )}
          </SectionCard>
          <SectionCard
            title="Committee"
            action={
              <Link
                href={base + "/committee"}
                className="text-primary font-semibold"
              >
                Manage
              </Link>
            }
          >
            {staff.isError ? (
              <p className="text-muted-foreground">
                Not available for your account.
              </p>
            ) : staff.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">No one assigned yet.</p>
            ) : (
              <ul className="grid gap-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 truncate">{m.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {roleLabel(roles.data ?? [], m.role)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      }
    />
  );
}

/** Kartu Progress: lima bar berwarna dengan catatan di bawahnya. */
function ProgressCard({ steps }: { steps: ProgressStep[] }) {
  return (
    <SectionCard title="Progress">
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-4">
        {steps.map((s) => (
          <li key={s.label} className="grid gap-1.5">
            <div
              className="bg-muted h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={`${s.label} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={s.percent}
            >
              <div
                className={cn("h-full rounded-full", BAR_COLOR[s.state])}
                style={{ width: `${s.percent}%` }}
              />
            </div>
            <b>{s.label}</b>
            <span
              className={cn(
                "text-sm",
                s.state === "active"
                  ? "text-race font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {s.note}
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

/** Kartu angka. `value` undefined = sedang dimuat atau gagal; `failed` menampilkan "-" . */
function Stat({
  label,
  value,
  note,
  failed,
}: {
  label: string;
  value: number | undefined;
  note: string;
  failed: boolean;
}) {
  return (
    <div className="border-border grid gap-1 rounded-2xl border bg-white px-5 py-4">
      <span className="text-muted-foreground">{label}</span>
      <b className="font-display text-[30px] leading-9">
        {failed ? "-" : (value ?? "...")}
      </b>
      <span className="text-muted-foreground">
        {failed ? "Not available for your account" : note}
      </span>
    </div>
  );
}

/** Lima peserta terbaru: Pet, Owner, Variant, Payment. */
function ParticipantsTable({
  rows,
  loading,
  failed,
}: {
  rows: {
    id: string;
    petName: string | null;
    ownerName: string;
    petMorphName: string | null;
    payment: keyof typeof PAYMENT_LABEL;
  }[];
  loading: boolean;
  failed: boolean;
}) {
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (failed)
    return (
      <p className="text-muted-foreground">
        Participants are not available for your account.
      </p>
    );
  if (rows.length === 0)
    return <p className="text-muted-foreground">No participants yet.</p>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left">
        <thead>
          <tr className="text-muted-foreground text-xs tracking-wide uppercase">
            <th className="px-5 py-2 font-semibold">Pet</th>
            <th className="px-3 py-2 font-semibold">Owner</th>
            <th className="px-3 py-2 font-semibold">Variant</th>
            <th className="px-5 py-2 font-semibold">Payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-border border-t">
              <td className="px-5 py-3 font-bold">{r.petName ?? "Team"}</td>
              <td className="px-3 py-3">{r.ownerName}</td>
              <td className="px-3 py-3">{r.petMorphName ?? "-"}</td>
              <td className="px-5 py-3">
                <StatusBadge status={PAYMENT_LABEL[r.payment]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Badge Open / Closed dengan alasan dari backend (`registration_closed_reason`). */
function RegistrationBadge({ competition }: { competition: Competition }) {
  if (competition.registrationOpen) return <StatusBadge status="Open" />;
  return (
    <StatusBadge
      status="Closed"
      label={
        competition.registrationClosedReason
          ? REGISTRATION_CLOSED_REASON_LABEL[
              competition.registrationClosedReason
            ]
          : "Closed"
      }
    />
  );
}

/** Kartu Registration & pricing: satu baris per channel dengan jendela waktu dan harga. */
function PricingList({
  rows,
  loading,
  failed,
  settingsHref,
}: {
  rows: {
    id: string;
    type: keyof typeof PERIOD_LABEL;
    price: number;
    startAt: string;
    endAt: string;
    status: "ACTIVE" | "CLOSED";
  }[];
  loading: boolean;
  failed: boolean;
  settingsHref: string;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (failed)
    return (
      <p className="text-muted-foreground">Channels could not be loaded.</p>
    );
  if (rows.length === 0)
    return (
      <p className="text-muted-foreground">
        No registration channels yet.{" "}
        <Link href={settingsHref} className="text-primary font-semibold">
          Add one in Settings
        </Link>
      </p>
    );
  return (
    <ul className="grid gap-3">
      {rows.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-0.5">
            <b>
              {PERIOD_LABEL[p.type]}
              {p.status === "CLOSED" && (
                <span className="text-muted-foreground ml-2 text-xs font-semibold">
                  Closed
                </span>
              )}
            </b>
            <span className="text-muted-foreground text-sm">
              {formatWindow(p.startAt, p.endAt)}
            </span>
          </div>
          <b className="shrink-0 font-mono">{rupiah(p.price)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Daftar kriteria penilaian: nama, rentang skor, dan bobot. Hanya untuk jenis yang dinilai juri. */
function CriteriaList({
  rows,
  loading,
  failed,
}: {
  rows: {
    id: string;
    name: string;
    min: number;
    max: number;
    weight: number;
    noteRequired: boolean;
  }[];
  loading: boolean;
  failed: boolean;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (failed)
    return (
      <p className="text-muted-foreground">Criteria could not be loaded.</p>
    );
  if (rows.length === 0)
    return <p className="text-muted-foreground">No criteria yet.</p>;
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <div className="grid gap-0.5">
            <b>{r.name}</b>
            <span className="text-muted-foreground text-sm">
              Score {r.min} to {r.max}
              {r.noteRequired ? ", note required" : ""}
            </span>
          </div>
          <b>{r.weight}%</b>
        </li>
      ))}
    </ul>
  );
}
