"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { SelectField } from "@/components/common/select-field";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { useCapabilities } from "@/hooks/use-capabilities";
import { EVENT_SERVICES } from "@/services/event-management";
import { ORGANIZATION_SERVICES, mapOrganization } from "@/services/organization";
import { collectRows } from "@/services/common";
import { formatDateTime } from "@/lib/format/date";
import { isDuplicateEventName, isValidDateRange } from "../_lib/event-rules";
import type { Organization } from "@/types/organization";

const BASE_PATH = "/event-management";
const STEPS = ["Event", "Organizer", "Review"] as const;

export function EventCreateWizard() {
  const router = useRouter();
  const { data, refresh } = usePortalData();
  const capabilities = useCapabilities();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [mapLocation, setMapLocation] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [organizationId, setOrganizationId] = useState(() =>
    !capabilities.isSuperAdmin ? (capabilities.organizationIds[0] ?? "") : "",
  );
  const [newOrganizationName, setNewOrganizationName] = useState("");

  const myOrganization = capabilities.organizationIds[0]
    ? organizations.find((org) => org.id === capabilities.organizationIds[0])
    : undefined;

  useEffect(() => {
    let active = true;
    collectRows(ORGANIZATION_SERVICES.list)
      .then((rows) => {
        if (active) setOrganizations(rows.map(mapOrganization));
      })
      .finally(() => {
        if (active) setLoadingOrganizations(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function goToStep2() {
    if (!name.trim()) return setError("Event name is required.");
    if (isDuplicateEventName(data.events, { id: "", name })) {
      return setError("An event with this name already exists.");
    }
    if (!startAt || !endAt) return setError("Start and end date are required.");
    if (!isValidDateRange(startAt, endAt)) {
      return setError("End date must be after the start date.");
    }
    setError("");
    setStep(2);
  }

  function goToStep3() {
    if (capabilities.isSuperAdmin) {
      if (!organizationId && !newOrganizationName.trim()) {
        return setError("Select an existing organization or name a new one.");
      }
    } else if (!organizationId && !newOrganizationName.trim()) {
      return setError("Enter your organization's name.");
    }
    setError("");
    setStep(3);
  }

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await EVENT_SERVICES.create({
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        venue_name: venueName.trim() || undefined,
        venue_address: venueAddress.trim() || undefined,
        map_location: mapLocation.trim() || undefined,
        timezone,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        ...(organizationId
          ? { organization_id: organizationId }
          : { new_organization: { name: newOrganizationName.trim() } }),
      });
      await refresh();
      toast.success("Event created");
      router.push(BASE_PATH + "/" + response.data.uuid);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create event.");
      setSubmitting(false);
    }
  }

  const selectedOrganizationName = organizationId
    ? organizations.find((org) => org.id === organizationId)?.name
    : newOrganizationName.trim()
      ? newOrganizationName.trim() + " (new)"
      : "";

  return (
    <div className="page-stack">
      <header>
        <h1>Create New Event</h1>
        <p className="muted">Create the event and confirm its organizer in one guided flow.</p>
      </header>
      <ol className="wizard-stepper">
        {STEPS.map((label, index) => (
          <li key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}>
            <b>{step > index + 1 ? <Check size={13} /> : index + 1}</b>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="form-section">
          <h2>Event Information</h2>
          <p className="muted">Enter the primary event information. Event name must be unique.</p>
          <div className="form-grid">
            <div className="form-grid-span-2">
              <Field label="Event Name *">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
            </div>
            <div className="form-grid-span-2">
              <Field label="Tagline">
                <Input
                  placeholder="Optional event tagline"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                />
              </Field>
            </div>
            <div className="form-grid-span-2">
              <Field label="Description">
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
              </Field>
            </div>
            <Field label="Start Date *">
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </Field>
            <Field label="End Date *">
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
              />
            </Field>
            <Field label="Venue">
              <Input value={venueName} onChange={(event) => setVenueName(event.target.value)} />
            </Field>
            <Field label="Venue Address">
              <Input value={venueAddress} onChange={(event) => setVenueAddress(event.target.value)} />
            </Field>
            <Field label="Map Location">
              <Input value={mapLocation} onChange={(event) => setMapLocation(event.target.value)} />
            </Field>
            <Field label="Timezone">
              <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </Field>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => router.push(BASE_PATH)}>
              Cancel
            </Button>
            <Button onClick={goToStep2}>Continue</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="form-section">
          <h2>Organizer</h2>
          {capabilities.isSuperAdmin ? (
            <>
              <p className="muted">
                Select an existing organization for this event, or name a new one.
              </p>
              <Field label="Organization">
                <SelectField
                  items={organizations}
                  value={organizationId}
                  onChange={(id) => {
                    setOrganizationId(id);
                    if (id) setNewOrganizationName("");
                  }}
                  getId={(org) => org.id}
                  getLabel={(org) => org.name}
                  placeholder={loadingOrganizations ? "Loading organizations..." : "Search organization"}
                  emptyLabel="No organization found."
                />
              </Field>
              {!organizationId && (
                <Field label="Or create organization named">
                  <Input
                    value={newOrganizationName}
                    onChange={(event) => setNewOrganizationName(event.target.value)}
                    placeholder="New organization name"
                  />
                </Field>
              )}
            </>
          ) : myOrganization ? (
            <>
              <p className="muted">This event will be created under your organization.</p>
              <div className="detail-grid">
                <div>
                  <dt>Organization</dt>
                  <dd>{myOrganization.name}</dd>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                You&apos;re not part of an organization yet. Name one to create it along with this
                event.
              </p>
              <Field label="Organization Name *">
                <Input
                  value={newOrganizationName}
                  onChange={(event) => setNewOrganizationName(event.target.value)}
                  placeholder="Your organization's name"
                />
              </Field>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={goToStep3}>Review Event</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="form-section">
          <h2>Review &amp; Confirm</h2>
          <p className="muted">Review the event details before it&apos;s created.</p>
          <dl className="detail-grid">
            <div>
              <dt>Event Name</dt>
              <dd>{name}</dd>
            </div>
            {tagline && (
              <div>
                <dt>Tagline</dt>
                <dd>{tagline}</dd>
              </div>
            )}
            <div>
              <dt>Start Date</dt>
              <dd>{formatDateTime(new Date(startAt).toISOString())}</dd>
            </div>
            <div>
              <dt>End Date</dt>
              <dd>{formatDateTime(new Date(endAt).toISOString())}</dd>
            </div>
            {venueName && (
              <div>
                <dt>Venue</dt>
                <dd>{venueName}</dd>
              </div>
            )}
            <div>
              <dt>Organizer</dt>
              <dd>{selectedOrganizationName || myOrganization?.name}</dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={submitting}>
              Edit Data
            </Button>
            <Button onClick={() => void confirm()} disabled={submitting}>
              {submitting ? "Creating..." : "Confirm & Create Event"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
