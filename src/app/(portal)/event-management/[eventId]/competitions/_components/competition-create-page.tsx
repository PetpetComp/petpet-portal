"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { CompetitionSetupError } from "@/domains/competitions/api";
import {
  useCompetitionTypes,
  useCreateCompetition,
  useSpecies,
} from "@/domains/competitions/queries";
import {
  PERIOD_LABEL,
  PERIOD_TYPES,
  equalWeights,
  newCompetitionSchema,
  totalWeight,
  usesCriteria,
  weightsAreComplete,
  type NewCompetition,
  type NewCompetitionValues,
} from "@/domains/competitions/schema";
import type { ResultMode } from "@/domains/competitions/types";
import { useEvent } from "@/domains/events/queries";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const MODE_HINT: Record<ResultMode, string> = {
  TIME: "Fastest time wins",
  POSITION: "Finish order decides",
  CHECKPOINT: "Checkpoints cleared, then time",
  JUDGED_SCORE: "Judges score each criterion",
  COMBINED: "Combines category winners",
};

const DEFAULTS: NewCompetitionValues = {
  name: "",
  typeId: "",
  resultMode: "",
  speciesId: "",
  arenaName: "",
  capacity: "",
  startAt: "",
  endAt: "",
  periods: PERIOD_TYPES.map((type) => ({
    type,
    enabled: type !== "EARLY_BIRD",
    price: 0,
    quota: "",
    startAt: "",
    endAt: "",
  })),
  criteria: [{ name: "", min: 0, max: 10, weight: 100, noteRequired: false }],
};

