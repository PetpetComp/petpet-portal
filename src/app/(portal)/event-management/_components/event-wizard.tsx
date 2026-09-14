"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { ImageInput } from "@/components/ui/image-input";
import { SearchSelect } from "@/components/common/search-select";
import { formatDateTime } from "@/lib/format/date";
import { generateUniqueSlug } from "@/lib/identity";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import type { PortalRecord } from "@/types/portal";
import { eventInitials, isDuplicateEventName, isValidDateRange } from "../_lib/event-rules";

const BASE_PATH = "/event-management";

export function EventWizard({
  mode,
  event,
  events,
  brands,
  users,
  onSaveEvent,
  onCreateBrand,
  onCreateUser,
  onAssignCommittee,
}: {
  mode: "create" | "edit";
  event?: PortalRecord;
  events: PortalRecord[];
  brands: PortalRecord[];
  users: PortalRecord[];
  onSaveEvent: (record: PortalRecord) => void;
  onCreateBrand: (brand: PortalRecord) => void;
  onCreateUser: (user: PortalRecord) => void;
  onAssignCommittee: (committee: PortalRecord) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [eventId] = useState(
    () => event?.id ?? "EVT-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  );
  const [name, setName] = useState(event?.name ?? "");
  const [slogan, setSlogan] = useState(event?.slogan ?? "");
  const [startDate, setStartDate] = useState(event?.startDate?.slice(0, 16) ?? "");
  const [endDate, setEndDate] = useState(event?.endDate?.slice(0, 16) ?? "");
  const [address, setAddress] = useState(event?.address ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [photo, setPhoto] = useState(event?.photo ?? "");

  const [organizerBrandId, setOrganizerBrandId] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandPhone, setBrandPhone] = useState("");
  const [brandCampaign, setBrandCampaign] = useState("");
  const [brandLogo, setBrandLogo] = useState("");

  const [picUserId, setPicUserId] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [picFirstName, setPicFirstName] = useState("");
  const [picLastName, setPicLastName] = useState("");
  const [picEmail, setPicEmail] = useState("");
  const [picPhone, setPicPhone] = useState("");

  const [organizerName, setOrganizerName] = useState(event?.organizer ?? "");
  const [organizerLogo, setOrganizerLogo] = useState(event?.organizerLogo ?? "");

  const [error, setError] = useState("");

  function goToStep2() {
    if (!name.trim()) return setError("Event name is required.");
    if (isDuplicateEventName(events, { id: eventId, name })) {
      return setError("An event with this name already exists.");
    }
    if (!startDate || !endDate) return setError("Start and end date are required.");
    if (!isValidDateRange(startDate, endDate)) {
      return setError("End date must be after the start date.");
    }
    setError("");
    setStep(2);
  }

  function goToStep3() {
    if (mode === "create") {
      const organizerReady =
        organizerBrandId ||
        (creatingBrand && brandName.trim() && isValidPhone(brandPhone));
      if (!organizerReady) return setError("Select or create an organizer.");
      const picReady =
        picUserId ||
        (creatingUser && picFirstName.trim() && isValidPhone(picPhone) && isValidEmail(picEmail));
      if (!picReady) return setError("Select or create an organizer PIC.");
    } else if (!organizerName.trim()) {
      return setError("Organizer is required.");
    }
    setError("");
    setStep(3);
  }

  function confirm() {
    const record: PortalRecord = {
      id: eventId,
      name,
      slogan,
      photo,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      address,
      location,
      organizer: mode === "edit" ? organizerName : "",
      organizerLogo: mode === "edit" ? organizerLogo : "",
      status: event?.status ?? "Pending",
    };
    if (mode === "create") {
      let picId = picUserId;
      if (creatingUser) {
        picId = "USR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
        const username = generateUniqueSlug(
          picFirstName + (picLastName ? "." + picLastName : ""),
          users.map((user) => user.username),
        );
        onCreateUser({
          id: picId,
          name: picFirstName + (picLastName ? " " + picLastName : ""),
          username,
          firstName: picFirstName,
          lastName: picLastName,
          email: picEmail,
          phone: picPhone,
          gender: "",
          dob: "",
          address: "",
          city: "",
          province: "",
          nation: "",
        });
      }
      let brandId = organizerBrandId;
      let resolvedOrganizer = brands.find((brand) => brand.id === organizerBrandId);
      if (creatingBrand) {
        brandId = "BRD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
        const newBrand: PortalRecord = {
          id: brandId,
          name: brandName,
          phone: brandPhone,
          campaign: brandCampaign,
          logo: brandLogo,
          email: "",
          instagramId: "",
          tiktokId: "",
          facebookId: "",
          youtubeId: "",
          threadsId: "",
          xId: "",
          picUserIds: picId,
        };
        onCreateBrand(newBrand);
        resolvedOrganizer = newBrand;
      }
      record.organizer = resolvedOrganizer?.name ?? "";
      record.organizerLogo = resolvedOrganizer?.logo ?? "";
      onAssignCommittee({
        id: "COM-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        name: "Committee " + eventId,
        eventId,
        userId: picId,
        role: "Event PIC",
      });
    }
    onSaveEvent(record);
    toast.success(mode === "edit" ? "Event updated" : "Event created");
    router.push(BASE_PATH + "/" + eventId);
  }

  const steps = mode === "create" ? ["Event", "Organizer & PIC", "Review"] : ["Event", "Organizer", "Review"];

  return (
    <div className="page-stack">
      <header>
        <h1>{mode === "edit" ? "Edit Event" : "Create New Event"}</h1>
        <p className="muted">
          {mode === "edit"
            ? "Update the event, organizer, and schedule."
            : "Create the event, organizer, and PIC in one guided flow."}
        </p>
      </header>
      <ol className="wizard-stepper">
        {steps.map((label, index) => (
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
              <Field label="Event Slogan / Theme">
                <Input
                  placeholder="Optional event slogan or theme"
                  value={slogan}
                  onChange={(event) => setSlogan(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Start Date *">
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="End Date *">
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
            <div className="form-grid-span-2">
              <Field label="Address">
                <Input value={address} onChange={(event) => setAddress(event.target.value)} />
              </Field>
            </div>
            <div className="form-grid-span-2">
              <Field label="Location">
                <Input value={location} onChange={(event) => setLocation(event.target.value)} />
              </Field>
            </div>
            <div className="form-grid-span-2">
              <Field label="Event Photo">
                <ImageInput
                  value={photo}
                  onChange={setPhoto}
                  initials={eventInitials(name || "Event")}
                />
              </Field>
            </div>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Link className="link-button secondary" href={mode === "edit" ? BASE_PATH + "/" + eventId : BASE_PATH}>
              Cancel
            </Link>
            <Button onClick={goToStep2}>Continue</Button>
          </div>
        </section>
      )}
      {step === 2 && mode === "create" && (
        <section className="form-section">
          <h2>Organizer &amp; PIC</h2>
          <p className="muted">
            Select an existing organizer, or create a new organizer and its PIC
            in the same step.
          </p>
          <Field label="Organizer *">
            <SearchSelect
              items={brands}
              value={organizerBrandId}
              onChange={(id) => {
                setOrganizerBrandId(id);
                if (id) setCreatingBrand(false);
              }}
              getId={(brand) => brand.id}
              getLabel={(brand) => brand.name}
              getDescription={(brand) => brand.phone}
              placeholder="Type organizer brand name"
              renderEmpty={() =>
                creatingBrand ? (
                  <span className="search-select-empty">Fill in the organizer details below.</span>
                ) : (
                  <button
                    type="button"
                    className="search-select-add-new"
                    onClick={() => setCreatingBrand(true)}
                  >
                    Organizer not found. Create a new organizer.
                  </button>
                )
              }
            />
          </Field>
          {creatingBrand && (
            <div className="inline-user-form">
              <div className="eyebrow">New Organizer</div>
              <p className="muted">Complete the organizer details before assigning its PIC.</p>
              <div className="form-grid">
                <Field label="Organizer Brand Name *">
                  <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
                </Field>
                <Field label="Phone *">
                  <Input
                    inputMode="numeric"
                    maxLength={15}
                    placeholder="08xxxxxxxxxx"
                    value={brandPhone}
                    onChange={(event) => setBrandPhone(event.target.value.replace(/[^0-9]/g, ""))}
                  />
                </Field>
                <div className="form-grid-span-2">
                  <Field label="Campaign">
                    <Input
                      placeholder="Optional brand campaign"
                      value={brandCampaign}
                      onChange={(event) => setBrandCampaign(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="form-grid-span-2">
                  <Field label="Brand Logo">
                    <ImageInput
                      value={brandLogo}
                      onChange={setBrandLogo}
                      initials={eventInitials(brandName || "Brand")}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}
          <Field label="PIC *">
            <SearchSelect
              items={users}
              value={picUserId}
              onChange={(id) => {
                setPicUserId(id);
                if (id) setCreatingUser(false);
              }}
              getId={(user) => user.id}
              getLabel={(user) => user.name}
              getDescription={(user) => user.email || user.phone}
              placeholder="Search by name, email, or phone"
              renderEmpty={() =>
                creatingUser ? (
                  <span className="search-select-empty">Fill in the PIC details below.</span>
                ) : (
                  <button
                    type="button"
                    className="search-select-add-new"
                    onClick={() => setCreatingUser(true)}
                  >
                    PIC not found. Create a new user.
                  </button>
                )
              }
            />
          </Field>
          {creatingUser && (
            <div className="inline-user-form">
              <div className="form-grid">
                <Field label="First Name *">
                  <Input value={picFirstName} onChange={(event) => setPicFirstName(event.target.value)} />
                </Field>
                <Field label="Last Name">
                  <Input value={picLastName} onChange={(event) => setPicLastName(event.target.value)} />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={picEmail}
                    onChange={(event) => setPicEmail(event.target.value)}
                  />
                </Field>
                <Field label="Phone *">
                  <Input
                    inputMode="numeric"
                    maxLength={15}
                    placeholder="08xxxxxxxxxx"
                    value={picPhone}
                    onChange={(event) => setPicPhone(event.target.value.replace(/[^0-9]/g, ""))}
                  />
                </Field>
              </div>
            </div>
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
      {step === 2 && mode === "edit" && (
        <section className="form-section">
          <h2>Organizer</h2>
          <p className="muted">Update the organizer name and logo for this event.</p>
          <div className="form-grid">
            <Field label="Organizer *">
              <Input value={organizerName} onChange={(event) => setOrganizerName(event.target.value)} />
            </Field>
            <div className="form-grid-span-2">
              <Field label="Organizer Logo">
                <ImageInput
                  value={organizerLogo}
                  onChange={setOrganizerLogo}
                  initials={eventInitials(organizerName || "Organizer")}
                />
              </Field>
            </div>
          </div>
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
          <p className="muted">
            {mode === "create"
              ? "Review the complete data before the system generates the Event, Brand, and User records."
              : "Review the updated event information before saving."}
          </p>
          <dl className="detail-grid">
            <div>
              <dt>Event Name</dt>
              <dd>{name}</dd>
            </div>
            {slogan && (
              <div>
                <dt>Slogan</dt>
                <dd>{slogan}</dd>
              </div>
            )}
            <div>
              <dt>Start Date</dt>
              <dd>{formatDateTime(new Date(startDate).toISOString())}</dd>
            </div>
            <div>
              <dt>End Date</dt>
              <dd>{formatDateTime(new Date(endDate).toISOString())}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{address || "-"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{location || "-"}</dd>
            </div>
            <div>
              <dt>Organizer</dt>
              <dd>
                {mode === "edit"
                  ? organizerName
                  : creatingBrand
                    ? brandName + " (new)"
                    : brands.find((brand) => brand.id === organizerBrandId)?.name}
              </dd>
            </div>
            {mode === "create" && (
              <div>
                <dt>PIC</dt>
                <dd>
                  {creatingUser
                    ? picFirstName + " " + picLastName + " (new)"
                    : users.find((user) => user.id === picUserId)?.name}
                </dd>
              </div>
            )}
          </dl>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Edit Data
            </Button>
            <Button onClick={confirm}>
              {mode === "edit" ? "Confirm & Save Changes" : "Confirm & Create Event"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
