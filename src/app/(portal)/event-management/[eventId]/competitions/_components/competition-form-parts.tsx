import { SectionCard } from "@/components/common/page-layout";
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
    <SectionCard title={title}>
      <div className={cn("grid gap-4", !wide && "md:grid-cols-2")}>
        {children}
      </div>
    </SectionCard>
  );
}

/**
 * Daftar "label: nilai" satu kolom untuk kartu Summary di kolom samping. Dipanggil dari
 * halaman Add dan Edit competition. Nilai kosong tampil "-". Bukan `<label>` supaya tidak
 * mengganggu pencarian field berdasarkan label.
 */
export function SummaryList({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 items-start justify-between gap-3"
        >
          <dt className="text-muted-foreground shrink-0 text-[13px] font-semibold">
            {item.label}
          </dt>
          <dd className="min-w-0 text-right text-sm font-medium break-words">
            {item.value || "-"}
          </dd>
        </div>
      ))}
    </dl>
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
