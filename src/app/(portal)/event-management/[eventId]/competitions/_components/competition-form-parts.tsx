import { cn } from "@/lib/utils";

/**
 * Bagian form yang dipakai bersama halaman Add competition dan Edit competition:
 * kartu seksi, field berlabel, dan pesan error field.
 */

export function Section({
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

export function Labeled({
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

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <small role="alert" className="col-span-full font-semibold text-[#b91c1c]">
      {message}
    </small>
  );
}
