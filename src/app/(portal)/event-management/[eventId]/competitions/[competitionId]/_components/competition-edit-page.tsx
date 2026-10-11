"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Forbidden } from "@/components/common/can";
import { PageColumns, SectionCard } from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
  useSpecies,
  useUpdateCompetition,
} from "@/domains/competitions/queries";
import {
  editCompetitionSchema,
  editToApi,
  editValuesFromCompetition,
  type EditCompetition,
  type EditCompetitionValues,
} from "@/domains/competitions/schema";
import type { Competition } from "@/domains/competitions/types";
import { useEvent } from "@/domains/events/queries";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { formatDayTime } from "@/domains/competitions/format";
import {
  Labeled,
  Section,
  SummaryList,
} from "../../_components/competition-form-parts";
import {
  CompetitionLoadError,
  CompetitionNotFound,
} from "./competition-load-error";

/** Nama field API di 422 -> nama field form Edit. */
const API_FIELD_TO_FORM: Record<string, keyof EditCompetitionValues> = {
  name: "name",
  description: "description",
  arena_name: "arenaName",
  capacity: "capacity",
  scheduled_start_at: "startAt",
  scheduled_end_at: "endAt",
};

/**
 * Halaman Edit competition (`.../competitions/[competitionId]/edit`, di luar grup tab).
 * Memuat kompetisi dan event, memeriksa hak (hanya menyembunyikan halaman; backend tetap
 * menegakkan), lalu menampilkan form dasar yang sudah terisi. Dipanggil dari `edit/page.tsx`.
 */
export function CompetitionEditPage({
  eventId,
  competitionId,
}: {
  eventId: string;
  competitionId: string;
}) {
  const event = useEvent(eventId);
  const competition = useCompetition(competitionId);
  const { canOnEvent } = useAuth();

  if (competition.isError)
    return (
      <CompetitionLoadError
        error={competition.error}
        eventId={eventId}
        onRetry={() => competition.refetch()}
      />
    );
  if (!competition.data || !event.data)
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  if (competition.data.eventId !== eventId)
    return <CompetitionNotFound eventId={eventId} />;
  if (!canOnEvent(event.data, PERMISSION.COMPETITION_UPDATE))
    return <Forbidden />;
  return (
    <CompetitionEditForm
      eventId={eventId}
      eventName={event.data.name}
      competition={competition.data}
    />
  );
}

/**
 * Form Edit yang sudah terisi dari `competition`. Jenis, hewan, channel registrasi, dan
 * kriteria tidak ikut diubah di sini (backend tidak menerimanya di PATCH): channel diatur
 * di tab Settings. Pesan 422 server dikembalikan ke field-nya, selain itu jadi toast.
 */
function CompetitionEditForm({
  eventId,
  eventName,
  competition,
}: {
  eventId: string;
  eventName: string;
  competition: Competition;
}) {
  const router = useRouter();
  const update = useUpdateCompetition(competition.id);
  const types = useCompetitionTypes();
  const species = useSpecies();
  const typeName =
    types.data?.find((t) => t.id === competition.typeId)?.name ?? "";
  const animalName = competition.speciesId
    ? (species.data?.find((sp) => sp.id === competition.speciesId)?.name ?? "")
    : "Any animal";
  const back = ROUTES.eventManagement.competitionDetail(
    eventId,
    competition.id,
  );

  const form = useForm<EditCompetitionValues, unknown, EditCompetition>({
    resolver: zodResolver(editCompetitionSchema),
    defaultValues: editValuesFromCompetition(competition),
  });
  const { register, handleSubmit, setError, formState } = form;
  const errors = formState.errors;
  // Nilai terkini untuk kartu Summary di kolom samping (hanya tampilan).
  const [watchedName, watchedStartAt, watchedEndAt] = useWatch({
    control: form.control,
    name: ["name", "startAt", "endAt"],
  });

  const onSubmit = handleSubmit((values) =>
    update.mutate(editToApi(values), {
      onSuccess: () => {
        toast.success("Competition updated");
        router.push(back);
      },
      onError: (cause) => {
        const fieldErrors =
          cause instanceof ApiError && cause.errors ? cause.errors : {};
        const known = Object.entries(fieldErrors).filter(
          ([field]) => field in API_FIELD_TO_FORM,
        );
        if (known.length > 0) {
          for (const [field, messages] of known)
            setError(API_FIELD_TO_FORM[field], { message: messages[0] });
          return;
        }
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Unable to save the competition.",
        );
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="page-stack">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
      >
        <Link href={ROUTES.eventManagement.root} className="font-semibold">
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link
          href={ROUTES.eventManagement.detail(eventId)}
          className="font-semibold"
        >
          {eventName}
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link href={back} className="font-semibold">
          {competition.name}
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">Edit</span>
      </nav>
      <h1>Edit competition</h1>

      <PageColumns
        main={
          <>
            <Section title="Basics">
              <Labeled label="Name" required error={errors.name?.message}>
                <Input {...register("name")} />
              </Labeled>
              <Labeled label="Arena" error={errors.arenaName?.message}>
                <Input
                  {...register("arenaName")}
                  placeholder="e.g. Main Arena"
                />
              </Labeled>
              <div className="md:col-span-2">
                <Labeled
                  label="Description"
                  error={errors.description?.message}
                >
                  <Textarea rows={3} {...register("description")} />
                </Labeled>
              </div>
            </Section>

            <Section title="Schedule">
              <Labeled label="Starts" required error={errors.startAt?.message}>
                <Input type="datetime-local" {...register("startAt")} />
              </Labeled>
              <Labeled label="Ends" required error={errors.endAt?.message}>
                <Input type="datetime-local" {...register("endAt")} />
              </Labeled>
              <Labeled
                label="Slots"
                hint="Empty means no limit."
                error={errors.capacity?.message}
              >
                <Input type="number" min={1} {...register("capacity")} />
              </Labeled>
            </Section>
          </>
        }
        aside={
          <div className="grid gap-5 xl:sticky xl:top-4">
            <SectionCard title="Summary">
              <SummaryList
                items={[
                  { label: "Name", value: watchedName?.trim() },
                  { label: "Type", value: typeName },
                  { label: "Animal", value: animalName },
                  { label: "Starts", value: formatDayTime(watchedStartAt) },
                  { label: "Ends", value: formatDayTime(watchedEndAt) },
                ]}
              />
              <p className="text-muted-foreground text-sm">
                The type and animal are fixed when a competition is created.
                Registration channels and rules are managed in the Settings tab.
              </p>
            </SectionCard>
            <SectionCard>
              <Button
                type="submit"
                disabled={update.isPending}
                className="min-h-11 w-full"
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Link
                href={back}
                className="link-button secondary w-full justify-center"
              >
                Cancel
              </Link>
            </SectionCard>
          </div>
        }
      />
    </form>
  );
}
