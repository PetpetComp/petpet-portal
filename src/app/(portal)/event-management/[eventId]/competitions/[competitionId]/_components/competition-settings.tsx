"use client";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { SectionCard } from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayTime } from "@/domains/competitions/format";
import {
  useCloseRegistrationPeriod,
  useCompetition,
  useCompetitionAction,
  useCompetitionRules,
  useCompetitionTypes,
  useRegistrationPeriods,
  useSaveCompetitionSettings,
  useScoreCriteria,
  useSpecies,
} from "@/domains/competitions/queries";
import { PERIOD_LABEL, usesCriteria } from "@/domains/competitions/schema";
import {
  hasNoChanges,
  missingChannelTypes,
  settingsChanges,
  settingsSchema,
  settingsValues,
  type Settings,
  type SettingsValues,
} from "@/domains/competitions/settings";
import {
  currentRule,
  type Competition,
  type CompetitionRule,
  type CompetitionType,
  type RegistrationPeriod,
  type ScoreCriterion,
} from "@/domains/competitions/types";
import { useEvent } from "@/domains/events/queries";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

/**
 * Tab Settings kompetisi (desain Comp-Settings): kartu Rules (rule berversi), tabel Registration
 * channels, banner "Registration closed" + Reopen, dan tombol Save changes. Memuat data lalu
 * menyerahkan ke `SettingsForm`. Hak ubah dibaca dari `canOnEvent`; tanpa hak semua field
 * terkunci dan tombol simpan disembunyikan (backend tetap menegakkan). Dipanggil dari
 * `(workspace)/settings/page.tsx`.
 */
export function CompetitionSettings({
  eventId,
  competitionId,
}: {
  eventId: string;
  competitionId: string;
}) {
  const event = useEvent(eventId);
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const rules = useCompetitionRules(competitionId);
  const periods = useRegistrationPeriods(competitionId);
  const { canOnEvent } = useAuth();

  if (periods.isError)
    return (
      <ErrorState
        error={periods.error}
        fallback="Unable to load the registration channels."
        onRetry={() => periods.refetch()}
      />
    );
  if (!competition.data || !periods.data || rules.isPending || types.isPending)
    return (
      <div className="grid gap-5" aria-busy>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );

  const rule = currentRule(rules.data ?? []);
  const type =
    types.data?.find((t) => t.id === competition.data.typeId) ?? null;
  // Key dari isi server: setelah simpan data baru memuat ulang form dari nol.
  const formKey = JSON.stringify(settingsValues(rule, periods.data));
  return (
    <SettingsForm
      key={formKey}
      eventId={eventId}
      competition={competition.data}
      type={type}
      rule={rule}
      rulesUnavailable={rules.isError}
      periods={periods.data}
      canUpdate={
        !!event.data && canOnEvent(event.data, PERMISSION.COMPETITION_UPDATE)
      }
    />
  );
}

