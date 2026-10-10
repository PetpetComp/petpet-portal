import { cn } from "@/lib/utils";

/** Satu pilihan tab. `count` opsional, tampil abu di samping label. */
export type SegmentedTab<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

/**
 * Kelompok tab berbentuk "segmen" (desain Events: All / Event day / Upcoming / ...).
 * Mengatur satu nilai terpilih; yang memuat data sesuai nilai itu adalah pemanggil.
 * Memakai role="tablist" dan aria-selected seperti desain.
 */
export function SegmentedTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="bg-primary-soft inline-flex max-w-full gap-1 overflow-x-auto rounded-xl p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "min-h-9 shrink-0 rounded-[9px] px-3.5 text-sm whitespace-nowrap",
              selected
                ? "text-foreground bg-white font-bold shadow-xs"
                : "text-primary-dark font-semibold",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-muted-foreground ml-1.5 font-semibold">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
