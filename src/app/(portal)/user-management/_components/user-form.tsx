"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { USER_SERVICES } from "@/services/user-management";
import { recordPayload } from "@/services/backend-records";
import type { PortalRecord } from "@/types/portal";
import {
  generateUsername,
  isDuplicateContact,
  isValidEmail,
  isValidPhone,
  userInitials,
} from "../_lib/user-rules";

const BASE_PATH = "/user-management";
const PROFILE_KEYS = ["dob", "gender", "address", "city", "province", "nation"];

export function UserForm({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: string;
}) {
  const router = useRouter();
  const { data, save, refresh } = usePortalData();
  const user = mode === "edit" ? data.users.find((item) => item.id === id) : undefined;
  const [draft, setDraft] = useState<PortalRecord>(
    () =>
      user ?? {
        id: "",
        name: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        status: "Active",
      },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const backPath = mode === "edit" && user ? BASE_PATH + "/" + user.id : BASE_PATH;

  if (mode === "edit" && !user)
    return (
      <section className="page-stack">
        <h1>User not found</h1>
        <Link className="link-button" href={BASE_PATH}>
          Back to User Management
        </Link>
      </section>
    );

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!isValidPhone(draft.phone ?? "")) {
      setError("Phone must contain 8-15 digits.");
      return;
    }
    if (draft.email && !isValidEmail(draft.email)) {
      setError("Enter a valid email format.");
      return;
    }
    const username =
      draft.username?.trim() ||
      generateUsername(draft.firstName, draft.lastName, data.users);
    const next: PortalRecord = { ...draft, username };
    if (isDuplicateContact(data.users, next)) {
      setError("Email or phone is already registered.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const saved = await save("users", next);
      if (mode === "create" && PROFILE_KEYS.some((key) => draft[key]?.trim())) {
        const body = recordPayload("users", { ...draft, id: saved.id }, true);
        await USER_SERVICES.update(saved.id, body);
        await refresh();
      }
      toast.success("User saved");
      router.push(mode === "edit" ? BASE_PATH + "/" + saved.id : BASE_PATH);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save user.");
      setPending(false);
    }
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
        <fieldset disabled={pending} className="form-section">
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
              <p className="muted">
                Optional. Enter a username, or leave blank and the portal will
                generate a unique one.
              </p>
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
              <p className="muted">Optional. If entered, use a valid email format.</p>
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
              <p className="muted">Numbers only, 8-15 digits.</p>
            </Field>
            <Field label="Status">
              <Select
                value={draft.status ?? "Active"}
                onChange={(event) => set("status", event.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </Select>
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
              <Input disabled placeholder="Not yet supported by the connected API" />
              <p className="muted">
                Not yet supported by the connected API — not saved.
              </p>
            </Field>
            <Field label="Country">
              <Input
                placeholder="e.g. Indonesia"
                value={draft.nation ?? ""}
                onChange={(event) => set("nation", event.target.value)}
              />
            </Field>
            <div className="form-grid-span-2">
              <Field label="User Photo">
                <span
                  className="image-placeholder image-preview-circle"
                  aria-hidden="true"
                >
                  {userInitials(draft.firstName, draft.lastName ?? "")}
                </span>
                <Button variant="secondary" disabled>
                  Choose Photo
                </Button>
                <p className="muted">
                  Not yet supported by the connected API — photos aren&apos;t
                  saved.
                </p>
              </Field>
            </div>
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
            {pending ? "Saving..." : mode === "edit" ? "Save Changes" : "Save User"}
          </Button>
        </div>
      </form>
    </div>
  );
}
