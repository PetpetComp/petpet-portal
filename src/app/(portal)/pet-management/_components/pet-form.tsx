"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { ImageInput } from "@/components/ui/image-input";
import { SearchSelect } from "@/components/common/search-select";
import { calculateAge } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { ANIMAL_OPTIONS, isDuplicatePet, petInitials } from "../_lib/pet-rules";

const BASE_PATH = "/pet-management";

export function PetForm({
  mode,
  pet,
  pets,
  users,
  onSave,
}: {
  mode: "create" | "edit";
  pet?: PortalRecord;
  pets: PortalRecord[];
  users: PortalRecord[];
  onSave: (record: PortalRecord) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PortalRecord>(
    () => pet ?? { id: "", name: "", ownerUserId: "", ownerName: "" },
  );
  const [error, setError] = useState("");
  const backPath =
    mode === "edit" && pet ? BASE_PATH + "/" + pet.id : BASE_PATH;

  function set<K extends string>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.ownerUserId) {
      setError("Please select an owner for this pet.");
      return;
    }
    const next: PortalRecord = {
      ...draft,
      id: draft.id || "PET-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      ownerName: users.find((user) => user.id === draft.ownerUserId)?.name ?? "",
    };
    if (isDuplicatePet(pets, next)) {
      setError("This owner already has a pet with this name.");
      return;
    }
    onSave(next);
    toast.success("Pet saved");
    router.push(mode === "edit" ? BASE_PATH + "/" + next.id : BASE_PATH);
  }

  return (
    <div className="page-stack">
      <Link className="back-link" href={backPath}>
        <ArrowLeft size={16} />
        Back to {mode === "edit" ? "Pet Detail" : "Pet Management"}
      </Link>
      <header>
        <h1>{mode === "edit" ? "Edit Pet" : "Add New Pet"}</h1>
        <p className="muted">
          {mode === "edit"
            ? "Update pet information."
            : "Create a new pet record and assign its owner."}
        </p>
      </header>
      <form onSubmit={submit} className="page-stack">
        <section className="form-section">
          <div className="pet-photo-section">
            <ImageInput
              value={draft.photo ?? ""}
              onChange={(value) => set("photo", value)}
              initials={petInitials(draft.name || "Pet")}
              shape="circle"
            />
            <p className="muted">Optional. Upload JPG, PNG, or WEBP image.</p>
          </div>
          <h2>General Information</h2>
          <div className="form-grid">
            <Field label="Pet ID">
              <Input value={draft.id} readOnly placeholder="Generated on save" />
            </Field>
            <Field label="Pet Name *">
              <Input
                required
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </Field>
            <Field label="Animal *">
              <Select
                required
                value={draft.animal ?? ""}
                onChange={(event) => set("animal", event.target.value)}
              >
                <option value="">Select animal</option>
                {ANIMAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Variant">
              <Input
                value={draft.variant ?? ""}
                onChange={(event) => set("variant", event.target.value)}
              />
            </Field>
            <Field label="Owner *">
              <SearchSelect
                items={users}
                value={draft.ownerUserId ?? ""}
                onChange={(id) => set("ownerUserId", id)}
                getId={(user) => user.id}
                getLabel={(user) => user.name}
                getDescription={(user) => user.id}
                placeholder="Search User ID, first name, or last name"
              />
            </Field>
            <Field label="Gender">
              <Select
                value={draft.gender ?? ""}
                onChange={(event) => set("gender", event.target.value)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={draft.dob ?? ""}
                onChange={(event) => set("dob", event.target.value)}
              />
            </Field>
            <Field label="Current Age">
              <Input
                readOnly
                placeholder="Calculated automatically from DoB"
                value={draft.dob ? calculateAge(draft.dob) : ""}
              />
            </Field>
            <Field label="Height / Length">
              <Input
                placeholder="e.g. 38 cm"
                value={draft.heightLength ?? ""}
                onChange={(event) => set("heightLength", event.target.value)}
              />
            </Field>
            <Field label="Weight">
              <Input
                placeholder="e.g. 11.2 kg"
                value={draft.weight ?? ""}
                onChange={(event) => set("weight", event.target.value)}
              />
            </Field>
          </div>
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
            {mode === "edit" ? "Save Changes" : "Save Pet"}
          </Button>
        </div>
      </form>
    </div>
  );
}
