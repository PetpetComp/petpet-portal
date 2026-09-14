"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageInput } from "@/components/ui/image-input";
import type { PortalRecord } from "@/types/portal";
import {
  generateUsername,
  isDuplicateContact,
  isValidEmail,
  isValidPhone,
  userInitials,
} from "../_lib/user-rules";

const BASE_PATH = "/user-management";

export function UserForm({
  mode,
  user,
  users,
  onSave,
}: {
  mode: "create" | "edit";
  user?: PortalRecord;
  users: PortalRecord[];
  onSave: (record: PortalRecord) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PortalRecord>(
    () => user ?? { id: "", name: "", firstName: "", lastName: "", email: "", phone: "" },
  );
  const [error, setError] = useState("");
  const backPath = mode === "edit" && user ? BASE_PATH + "/" + user.id : BASE_PATH;

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
    const username =
      draft.username?.trim() ||
      generateUsername(draft.firstName, draft.lastName, users);
    const next: PortalRecord = {
      ...draft,
      id: draft.id || "USR-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      username,
      name: draft.firstName + (draft.lastName ? " " + draft.lastName : ""),
    };
    if (isDuplicateContact(users, next)) {
      setError("Email or phone is already registered.");
      return;
    }
    onSave(next);
    toast.success("User saved");
    router.push(mode === "edit" ? BASE_PATH + "/" + next.id : BASE_PATH);
  }

  return (
    <div className="page-stack">
      <Link className="back-link" href={backPath}>
        <ArrowLeft size={16} />
        Back to {mode === "edit" ? "User Detail" : "User Management"}
      </Link>
      <header>
        <h1>{mode === "edit" ? "Edit User" : "Add New User"}</h1>
        <p className="muted">
          {mode === "edit"
            ? "Update the selected user's profile information."
            : "Create a new platform user record."}
        </p>
      </header>
      <form onSubmit={submit} className="page-stack">
        <section className="form-section">
          <h2>General Information</h2>
          <div className="form-grid">
            <Field label="User ID">
              <Input value={draft.id} readOnly placeholder="Generated on save" />
            </Field>
            <Field label="Username">
              <Input
                placeholder="Leave blank to auto-generate"
                value={draft.username ?? ""}
                onChange={(event) => set("username", event.target.value)}
              />
            </Field>
            <Field label="First Name *">
              <Input
                required
                value={draft.firstName}
                onChange={(event) => set("firstName", event.target.value)}
              />
            </Field>
            <Field label="Last Name">
              <Input
                value={draft.lastName ?? ""}
                onChange={(event) => set("lastName", event.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                placeholder="name@example.com"
                value={draft.email ?? ""}
                onChange={(event) => set("email", event.target.value)}
              />
            </Field>
            <Field label="Phone *">
              <Input
                required
                inputMode="numeric"
                maxLength={15}
                placeholder="081234567890"
                value={draft.phone ?? ""}
                onChange={(event) =>
                  set("phone", event.target.value.replace(/[^0-9]/g, ""))
                }
              />
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={draft.dob ?? ""}
                onChange={(event) => set("dob", event.target.value)}
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
            <div className="form-grid-span-2">
              <Field label="Address">
                <Textarea
                  rows={3}
                  value={draft.address ?? ""}
                  onChange={(event) => set("address", event.target.value)}
                />
              </Field>
            </div>
            <Field label="City">
              <Input
                placeholder="e.g. Tangerang"
                value={draft.city ?? ""}
                onChange={(event) => set("city", event.target.value)}
              />
            </Field>
            <Field label="State / Province">
              <Input
                placeholder="e.g. Banten"
                value={draft.province ?? ""}
                onChange={(event) => set("province", event.target.value)}
              />
            </Field>
            <Field label="Postal / ZIP Code">
              <Input
                maxLength={12}
                placeholder="e.g. 15345"
                value={draft.postalCode ?? ""}
                onChange={(event) => set("postalCode", event.target.value)}
              />
            </Field>
            <Field label="Country">
              <Input
                placeholder="e.g. Indonesia"
                value={draft.nation ?? ""}
                onChange={(event) => set("nation", event.target.value)}
              />
            </Field>
            <div className="form-grid-span-2">
              <Field label="Profile Photo">
                <ImageInput
                  value={draft.photo ?? ""}
                  onChange={(value) => set("photo", value)}
                  initials={userInitials(draft.firstName, draft.lastName)}
                  shape="circle"
                />
              </Field>
            </div>
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
            {mode === "edit" ? "Save Changes" : "Save User"}
          </Button>
        </div>
      </form>
    </div>
  );
}