export function CompetitionCreatePage({ eventId }: { eventId: string }) {
  const router = useRouter();
  const event = useEvent(eventId);
  const types = useCompetitionTypes();
  const species = useSpecies();
  const create = useCreateCompetition(eventId);
  const back = ROUTES.eventManagement.detail(eventId) + "/competitions";

  const form = useForm<NewCompetitionValues, unknown, NewCompetition>({
    resolver: zodResolver(newCompetitionSchema),
    defaultValues: DEFAULTS,
  });
  const { register, control, handleSubmit, setValue, formState } = form;
  const errors = formState.errors;
  const criteria = useFieldArray({ control, name: "criteria" });
  // One registration shared by every radio: the result mode follows the chosen type.
  const typeField = register("typeId", {
    onChange: (e) =>
      setValue(
        "resultMode",
        types.data?.find((t) => t.id === e.target.value)?.resultMode ?? "",
      ),
  });
  const [typeId, resultMode, periods, criteriaValues] = useWatch({
    control,
    name: ["typeId", "resultMode", "periods", "criteria"],
  });
  const judged = usesCriteria(resultMode as ResultMode);
  const weight = totalWeight(criteriaValues ?? []);

  function splitEvenly() {
    equalWeights(criteria.fields.length).forEach((w, i) =>
      setValue(`criteria.${i}.weight`, w, {
        shouldValidate: formState.isSubmitted,
      }),
    );
  }

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Competition created");
        router.push(back);
      },
    }),
  );

  const setupError =
    create.error instanceof CompetitionSetupError ? create.error : null;

  return (
    <form onSubmit={onSubmit} noValidate className="page-stack max-w-5xl">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
      >
        <Link href={ROUTES.eventManagement.root} className="font-semibold">
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link href={back} className="font-semibold">
          {event.data?.name ?? "Event"}
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">Add competition</span>
      </nav>
      <h1>Add competition</h1>

      <Section title="Basics">
        <Labeled label="Name" required error={errors.name?.message}>
          <Input {...register("name")} placeholder="e.g. Paw Sprint 100M" />
        </Labeled>
        <Labeled label="Animal" hint="Leave empty to allow every animal.">
          <Select {...register("speciesId")}>
            <option value="">Any animal</option>
            {species.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Labeled>
        <fieldset className="col-span-full grid gap-2">
          <legend className="mb-2 font-semibold">
            Type <span className="field-required">*</span>
          </legend>
          {types.isPending && (
            <p className="text-muted-foreground">Loading types…</p>
          )}
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {types.data?.map((t) => {
              const on = t.id === typeId;
              return (
                <label
                  key={t.id}
                  className={cn(
                    "grid cursor-pointer gap-1 rounded-xl border p-4",
                    on
                      ? "border-primary bg-primary-soft border-2"
                      : "border-input",
                  )}
                >
                  <input
                    type="radio"
                    value={t.id}
                    className="sr-only"
                    {...typeField}
                  />
                  <b>{t.name}</b>
                  <span className="text-muted-foreground text-sm">
                    {MODE_HINT[t.resultMode] ?? t.resultMode}
                  </span>
                </label>
              );
            })}
          </div>
          <FieldError message={errors.typeId?.message} />
        </fieldset>
      </Section>

      <Section title="Schedule">
        <Labeled label="Starts" required error={errors.startAt?.message}>
          <Input type="datetime-local" {...register("startAt")} />
        </Labeled>
        <Labeled label="Ends" required error={errors.endAt?.message}>
          <Input type="datetime-local" {...register("endAt")} />
        </Labeled>
        <Labeled label="Arena" error={errors.arenaName?.message}>
          <Input {...register("arenaName")} placeholder="e.g. Main Arena" />
        </Labeled>
        <Labeled
          label="Slots"
          hint="Empty means no limit."
          error={errors.capacity?.message}
        >
          <Input type="number" min={1} {...register("capacity")} />
        </Labeled>
      </Section>

      <Section title="Registration channels" wide>
        <p className="text-muted-foreground col-span-full -mt-2 text-sm">
          Each channel has its own price and window. Turn on at least one.
        </p>
        {PERIOD_TYPES.map((type, i) => {
          const on = periods?.[i]?.enabled;
          const err = errors.periods?.[i];
          return (
            <div
              key={type}
              className="border-border col-span-full grid items-start gap-3 rounded-xl border p-4 md:grid-cols-2 lg:grid-cols-[140px_130px_110px_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  {...register(`periods.${i}.enabled`)}
                />
                {PERIOD_LABEL[type]}
              </label>
              <Labeled label="Price (Rp)" error={err?.price?.message}>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  disabled={!on}
                  {...register(`periods.${i}.price`)}
                />
              </Labeled>
              <Labeled label="Quota" error={err?.quota?.message}>
                <Input
                  type="number"
                  min={1}
                  disabled={!on}
                  placeholder="No limit"
                  {...register(`periods.${i}.quota`)}
                />
              </Labeled>
              <Labeled label="Opens" error={err?.startAt?.message}>
                <Input
                  type="datetime-local"
                  disabled={!on}
                  {...register(`periods.${i}.startAt`)}
                />
              </Labeled>
              <Labeled label="Closes" error={err?.endAt?.message}>
                <Input
                  type="datetime-local"
                  disabled={!on}
                  {...register(`periods.${i}.endAt`)}
                />
              </Labeled>
            </div>
          );
        })}
        <FieldError
          message={errors.periods?.root?.message ?? errors.periods?.message}
        />
      </Section>

      {judged && (
        <Section title="Scoring criteria" wide>
          <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Each criterion is scaled to its weight, so ranges can differ:
              <br />
              <span className="font-mono">
                Score = Σ (score ÷ max × weight)
              </span>
              , from 0 to 100.
            </p>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-bold",
                weightsAreComplete(criteriaValues ?? [])
                  ? "bg-[#dcfce7] text-[#166534]"
                  : "bg-[#fef3c7] text-[#92400e]",
              )}
            >
              Total weight {weight}%
            </span>
          </div>
          {criteria.fields.map((field, i) => {
            const err = errors.criteria?.[i];
            return (
              <div
                key={field.id}
                className="border-border col-span-full grid items-start gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,2fr)_90px_90px_100px_auto_auto]"
              >
                <Labeled label="Criterion" error={err?.name?.message}>
                  <Input
                    {...register(`criteria.${i}.name`)}
                    placeholder="e.g. Appearance"
                  />
                </Labeled>
                <Labeled label="Min" error={err?.min?.message}>
                  <Input type="number" {...register(`criteria.${i}.min`)} />
                </Labeled>
                <Labeled label="Max" error={err?.max?.message}>
                  <Input type="number" {...register(`criteria.${i}.max`)} />
                </Labeled>
                <Labeled label="Weight %" error={err?.weight?.message}>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`criteria.${i}.weight`)}
                  />
                </Labeled>
                <label className="flex min-h-11 items-center gap-2 self-end text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    {...register(`criteria.${i}.noteRequired`)}
                  />
                  Note required
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  aria-label={`Remove criterion ${i + 1}`}
                  disabled={criteria.fields.length === 1}
                  onClick={() => criteria.remove(i)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            );
          })}
          <FieldError
            message={errors.criteria?.root?.message ?? errors.criteria?.message}
          />
          <div className="col-span-full flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                criteria.append({
                  name: "",
                  min: 0,
                  max: 10,
                  weight: 0,
                  noteRequired: false,
                })
              }
            >
              <Plus size={16} /> Add criterion
            </Button>
            <Button variant="ghost" onClick={splitEvenly}>
              Split weights evenly
            </Button>
          </div>
        </Section>
      )}

      {create.isError && (
        <div role="alert" className="form-error">
          {create.error.message}{" "}
          {setupError && (
            <Link
              href={ROUTES.eventManagement.competitionDetail(
                eventId,
                setupError.competitionId,
              )}
              className="font-semibold"
            >
              Open the competition to finish setup
            </Link>
          )}
        </div>
      )}

      <div className="border-border sticky bottom-0 flex justify-end gap-2 border-t bg-[var(--color-background)] py-4">
        <Link href={back} className="link-button secondary">
          Cancel
        </Link>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create competition"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  wide = false,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border rounded-2xl border bg-white p-5">
      <h2 className="mb-4">{title}</h2>
      <div className={cn("grid gap-4", !wide && "md:grid-cols-2")}>
        {children}
      </div>
    </section>
  );
}

function Labeled({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>
        {label}
        {required && <span className="field-required">*</span>}
      </span>
      {children}
      {hint && !error && (
        <small className="text-muted-foreground">{hint}</small>
      )}
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <small role="alert" className="col-span-full font-semibold text-[#b91c1c]">
      {message}
    </small>
  );
}
