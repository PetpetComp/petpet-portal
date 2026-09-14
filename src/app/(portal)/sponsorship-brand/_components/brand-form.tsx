"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { ImageInput } from "@/components/ui/image-input";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import type { PortalRecord } from "@/types/portal";
import { brandInitials, isDuplicateBrandName, SOCIAL_FIELDS } from "../_lib/brand-rules";
import { BrandPicAssignment } from "./brand-pic-assignment";
import { BrandEventAssignment } from "./brand-event-assignment";
import { SocialIcon } from "./social-icon";

const BASE_PATH = "/sponsorship-brand";

export function BrandForm({
  mode,
  brand,
  brands,
  users,
  events,
  assignments,
  onSave,
  onAddUser,
  onAddAssignment,
  onRemoveAssignment,
}: {
  mode: "create" | "edit";
  brand: PortalRecord;
  brands: PortalRecord[];
  users: PortalRecord[];
  events: PortalRecord[];
  assignments: PortalRecord[];
  onSave: (record: PortalRecord) => void;
  onAddUser: (user: PortalRecord) => void;
  onAddAssignment: (assignment: PortalRecord) => void;
  onRemoveAssignment: (id: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PortalRecord>(brand);
  const [picIds, setPicIds] = useState<string[]>(
    brand.picUserIds ? brand.picUserIds.split(",").filter(Boolean) : [],
  );
  const [error, setError] = useState("");
  const backPath = mode === "edit" ? BASE_PATH + "/" + brand.id : BASE_PATH;

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidPhone(draft.phone ?? "")) {
      setError("Phone must contain 8-15 digits.");
      return;
    }
    if (!isValidEmail(draft.email ?? "")) {
      setError("Enter a valid email format.");
      return;
    }
    if (!picIds.length) {
      setError("At least 1 PIC is required.");
      return;
    }
    const next: PortalRecord = { ...draft, picUserIds: picIds.join(",") };
    if (isDuplicateBrandName(brands, next)) {
      setError("A brand with this name already exists.");
      return;
    }
    onSave(next);
    toast.success("Brand saved");
    router.push(BASE_PATH + "/" + next.id);
  }

  return (
    <div className="page-stack">
      <Link className="back-link" href={backPath}>
        <ArrowLeft size={16} />
        Back to {mode === "edit" ? "Brand Detail" : "Brands"}
      </Link>
      <header>
        <h1>{mode === "edit" ? "Edit Brand" : "Add New Brand"}</h1>
        <p className="muted">
          {mode === "edit"
            ? "Update brand information and assigned PICs."
            : "Create a brand profile, assign PICs, and configure event partnership assignments."}
        </p>
      </header>
      <form onSubmit={submit} className="page-stack">
        <section className="form-section">
          <h2>General Information</h2>
          <div className="form-grid">
            <Field label="Brand Name *">
              <Input
                required
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </Field>
            <Field label="Phone *">
              <Input
                required
                inputMode="numeric"
                maxLength={15}
                placeholder="Enter phone number"
                value={draft.phone ?? ""}
                onChange={(event) => set("phone", event.target.value.replace(/[^0-9]/g, ""))}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                placeholder="brand@example.com"
                value={draft.email ?? ""}
                onChange={(event) => set("email", event.target.value)}
              />
            </Field>
            <Field label="Brand Campaign">
              <Input
                placeholder="Enter campaign name"
                value={draft.campaign ?? ""}
                onChange={(event) => set("campaign", event.target.value)}
              />
            </Field>
            <div className="form-grid-span-2">
              <Field label="Brand Logo">
                <ImageInput
                  value={draft.logo ?? ""}
                  onChange={(value) => set("logo", value)}
                  initials={brandInitials(draft.name || "Brand")}
                  shape="circle"
                />
              </Field>
            </div>
            {SOCIAL_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <div className="social-input-wrap">
                  <SocialIcon icon={field.icon} />
                  <input
                    aria-label={field.label}
                    placeholder="@brand"
                    value={draft[field.key] ?? ""}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                </div>
              </Field>
            ))}
          </div>
        </section>
        <section className="form-section">
          <div className="section-head">
            <div>
              <h2>Assign Brand PICs *</h2>
              <p className="muted">
                At least 1 PIC is required. Search and add users from User
                Management.
              </p>
            </div>
            <span className="user-pet-count">{picIds.length} selected</span>
          </div>
          <BrandPicAssignment
            users={users}
            selectedIds={picIds}
            onAdd={(id) => setPicIds((current) => [...current, id])}
            onRemove={(id) => setPicIds((current) => current.filter((item) => item !== id))}
            onCreateUser={onAddUser}
          />
        </section>
        <section className="form-section">
          <div className="section-head">
            <div>
              <h2>Event Partnership Assignments</h2>
              <p className="muted">Assign this brand to available events and define the category.</p>
            </div>
            <span className="user-pet-count">{assignments.length} assignments</span>
          </div>
          <BrandEventAssignment
            brandId={draft.id}
            events={events}
            assignments={assignments}
            onAdd={onAddAssignment}
            onRemove={onRemoveAssignment}
          />
        </section>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link className="link-button secondary" href={backPath}>
            Cancel
          </Link>
          <Button type="submit">
            <Save size={16} />
            {mode === "edit" ? "Save Changes" : "Save Brand"}
          </Button>
        </div>
      </form>
    </div>
  );
}
