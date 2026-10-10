import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kelas untuk `<input>`, `<select>`, dan `<textarea>` bergaya desain: tinggi minimal 44px,
 * sudut 12px, garis token `input`, cincin fokus lilac. Dipakai bersama `FormField`.
 */
export const fieldClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-input bg-white px-3.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary-soft disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";

/**
 * Label + kontrol + petunjuk + pesan error untuk satu field form.
 * Dipakai oleh form Event (create dan edit) dan dapat dipakai form lain.
 * `error` menggantikan `hint` bila ada. Pesan error memakai role="alert" supaya dibacakan.
 */
export function FormField({
  label,
  required = false,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <b className="text-sm">
        {label}
        {required && <span className="text-danger-ink ml-1">*</span>}
      </b>
      {children}
      {error ? (
        <span
          role="alert"
          className="text-danger-ink text-[13px] font-semibold"
        >
          {error}
        </span>
      ) : (
        hint && (
          <span className="text-muted-foreground text-[13px]">{hint}</span>
        )
      )}
    </label>
  );
}
