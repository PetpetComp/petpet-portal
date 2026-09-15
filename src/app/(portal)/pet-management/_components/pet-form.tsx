"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { calculateAge } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { isDuplicatePet, petInitials } from "../_lib/pet-rules";

const BASE_PATH = "/pet-management";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PetForm({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: string;
}) {
  const router = useRouter();
  const { data, save } = usePortalData();
  const pet = mode === "edit" ? data.pets.find((item) => item.id === id) : undefined;
  const [draft, setDraft] = useState<PortalRecord>(
    () => pet ?? { id: "", name: "", speciesId: "", morphId: "" },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const backPath =
    mode === "edit" && pet ? BASE_PATH + "/" + pet.id : BASE_PATH;

  if (mode === "edit" && !pet)
    return (
      <section className="page-stack">
        <h1>Pet not found</h1>
        <Link className="link-button" href={BASE_PATH}>
          Back to Pet Management
        </Link>
      </section>
    );

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (mode === "create" && draft.speciesId && !uuid.test(draft.speciesId.trim())) {
      setError("Species ID must be a valid UUID.");
      return;
    }
    if (draft.morphId && !uuid.test(draft.morphId.trim())) {
      setError("Morph ID must be a valid UUID.");
      return;
    }
    if (isDuplicatePet(data.pets, draft)) {
      setError("This pet name is already in use.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const saved = await save("pets", draft);
      toast.success("Pet saved");
      router.push(mode === "edit" ? BASE_PATH + "/" + saved.id : BASE_PATH);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save pet.");
      setPending(false);
    }
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
            : "Create a new pet record."}
        </p>
      </header>
      <form onSubmit={submit} className="page-stack">
        <fieldset disabled={pending} className="form-section">
          <div className="pet-photo-section">
            <span className="image-placeholder image-preview-circle" aria-hidden="true">
              {petInitials(draft.name || "Pet")}
            </span>
            <div>
              <Button variant="secondary" disabled>
                Choose Photo
              </Button>
              <p className="muted">
                Not yet supported by the connected API — photos aren&apos;t
                saved.
              </p>
            </div>
          </div>
          <h2>General Information</h2>
          <div className="form-grid">
            <Field label="Pet ID">
              <Input
                value={draft.id}
                readOnly
                placeholder="Generated on save"
              />
            </Field>
            <Field label="Pet Name *">
              <Input
                required
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </Field>
            <Field label="Species ID (UUID) *">
              <Input
                required
                disabled={mode === "edit"}
                value={draft.speciesId ?? ""}
                onChange={(event) => set("speciesId", event.target.value)}
                placeholder="Provided by your administrator"
              />
            </Field>
            <Field label="Morph ID (UUID)">
              <Input
                disabled={mode === "edit"}
                value={draft.morphId ?? ""}
                onChange={(event) => set("morphId", event.target.value)}
                placeholder="Provided by your administrator"
              />
            </Field>
            <Field label="Owner">
              <Input
                disabled
                placeholder="Not yet supported by the connected API"
              />
              <p className="muted">
                Pets belong to the authenticated account — the API does not
                allow choosing another owner.
              </p>
            </Field>
            <Field label="Registration Number">
              <Input
                value={draft.registrationNumber ?? ""}
                onChange={(event) =>
                  set("registrationNumber", event.target.value)
                }
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
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link className="link-button secondary" href={backPath}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            <Save size={16} />
            {pending ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Pet"}
          </Button>
        </div>
      </form>
    </div>
  );
}
