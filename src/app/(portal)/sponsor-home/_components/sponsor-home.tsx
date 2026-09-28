"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { useAuth } from "@/hooks/use-auth";
import { useCapabilities } from "@/hooks/use-capabilities";
import { SPONSOR_SERVICES } from "@/services/sponsorship-brand";
import { EVENT_SERVICES } from "@/services/event-management";
import { EVENT_SPONSOR_SERVICES } from "@/services/event-operations";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";

type IdRow = Row & { id: string };
const withId = (row: Row): IdRow => ({ ...row, id: String(row.uuid) });

export function SponsorHome() {
  const { user } = useAuth();
  const capabilities = useCapabilities();
  const [localSponsorId, setLocalSponsorId] = useState<string | null>(null);
  const sponsorId = capabilities.sponsorId ?? localSponsorId;
  const [brandName, setBrandName] = useState("");
  const [pending, setPending] = useState(false);
  const [events, setEvents] = useState<IdRow[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState("");

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
          setEvents(loadedEvents.map(withId));
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
      toast.success("Sponsor profile created");
      setLocalSponsorId(created.data.uuid);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to create sponsor profile.");
    } finally {
      setPending(false);
    }
  }

  async function apply(eventId: string) {
    if (!sponsorId) return;
    try {
      await EVENT_SPONSOR_SERVICES.create(eventId, {
        sponsor_id: sponsorId,
        sponsorship_level: "BRONZE",
      });
      toast.success("Application sent — waiting for organizer approval");
      setReloadToken((token) => token + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to apply.");
    }
  }

  if (!sponsorId) {
    return (
      <div className="page-stack">
        <PageHeading title="Jadi Sponsor" description="Buat profil brand-mu dulu." />
        <Field label="Nama brand">
          <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} disabled={pending} />
        </Field>
        <Button onClick={createProfile} disabled={pending || !brandName.trim()}>
          {pending ? "Menyimpan..." : "Buat profil sponsor"}
        </Button>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeading title="Event yang Dibuka untuk Sponsor" />
      {loadError && <p role="alert">{loadError}</p>}
      <DataTable
        label="Events"
        rows={events}
        columns={[
          { key: "name", label: "Event", value: (row) => String(row.name ?? "") },
          {
            key: "status",
            label: "Status pengajuan",
            value: (row) =>
              String(
                applications.find((application) => application.event_uuid === row.uuid)
                  ?.status ?? "-",
              ),
          },
        ]}
        actions={(row) =>
          applications.some((application) => application.event_uuid === row.uuid) ? null : (
            <Button size="sm" onClick={() => apply(String(row.uuid))}>
              Ajukan sponsor
            </Button>
          )
        }
      />
    </div>
  );
}
