import { detailLabel, timeLabel } from "@/domains/results/format";
import type { ResultRow, ResultVariant } from "@/domains/results/types";
import { cn } from "@/lib/utils";

/** Gaya per peringkat: juara 1 gelap dan lebih tinggi, angka emas (desain Comp-Results). */
const PLACE_STYLE: Record<
  1 | 2 | 3,
  { card: string; numeral: string; order: string; text: string }
> = {
  1: {
    card: "bg-foreground text-white sm:min-h-[234px]",
    numeral: "text-[#f5c542]",
    order: "order-1 sm:order-2",
    text: "text-white/75",
  },
  2: {
    card: "bg-white text-foreground border border-border sm:min-h-[188px]",
    numeral: "text-[#5b6b82]",
    order: "order-2 sm:order-1",
    text: "text-muted-foreground",
  },
  3: {
    card: "bg-white text-foreground border border-border sm:min-h-[166px]",
    numeral: "text-event-day-ink",
    order: "order-3",
    text: "text-muted-foreground",
  },
};

/** Lebar kolom podium menurut jumlah peserta di podium, supaya 1 atau 2 peserta tetap di tengah. */
const PODIUM_COLUMNS: Record<number, string> = {
  1: "sm:mx-auto sm:max-w-xs sm:grid-cols-1",
  2: "sm:mx-auto sm:max-w-2xl sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

/**
 * Podium juara 1 sampai 3. Di layar lebar urutannya 2-1-3 dengan juara 1 menjulang;
 * di HP menumpuk dari juara 1 ke bawah. Nama hewan, pemilik, dan waktu (font mono) dibaca
 * dari baris API; status selain FINISHED tampil sebagai teks (DNF, DQ, DNS).
 * Contest menampilkan nilai juri (mis. "73.0") dan jumlah juri; Time trial jumlah attempt.
 * Dipanggil dari `CompetitionResults`. Input: tiga baris pertama klasemen dan jenisnya.
 */
export function ResultsPodium({
  rows,
  variant,
}: {
  rows: ResultRow[];
  variant: ResultVariant;
}) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  return (
    <ol
      aria-label="Podium"
      className={cn(
        "grid grid-cols-1 items-end gap-4",
        PODIUM_COLUMNS[top.length],
      )}
    >
      {top.map((row, index) => {
        const place = (index + 1) as 1 | 2 | 3;
        const style = PLACE_STYLE[place];
        return (
          <li
            key={row.entryId}
            data-place={place}
            className={cn(
              "flex min-w-0 flex-col justify-end gap-1 rounded-2xl p-5",
              style.card,
              style.order,
            )}
          >
            <span
              aria-label={`Rank ${row.rank}`}
              className={cn(
                "text-4xl leading-none font-extrabold",
                style.numeral,
              )}
            >
              {row.rank}
            </span>
            <span className="mt-3 truncate text-xl font-bold">
              {row.petName}
              {row.bibNumber && (
                <span className="ml-1.5 font-mono text-base font-semibold opacity-70">
                  {row.bibNumber}
                </span>
              )}
            </span>
            <span className={cn("truncate text-sm", style.text)}>
              {row.ownerName}
            </span>
            <span className="mt-1 font-mono text-base font-bold">
              {timeLabel(row, variant)}
            </span>
            {detailLabel(row, variant) && (
              <span className={cn("text-xs", style.text)}>
                {detailLabel(row, variant)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
