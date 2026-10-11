"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDayTime } from "@/domains/competitions/format";
import { resultsCsvRows, timeLabel } from "@/domains/results/format";
import type { CompetitionResults } from "@/domains/results/types";
import { exportCsv } from "@/lib/export-csv";

/** Peringkat 1-3 ada di podium, jadi tabel mulai dari peringkat 4. */
const PODIUM_SIZE = 3;

/**
 * Kartu "Final ranking": tombol Export (CSV seluruh klasemen) dan Verify results, tabel dari
 * peringkat 4 ke bawah dengan paginasi. Teks DNF/DQ/DNS tampil di kolom waktu.
 * Dipanggil dari `CompetitionResults`. Input: klasemen, nama file export, aksi verify dan
 * statusnya. Tombol Verify hanya muncul bila API memberi `actions.verify` (layar tidak menebak).
 */
export function ResultsRanking({
  results,
  fileName,
  onVerify,
  verifying,
}: {
  results: CompetitionResults;
  fileName: string;
  onVerify: () => void;
  verifying: boolean;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const rest = results.rows.slice(PODIUM_SIZE);
  const visible = rest.slice((page - 1) * perPage, page * perPage);

  return (
    <section className="border-border min-w-0 overflow-hidden rounded-2xl border bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="grid gap-0.5">
          <h2 className="text-base font-bold">Final ranking</h2>
          {results.verified && (
            <p className="text-done inline-flex items-center gap-1 text-sm font-semibold">
              <Check size={14} aria-hidden />
              Verified
              {results.verifiedByName ? ` by ${results.verifiedByName}` : ""}
              {results.verifiedAt
                ? `, ${formatDayTime(results.verifiedAt)}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => exportCsv(fileName, resultsCsvRows(results.rows))}
          >
            Export
          </Button>
          {results.actions.verify && (
            <Button onClick={onVerify} disabled={verifying}>
              {verifying ? "Verifying..." : "Verify results"}
            </Button>
          )}
        </div>
      </header>

      {rest.length === 0 ? (
        <p className="border-border text-muted-foreground border-t p-5 text-sm">
          Every participant is on the podium.
        </p>
      ) : (
        <table className="border-border w-full table-fixed border-t text-sm">
          <caption className="sr-only">Final ranking from rank 4</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Pet</th>
              <th scope="col">Owner</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.entryId} className="border-border border-b">
                <td className="w-12 px-5 py-3 font-extrabold">{row.rank}</td>
                <td className="min-w-0 py-3 pr-3">
                  <span className="block truncate font-semibold">
                    {row.petName}
                    {row.bibNumber && (
                      <span className="text-muted-foreground ml-1.5 font-mono text-xs">
                        {row.bibNumber}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate sm:hidden">
                    {row.ownerName}
                  </span>
                </td>
                <td className="text-muted-foreground hidden truncate py-3 pr-3 sm:table-cell">
                  {row.ownerName}
                </td>
                <td className="w-28 px-5 py-3 text-right font-mono font-semibold">
                  {timeLabel(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rest.length > 0 && (
        <Pagination
          page={page}
          perPage={perPage}
          total={rest.length}
          label="participants"
          onPageChange={setPage}
          onPerPageChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
      )}
    </section>
  );
}