function SettingsForm({
  eventId,
  competition,
  type,
  rule,
  rulesUnavailable,
  periods,
  canUpdate,
}: {
  eventId: string;
  competition: Competition;
  type: CompetitionType | null;
  rule: CompetitionRule | null;
  rulesUnavailable: boolean;
  periods: RegistrationPeriod[];
  canUpdate: boolean;
}) {
  const species = useSpecies();
  const save = useSaveCompetitionSettings(competition.id);
  const closePeriod = useCloseRegistrationPeriod();
  const lifecycle = useCompetitionAction(eventId);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [toClose, setToClose] = useState<{ id: string; label: string } | null>(
    null,
  );

  const resultMode = type?.resultMode ?? "POSITION";
  const judged = usesCriteria(resultMode);
  const criteria = useScoreCriteria(competition.id, judged);
  const rulesLocked = !canUpdate || rulesUnavailable;

  const form = useForm<SettingsValues, unknown, Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsValues(rule, periods),
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;
  const rows = useFieldArray({ control, name: "periods" });
  const watched = useWatch({ control, name: "periods" });
  const free = missingChannelTypes(watched ?? []);

  /** Simpan semua yang berubah; bila tidak ada yang berubah cukup beri tahu. */
  const onSubmit = handleSubmit((values) => {
    const changes = settingsChanges({ values, rule, periods, resultMode });
    if (hasNoChanges(changes)) {
      toast.info("Nothing to save");
      return;
    }
    save.mutate(changes, {
      onSuccess: () => toast.success("Settings saved"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to save settings.",
        ),
    });
  });

  function reopen() {
    lifecycle.mutate(
      { id: competition.id, action: "reopenRegistration" },
      {
        onSuccess: () => toast.success("Registration reopened"),
        onError: (cause) =>
          toast.error(
            cause instanceof Error ? cause.message : "Unable to reopen.",
          ),
      },
    );
  }

  function closeChannel(period: { id: string; label: string }) {
    closePeriod.mutate(period.id, {
      onSuccess: () => toast.success(`${period.label} channel closed`),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to close channel.",
        ),
    });
  }

  const animal = competition.speciesId
    ? (species.data?.find((s) => s.id === competition.speciesId)?.name ?? "")
    : "Any animal";

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-6xl gap-5">
      {!canUpdate && (
        <p className="text-muted-foreground" role="note">
          You can view these settings but not change them.
        </p>
      )}

      <SectionCard
        title={type ? `${type.name} rules` : "Rules"}
        action={
          !judged && (
            <p className="text-muted-foreground text-sm">
              Saving creates a new rule version; past heats keep theirs.
            </p>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="Type">
            <input
              className={fieldClass}
              value={type?.name ?? ""}
              disabled
              readOnly
            />
          </FormField>
          <FormField label="Animal">
            <input className={fieldClass} value={animal} disabled readOnly />
          </FormField>
          {!judged && (
            <>
              <FormField
                label="Lanes per match"
                error={errors.laneTotal?.message}
              >
                <input
                  type="number"
                  min={1}
                  className={fieldClass}
                  disabled={rulesLocked}
                  {...register("laneTotal")}
                />
              </FormField>
              {resultMode === "CHECKPOINT" && (
                <FormField
                  label="Checkpoints"
                  error={errors.checkpointTotal?.message}
                >
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    disabled={rulesLocked}
                    {...register("checkpointTotal")}
                  />
                </FormField>
              )}
              <FormField
                label="Cut-off time"
                hint="Minutes and seconds, for example 01:30."
                error={errors.cutoff?.message}
              >
                <input
                  className={cn(fieldClass, "font-mono")}
                  placeholder="01:30"
                  disabled={rulesLocked}
                  {...register("cutoff")}
                />
              </FormField>
            </>
          )}
        </div>
        {rulesUnavailable && (
          <p className="text-muted-foreground text-sm">
            Rules are not available for your account.
          </p>
        )}
        {judged && (
          <CriteriaSummary
            loading={criteria.isPending}
            failed={criteria.isError}
            rows={criteria.data ?? []}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Registration channels"
        action={
          canUpdate && (
            <Button
              variant="secondary"
              disabled={free.length === 0}
              onClick={() =>
                rows.append({
                  periodId: "",
                  type: free[0],
                  closed: false,
                  price: 0,
                  quota: "",
                  startAt: "",
                  endAt: "",
                })
              }
            >
              <Plus size={16} aria-hidden /> Add channel
            </Button>
          )
        }
      >
        {rows.fields.length === 0 ? (
          <p className="text-muted-foreground">
            No registration channels yet.
            {canUpdate ? " Add one so participants can sign up." : ""}
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="text-muted-foreground text-xs tracking-wide uppercase">
                  <th className="px-5 py-2 font-semibold">Channel</th>
                  <th className="px-2 py-2 font-semibold">Price</th>
                  <th className="px-2 py-2 font-semibold">Quota</th>
                  <th className="px-2 py-2 font-semibold">Opens</th>
                  <th className="px-2 py-2 font-semibold">Closes</th>
                  <th className="px-5 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.fields.map((field, i) => {
                  const row = watched?.[i];
                  const label = PERIOD_LABEL[row?.type ?? field.type];
                  const closed = field.closed;
                  const isNew = field.periodId === "";
                  const err = errors.periods?.[i];
                  const locked = !canUpdate || closed;
                  return (
                    <tr
                      key={field.id}
                      className="border-border border-t align-top"
                    >
                      <td className="px-5 py-3">
                        {isNew ? (
                          <select
                            aria-label={`Channel type of row ${i + 1}`}
                            className={fieldClass}
                            {...register(`periods.${i}.type`)}
                          >
                            {[row?.type ?? field.type, ...free].map(
                              (t, n, all) =>
                                all.indexOf(t) === n ? (
                                  <option key={t} value={t}>
                                    {PERIOD_LABEL[t]}
                                  </option>
                                ) : null,
                            )}
                          </select>
                        ) : (
                          <b className="flex min-h-11 items-center gap-2">
                            {label}
                            {closed && (
                              <span className="text-muted-foreground text-xs font-semibold">
                                Closed
                              </span>
                            )}
                          </b>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          aria-label={`${label} price`}
                          aria-invalid={!!err?.price}
                          className={cn(fieldClass, "font-mono")}
                          disabled={locked}
                          {...register(`periods.${i}.price`)}
                        />
                        <Err message={err?.price?.message} />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min={1}
                          placeholder="No limit"
                          aria-label={`${label} quota`}
                          aria-invalid={!!err?.quota}
                          className={fieldClass}
                          disabled={locked}
                          {...register(`periods.${i}.quota`)}
                        />
                        <Err message={err?.quota?.message} />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="datetime-local"
                          aria-label={`${label} opens`}
                          aria-invalid={!!err?.startAt}
                          className={fieldClass}
                          disabled={locked}
                          {...register(`periods.${i}.startAt`)}
                        />
                        <Err message={err?.startAt?.message} />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="datetime-local"
                          aria-label={`${label} closes`}
                          aria-invalid={!!err?.endAt}
                          className={fieldClass}
                          disabled={locked}
                          {...register(`periods.${i}.endAt`)}
                        />
                        <Err message={err?.endAt?.message} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canUpdate && !closed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              isNew
                                ? `Remove ${label} row`
                                : `Close ${label} channel`
                            }
                            onClick={() =>
                              isNew
                                ? rows.remove(i)
                                : setToClose({
                                    id: field.periodId,
                                    label,
                                  })
                            }
                          >
                            <X size={16} aria-hidden />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Err
          message={errors.periods?.root?.message ?? errors.periods?.message}
        />
      </SectionCard>

      {competition.registrationClosed && (
        <div
          role="status"
          className="border-danger/30 bg-danger-soft flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4"
        >
          <div className="text-danger-ink grid gap-0.5">
            <b>Registration closed</b>
            <span>
              Closed on {formatDayTime(competition.registrationClosedAt)}.
              {competition.actions.reopenRegistration
                ? " Reopening invalidates the current drawing."
                : ""}
            </span>
          </div>
          {competition.actions.reopenRegistration && (
            <Button
              variant="secondary"
              className="border-danger text-danger-ink bg-white"
              disabled={lifecycle.isPending}
              onClick={() => setConfirmReopen(true)}
            >
              Reopen registration
            </Button>
          )}
        </div>
      )}

      {canUpdate && (
        <div className="flex justify-end">
          <Button
            type="submit"
            className="min-h-11 rounded-xl px-5 font-bold"
            disabled={save.isPending || !formState.isDirty}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="Reopen registration"
        description="Registration opens again for this competition. Reopening invalidates the current drawing."
        confirmLabel="Reopen"
        onConfirm={reopen}
      />
      <ConfirmDialog
        open={!!toClose}
        onOpenChange={(open) => !open && setToClose(null)}
        title="Close channel"
        description={`Close the ${toClose?.label ?? ""} channel? Nobody can register through it any more, and a closed channel cannot be added again.`}
        confirmLabel="Close channel"
        onConfirm={() => toClose && closeChannel(toClose)}
      />
    </form>
  );
}

/** Pesan error kecil di bawah sel tabel. */
function Err({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span
      role="alert"
      className="text-danger-ink mt-1 block text-[13px] font-semibold"
    >
      {message}
    </span>
  );
}

/** Ringkasan kriteria untuk jenis yang dinilai juri. Kriteria dibuat saat kompetisi dibuat, di sini hanya dibaca. */
function CriteriaSummary({
  rows,
  loading,
  failed,
}: {
  rows: ScoreCriterion[];
  loading: boolean;
  failed: boolean;
}) {
  if (loading) return <Skeleton className="h-16 w-full" />;
  if (failed)
    return (
      <p className="text-muted-foreground text-sm">
        Judging criteria could not be loaded.
      </p>
    );
  return (
    <div className="grid gap-2">
      <b className="text-sm">Judging criteria</b>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No criteria yet.</p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span>{r.name}</span>
              <span className="text-muted-foreground">
                {r.min} to {r.max}, weight {r.weight}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-sm">
        Criteria are set when the competition is created.
      </p>
    </div>
  );
}
