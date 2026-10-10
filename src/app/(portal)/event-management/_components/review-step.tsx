import { Button } from "@/components/ui/button";
import {
  organizerDisplayName,
  picDisplayName,
  type OrganizerChoice,
  type PicChoice,
} from "@/domains/events/create-flow";
import { formatEventSchedule } from "@/domains/events/format";
import { toIsoString, type EventDetails } from "@/domains/events/schema";

/** Satu baris ringkasan: judul kecil + isi. Isi kosong tampil "-". */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold wrap-break-word">{value || "-"}</dd>
    </div>
  );
}

/** Satu kartu ringkasan dengan tombol Edit yang membawa kembali ke langkahnya. */
function SummaryCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border grid gap-3 rounded-2xl border bg-white px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <b className="text-[17px]">{title}</b>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="grid gap-2.5">{children}</dl>
    </section>
  );
}

/**
 * Langkah 3 wizard New event: ringkasan semua isian sebelum disimpan.
 * Layar ini tidak ada di desain (lihat daftar penyimpangan): dibuat dengan pola kartu yang sama.
 * Tidak menyimpan apa pun; tombol "Create event" ada di `EventCreateWizard`.
 * `onEditDetails` dan `onEditOrganizer` membawa pengguna kembali ke langkah yang bersangkutan.
 */
export function ReviewStep({
  details,
  organizer,
  pic,
  onEditDetails,
  onEditOrganizer,
}: {
  details: EventDetails;
  organizer: OrganizerChoice;
  pic: PicChoice | null;
  onEditDetails: () => void;
  onEditOrganizer: () => void;
}) {
  const { date, time } = formatEventSchedule(
    toIsoString(details.startAt),
    toIsoString(details.endAt),
  );
  return (
    <div className="grid gap-4">
      <SummaryCard title="Event" onEdit={onEditDetails}>
        <Row label="Event name" value={details.name} />
        <Row label="Date" value={`${date}, ${time}`} />
        <Row label="Venue" value={details.venueName} />
        <Row label="Venue address" value={details.venueAddress} />
        <Row label="Slogan" value={details.tagline} />
      </SummaryCard>
      <SummaryCard title="Organizer & PIC" onEdit={onEditOrganizer}>
        <Row label="Organizer" value={organizerDisplayName(organizer)} />
        <Row
          label="Event PIC"
          value={
            pic?.kind === "user"
              ? `${pic.name} (${pic.email})`
              : picDisplayName(pic)
          }
        />
      </SummaryCard>
    </div>
  );
}
