import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Satu langkah: label tampil di pil. */
export type StepperStep = { label: string };

/**
 * Indikator langkah wizard berbentuk pil (desain NewEvent): langkah aktif berisi lilac penuh,
 * langkah selesai bercentang hijau dan bisa diklik untuk kembali, langkah berikutnya putih.
 * `current` mulai dari 0. `onStepClick` hanya dipanggil untuk langkah yang sudah selesai.
 * Tanpa pengetahuan domain, dapat dipakai wizard lain.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: StepperStep[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <ol className="m-0 flex list-none flex-wrap gap-2.5 p-0">
      {steps.map((step, index) => {
        const state =
          index === current ? "active" : index < current ? "done" : "todo";
        const pill = cn(
          "flex min-h-11 items-center gap-2.5 rounded-full py-2 pr-4 pl-2 text-sm",
          state === "active" && "bg-primary font-bold text-white",
          state !== "active" &&
            "border-border text-primary-dark border bg-white font-semibold",
        );
        const badge = cn(
          "grid size-7 place-items-center rounded-full text-sm",
          state === "active" && "text-primary bg-white",
          state === "done" && "bg-done-soft text-done",
          state === "todo" && "bg-primary-soft",
        );
        const content = (
          <>
            <span className={badge}>
              {state === "done" ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                index + 1
              )}
            </span>
            {step.label}
          </>
        );
        return (
          <li key={step.label}>
            {state === "done" && onStepClick ? (
              <button
                type="button"
                className={pill}
                onClick={() => onStepClick(index)}
              >
                {content}
              </button>
            ) : (
              <span
                className={pill}
                aria-current={state === "active" ? "step" : undefined}
              >
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
