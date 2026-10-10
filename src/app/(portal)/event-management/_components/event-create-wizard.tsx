"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { ApiError } from "@/lib/api-client";
import {
  WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  hasErrors,
  organizerDisplayName,
  picDisplayName,
  validateOrganizerStep,
  type OrganizerChoice,
  type OrganizerStepErrors,
  type PicChoice,
  type WizardStep,
} from "@/domains/events/create-flow";
import { formatEventSchedule } from "@/domains/events/format";
import { useCreateEvent } from "@/domains/events/queries";
import {
  EMPTY_EVENT_DETAILS,
  eventDetailsSchema,
  serverErrorsToFormErrors,
  toIsoString,
  type EventDetails,
  type EventDetailsValues,
} from "@/domains/events/schema";
import { ROUTES } from "@/lib/constants/routes";
import { EventAvatar } from "./event-avatar";
import { EventDetailsFields } from "./event-details-fields";
import { EventPhaseBadge } from "./event-phase-badge";
import { OrganizerStep } from "./organizer-step";
import { ReviewStep } from "./review-step";

/**
 * Wizard New event (`/event-management/create`), 3 langkah sesuai desain:
 * Event -> Organizer & PIC -> Review. Tiap langkah divalidasi sebelum lanjut.
 * Tidak ada yang dikirim ke server sebelum tombol "Create event" di langkah Review.
 * Isi langkah 1 dipegang react-hook-form di sini supaya tetap ada saat pindah langkah;
 * pilihan organizer dan PIC dipegang state biasa (logikanya di domains/events/create-flow.ts).
 */
