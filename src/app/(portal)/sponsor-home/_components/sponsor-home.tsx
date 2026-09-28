"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Handshake, PartyPopper } from "lucide-react";
import { PageHero } from "@/components/common/page-hero";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { SPONSOR_SERVICES } from "@/services/sponsorship-brand";
import { EVENT_SERVICES } from "@/services/event-management";
import { EVENT_SPONSOR_SERVICES } from "@/services/event-operations";
import { collectRows } from "@/services/common";
import { formatDate } from "@/lib/format/date";
import type { Row } from "@/services/backend-records";
import "./sponsor-home.css";

export function SponsorHome() {
  const { user } = useAuth();
  const capabilities = useCapabilities();
  const [localSponsorId, setLocalSponsorId] = useState<string | null>(null);
  const sponsorId = capabilities.sponsorId ?? localSponsorId;
  const [brandName, setBrandName] = useState("");
  const [pending, setPending] = useState(false);
  const [events, setEvents] = useState<Row[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [applyingId, setApplyingId] = useState("");

  useEffect(() => {
    if (!sponsorId) return;
    let active = true;
    collectRows(EVENT_SERVICES.list)
      .then((loadedEvents) =>
        Promise.all(
          loadedEvents.map((event) =>
            collectRows((params) => EVENT_SPONSOR_SERVICES.list(String(event.uuid), params)),
          ),
        ).then((linksByEvent) => {
          if (!active) return;
          setLoadError("");
          setEvents(loadedEvents);
          setApplications(linksByEvent.flat().filter((link) => link.sponsor_uuid === sponsorId));
        }),
      )
      .catch((cause) => {
        if (active)
          setLoadError(cause instanceof Error ? cause.message : "Unable to load events.");
      });
    return () => {
      active = false;
    };
  }, [sponsorId, reloadToken]);

  async function createProfile() {
    if (!user || !brandName.trim()) return;
    setPending(true);
    try {
      const created = await SPONSOR_SERVICES.create({ brand_name: brandName.trim() });
      await SPONSOR_SERVICES.addPic(created.data.uuid, user.id);
      toast.success("Profil sponsor berhasil dibuat");
      setLocalSponsorId(created.data.uuid);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to create sponsor profile.");
    } finally {
      setPending(false);
    }
  }

  async function apply(eventId: string) {
    if (!sponsorId) return;
    setApplyingId(eventId);
    try {
      await EVENT_SPONSOR_SERVICES.create(eventId, {
        sponsor_id: sponsorId,
        sponsorship_level: "BRONZE",
      });
      toast.success("Pengajuan terkirim — menunggu persetujuan organizer");
      setReloadToken((token) => token + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to apply.");
    } finally {
      setApplyingId("");
    }
  }

  if (!sponsorId) {
    return (
      <div className="sponsor-onboarding">
        <span className="sponsor-onboarding-icon">
          <Handshake size={28} aria-hidden="true" />
        </span>
        <h1>Jadi Sponsor</h1>
        <p>Buat profil brand-mu dulu, baru bisa ajukan sponsorship ke event.</p>
        <Field label="Nama brand">
          <Input
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            placeholder="Whiskas Indonesia"
            disabled={pending}
          />
        </Field>
        <Button onClick={createProfile} disabled={pending || !brandName.trim()} className="sponsor-onboarding-submit">
          {pending ? "Menyimpan..." : "Buat profil sponsor"}
        </Button>
      </div>
    );
  }

  return (
    <div className="sponsor-home">
      <PageHero
        eyebrow="Sponsor Petpet"
        title="Cari event yang cocok buat brand-mu"
        description="Ajukan sponsorship ke event yang sedang dibuka — organizer yang review."
      />
      {loadError && <p role="alert">{loadError}</p>}
      {events.length === 0 ? (
        <EmptyState icon={PartyPopper} message="Belum ada event yang dibuka buat sponsor." />
      ) : (
        <div className="sponsor-event-grid">
          {events.map((event) => {
            const application = applications.find(
              (item) => item.event_uuid === event.uuid,
            );
            return (
              <article key={String(event.uuid)} className="sponsor-event-card">
                <h3>{String(event.name ?? "")}</h3>
                <span className="sponsor-meta">
                  <CalendarDays size={14} aria-hidden="true" />
                  {event.start_at ? formatDate(String(event.start_at)) : "-"}
                </span>
                <div className="sponsor-event-footer">
                  {application ? (
                    <StatusBadge status={String(application.status ?? "pending")} />
                  ) : (
                    <button
                      type="button"
                      className="cta-pill"
                      disabled={applyingId === String(event.uuid)}
                      onClick={() => apply(String(event.uuid))}
                    >
                      {applyingId === String(event.uuid) ? "Mengajukan..." : "Ajukan sponsor"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
