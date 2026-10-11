"use client";
import { useState, type CSSProperties } from "react";
import {
  normalizeScore,
  scoreToPercent,
  sliderStep,
} from "@/domains/judging/scoring";
import type { ScoreCriterion } from "@/domains/competitions/types";
import type { ScoreEntry } from "@/domains/judging/types";

/** Id elemen untuk fokus dan scroll ke kriteria bermasalah. Dipakai juga oleh JudgingBoard. */
export const criterionDomId = (criterionId: string) =>
  `criterion-${criterionId}`;
export const sliderDomId = (criterionId: string) =>
  `criterion-${criterionId}-slider`;
export const noteDomId = (criterionId: string) =>
  `criterion-${criterionId}-note`;

/** Angka skor untuk tampilan: bilangan bulat apa adanya, pecahan satu desimal (7.5). */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Satu kartu kriteria: nama + bobot kecil, nilai besar `82 /100`, slider native, dan catatan.
 * Dipanggil dari JudgingBoard, satu per kriteria.
 * Input: kriteria, nilai tampilan (skor null = belum diisi), `readOnly`, pesan error dari
 * `validateScorecard`, dan callback perubahan skor/catatan.
 * Skor belum diisi: slider berdiri di `min` dengan petunjuk "Not scored yet"; skor baru tercatat
 * saat juri menggeser (atau mengangkat jari dari slider) sehingga `min` pun bisa dipilih.
 * Catatan: kriteria `noteRequired` selalu menampilkan kolom catatan bertanda wajib; yang lain
 * lewat tombol "Add note".
 */
export function CriterionCard({
  criterion,
  entry,
  readOnly,
  error,
  onScore,
  onNote,
}: {
  criterion: ScoreCriterion;
  entry: ScoreEntry;
  readOnly: boolean;
  error?: string;
  onScore: (score: number) => void;
  onNote: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const unset = entry.score === null;
  const shown = entry.score ?? criterion.min;
  const fill = scoreToPercent(criterion, shown);
  const showNote = criterion.noteRequired || noteOpen || entry.note !== "";
  const errorId = `${criterionDomId(criterion.id)}-error`;

  return (
    <div
      id={criterionDomId(criterion.id)}
      className={
        "bg-card grid gap-2 rounded-2xl border p-4 " +
        (error ? "border-danger" : "border-transparent")
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="grid">
          <h3 className="font-bold">{criterion.name}</h3>
          <span className="text-muted-foreground text-xs">
            weight {formatScore(criterion.weight)}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono text-[26px] leading-none font-bold"
            data-testid={`value-${criterion.id}`}
          >
            {formatScore(shown)}
          </span>
          <span className="text-muted-foreground font-mono text-sm">
            /{formatScore(criterion.max)}
          </span>
        </div>
      </div>

      <input
        id={sliderDomId(criterion.id)}
        type="range"
        className="score-slider"
        style={{ "--fill": `${fill}%` } as CSSProperties}
        data-unset={unset}
        min={criterion.min}
        max={criterion.max}
        step={sliderStep(criterion)}
        value={shown}
        disabled={readOnly}
        aria-label={criterion.name}
        aria-valuetext={`${formatScore(shown)} of ${formatScore(criterion.max)}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) =>
          onScore(normalizeScore(criterion, Number(e.currentTarget.value)))
        }
        onPointerUp={(e) => {
          // Skor belum ada dan juri hanya mengetuk di posisi awal: tetap dicatat.
          if (unset)
            onScore(normalizeScore(criterion, Number(e.currentTarget.value)));
        }}
      />

      {unset && !readOnly && (
        <p className="text-muted-foreground text-xs font-semibold">
          Not scored yet
        </p>
      )}
      {unset && readOnly && (
        <p className="text-muted-foreground text-xs font-semibold">No score</p>
      )}

      {showNote && !readOnly && (
        <div className="grid gap-1">
          <label
            htmlFor={noteDomId(criterion.id)}
            className="text-sm font-semibold"
          >
            Note
            {criterion.noteRequired && (
              <span className="text-danger-ink"> (required)</span>
            )}
          </label>
          <textarea
            id={noteDomId(criterion.id)}
            rows={2}
            value={entry.note}
            onChange={(e) => onNote(e.currentTarget.value)}
            aria-required={criterion.noteRequired || undefined}
            aria-invalid={error && criterion.noteRequired ? true : undefined}
            className="border-input bg-card min-h-20 w-full resize-y rounded-xl border p-3 text-sm"
          />
        </div>
      )}
      {readOnly && entry.note !== "" && (
        <p className="text-sm">
          <span className="text-muted-foreground font-semibold">Note: </span>
          {entry.note}
        </p>
      )}
      {!showNote && !readOnly && (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          aria-expanded={false}
          className="text-primary-dark min-h-11 justify-self-start text-sm font-bold"
        >
          Add note
        </button>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-danger-ink text-sm font-semibold"
        >
          {error}
        </p>
      )}
    </div>
  );
}