export function EventCreateWizard() {
  const router = useRouter();
  const create = useCreateEvent();
  const [step, setStep] = useState<WizardStep>("details");
  const [organizer, setOrganizer] = useState<OrganizerChoice | null>(null);
  const [pic, setPic] = useState<PicChoice | null>(null);
  const [stepErrors, setStepErrors] = useState<OrganizerStepErrors>({});
  const [submitError, setSubmitError] = useState("");

  const form = useForm<EventDetailsValues, unknown, EventDetails>({
    resolver: zodResolver(eventDetailsSchema),
    defaultValues: EMPTY_EVENT_DETAILS,
  });
  const values = useWatch({ control: form.control });
  const stepIndex = WIZARD_STEPS.indexOf(step);

  /** Langkah 1 -> 2: lanjut hanya bila isian event valid. */
  async function continueToOrganizer() {
    if (await form.trigger()) setStep("organizer");
  }

  /** Langkah 2 -> 3: lanjut hanya bila organizer dipilih dan PIC (bila ada) valid. */
  function continueToReview() {
    const errors = validateOrganizerStep(organizer, pic);
    setStepErrors(errors);
    if (!hasErrors(errors)) setStep("review");
  }

  /** Langkah 3: simpan event, lalu undang PIC. Pesan 422 server dikembalikan ke field-nya. */
  const confirm = form.handleSubmit((details) => {
    if (!organizer) return;
    setSubmitError("");
    create.mutate(
      { details, organizer, pic },
      {
        onSuccess: (outcome) => {
          toast.success(`Event "${outcome.eventName}" created`);
          if (outcome.inviteError)
            toast.warning(
              `The PIC invitation was not sent: ${outcome.inviteError} Invite them from the Committee tab.`,
            );
          router.push(ROUTES.eventManagement.detail(outcome.eventId));
        },
        onError: (cause) => {
          const fieldErrors =
            cause instanceof ApiError
              ? serverErrorsToFormErrors(cause.errors)
              : {};
          if (Object.keys(fieldErrors).length > 0) {
            for (const [field, message] of Object.entries(fieldErrors))
              form.setError(field as keyof EventDetailsValues, { message });
            setStep("details");
            return;
          }
          setSubmitError(
            cause instanceof Error
              ? cause.message
              : "Unable to create the event.",
          );
        },
      },
    );
  });

  /** Klik pada langkah yang sudah selesai di Stepper: kembali ke langkah itu. */
  function goToStep(index: number) {
    setStep(WIZARD_STEPS[index]);
  }

  const orgName = organizerDisplayName(organizer);
  const picName = pic ? picDisplayName(pic) : "The PIC";

  return (
    <div className="grid gap-5.5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex items-center gap-2"
      >
        <Link
          href={ROUTES.eventManagement.root}
          className="text-primary font-semibold"
        >
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">New event</span>
      </nav>
      <h1 className="font-display text-[32px] leading-10 font-bold">
        New event
      </h1>
      <Stepper
        steps={WIZARD_STEPS.map((s) => ({ label: WIZARD_STEP_LABEL[s] }))}
        current={stepIndex}
        onStepClick={goToStep}
      />

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_520px]">
          {step === "details" && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void continueToOrganizer();
              }}
              className="border-border grid gap-4.5 rounded-2xl border bg-white p-6 sm:grid-cols-2"
            >
              <EventDetailsFields
                register={form.register}
                errors={form.formState.errors}
                name={values.name ?? ""}
                phase="DRAFT"
              />
              <div className="flex justify-between gap-3 pt-1.5 sm:col-span-2">
                <Link
                  href={ROUTES.eventManagement.root}
                  className="text-primary-dark flex min-h-11 items-center rounded-xl px-4 font-bold"
                >
                  Cancel
                </Link>
                <Button
                  type="submit"
                  className="min-h-11 rounded-xl px-5.5 font-bold"
                >
                  Continue to organizer
                </Button>
              </div>
            </form>
          )}

          {step === "organizer" && (
            <div className="grid gap-4">
              <OrganizerStep
                organizer={organizer}
                onOrganizerChange={setOrganizer}
                pic={pic}
                onPicChange={setPic}
                errors={stepErrors}
              />
              <div className="flex justify-between gap-3">
                <Button
                  variant="ghost"
                  className="min-h-11 rounded-xl font-bold"
                  onClick={() => setStep("details")}
                >
                  Back
                </Button>
                <Button
                  className="min-h-11 rounded-xl px-5.5 font-bold"
                  onClick={continueToReview}
                >
                  Review event
                </Button>
              </div>
            </div>
          )}

          {step === "review" && organizer && (
            <div className="grid gap-4">
              <ReviewStep
                details={eventDetailsSchema.parse(form.getValues())}
                organizer={organizer}
                pic={pic}
                onEditDetails={() => setStep("details")}
                onEditOrganizer={() => setStep("organizer")}
              />
              {submitError && (
                <p role="alert" className="form-error">
                  {submitError}
                </p>
              )}
              <div className="flex justify-between gap-3">
                <Button
                  variant="ghost"
                  className="min-h-11 rounded-xl font-bold"
                  onClick={() => setStep("organizer")}
                  disabled={create.isPending}
                >
                  Back
                </Button>
                <Button
                  className="min-h-11 rounded-xl px-5.5 font-bold"
                  onClick={() => void confirm()}
                  disabled={create.isPending}
                >
                  {create.isPending ? "Creating..." : "Create event"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
          {step === "details" && <ListPreview values={values} />}
          {step === "organizer" && (
            <SidePanel title="WHAT HAPPENS">
              <span>
                The event is listed under <b>{orgName}</b>.
              </span>
              <span>
                <b>{picName}</b> becomes Event manager: can edit the event and
                invite committee and judges.
              </span>
              <span className="text-primary-dark">
                The PIC does not have to be an organization member. Nothing is
                saved until Review.
              </span>
            </SidePanel>
          )}
          {step === "review" && (
            <SidePanel title="WHAT HAPPENS">
              <span>
                The event is created as a <b>Draft</b> under <b>{orgName}</b>.
              </span>
              <span>
                {pic ? (
                  <>
                    <b>{picName}</b> gets an email invitation to be Event
                    manager.
                  </>
                ) : (
                  "No PIC is invited. Organization owners and admins can still manage the event."
                )}
              </span>
              <span className="text-primary-dark">
                Publish it from the event page when it is ready.
              </span>
            </SidePanel>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Kartu lilac "WHAT HAPPENS" di sisi kanan langkah 2 dan 3. */
function SidePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="text-muted-foreground text-xs font-bold tracking-[0.08em]">
        {title}
      </div>
      <div className="bg-primary-soft grid gap-2.5 rounded-2xl p-4.5 leading-5.25">
        {children}
      </div>
    </>
  );
}

/**
 * Pratinjau baris event seperti di list ("PREVIEW IN EVENT LIST") yang ikut berubah
 * selagi mengetik. Tanggal ditampilkan hanya bila keduanya sudah diisi.
 */
function ListPreview({ values }: { values: Partial<EventDetailsValues> }) {
  const name = values.name?.trim() || "Untitled event";
  const hasDates = !!values.startAt && !!values.endAt;
  const date = hasDates
    ? formatEventSchedule(
        toIsoString(values.startAt as string),
        toIsoString(values.endAt as string),
      ).date
    : "";
  const meta = [date, values.venueName?.trim()].filter(Boolean).join(" · ");
  return (
    <>
      <div className="text-muted-foreground text-xs font-bold tracking-[0.08em]">
        PREVIEW IN EVENT LIST
      </div>
      <div className="border-border flex items-center gap-3 rounded-2xl border bg-white p-4">
        <EventAvatar name={name} phase="DRAFT" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="wrap-break-word">{name}</b>
          {meta && <span className="text-muted-foreground">{meta}</span>}
        </span>
        <EventPhaseBadge event={{ phase: "DRAFT", status: "DRAFT" }} />
      </div>
      <p className="text-muted-foreground leading-5">
        Competitions, prices and committee are added after the event is created,
        from the event page.
      </p>
    </>
  );
}
