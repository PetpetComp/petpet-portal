"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Save, UserPlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { ImageInput } from "@/components/ui/image-input";
import { MultiSelectField } from "@/components/common/select-field";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { initials, generateUniqueSlug } from "@/lib/identity";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import type { PortalRecord } from "@/types/portal";
import type { Organization, OrganizationDraft } from "@/types/organization";

export function OrganizationForm({
  organization,
  users,
  userError,
  onSave,
  onCreateUser,
}: {
  organization?: Organization;
  users: PortalRecord[];
  userError?: string;
  onSave: (draft: OrganizationDraft) => Promise<void>;
  onCreateUser: (user: PortalRecord) => Promise<PortalRecord>;
}) {
  const [draft, setDraft] = useState<OrganizationDraft>({
    name: organization?.name ?? "",
    photo: organization?.photo ?? "",
    campaign: organization?.campaign ?? "",
    picIds: organization?.pics.map((pic) => pic.id) ?? [],
  });
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [pending, setPending] = useState(false);
  const [userPending, setUserPending] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [addedUsers, setAddedUsers] = useState<PortalRecord[]>([]);
  const options = Array.from(
    new Map(
      [...users, ...(organization?.pics ?? []), ...addedUsers].map((user) => [
        user.id,
        user,
      ]),
    ).values(),
  );
  const title = organization ? "Edit Organization" : "Add New Organization";
  function addPic(id: string) {
    setDraft((current) => ({
      ...current,
      picIds: [...new Set([...current.picIds, id])],
    }));
  }
  async function createUser() {
    if (userPending) return;
    if (
      !newUser.firstName.trim() ||
      !newUser.email.trim() ||
      !isValidEmail(newUser.email.trim()) ||
      !isValidPhone(newUser.phone)
    ) {
      setCreateError(
        "Enter a first name, valid email, and phone number with 8–15 digits.",
      );
      return;
    }
    setUserPending(true);
    setCreateError("");
    try {
      const name = [newUser.firstName.trim(), newUser.lastName.trim()]
        .filter(Boolean)
        .join(" ");
      const saved = await onCreateUser({
        ...newUser,
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        email: newUser.email.trim(),
        id: "",
        name,
        username: generateUniqueSlug(
          name.replaceAll(" ", "."),
          options.map((user) => user.username ?? ""),
        ),
      });
      setAddedUsers((current) => [...current, saved]);
      addPic(saved.id);
      setNewUser({ firstName: "", lastName: "", email: "", phone: "" });
      setCreating(false);
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : "Unable to create user.",
      );
    } finally {
      setUserPending(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || userPending) return;
    if (!draft.name.trim() || !draft.picIds.length) {
      setError("Organization name and at least one PIC are required.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        campaign: draft.campaign.trim(),
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save organization.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="page-stack">
      <Breadcrumb
        items={[
          {
            label: "Organization Management",
            href: "/organization-management",
          },
          { label: title },
        ]}
      />
      <header>
        <h1>{title}</h1>
        <p className="muted">Manage organization information and its PICs.</p>
      </header>
      <form className="page-stack" onSubmit={submit}>
        <fieldset className="form-section" disabled={pending || userPending}>
          <h2>General Information</h2>
          <div className="form-grid">
            <div className="form-grid-span-2">
              <Field label="Organization Photo">
                <ImageInput
                  value={draft.photo}
                  initials={initials(draft.name, "O")}
                  onChange={(photo) =>
                    setDraft((current) => ({ ...current, photo }))
                  }
                />
              </Field>
            </div>
            <Field label="Organization Name *">
              <Input
                required
                maxLength={200}
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter organization name"
              />
            </Field>
            <Field label="Campaign">
              <Input
                value={draft.campaign}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    campaign: event.target.value,
                  }))
                }
                placeholder="Enter campaign"
              />
            </Field>
          </div>
        </fieldset>
        <fieldset
          className="form-section page-stack"
          disabled={pending || userPending}
        >
          <div className="section-head">
            <div>
              <h2>Organization PICs *</h2>
              <p className="muted">
                Select one or more users, or add a new user.
              </p>
            </div>
            <span className="user-pet-count">
              {draft.picIds.length} selected
            </span>
          </div>
          {userError && (
            <p role="alert" className="form-error">
              {userError}
            </p>
          )}
          <MultiSelectField
            items={options}
            selectedIds={draft.picIds}
            onAdd={addPic}
            onRemove={(id) =>
              setDraft((current) => ({
                ...current,
                picIds: current.picIds.filter((item) => item !== id),
              }))
            }
            getId={(user) => user.id}
            getLabel={(user) => user.name}
            getDescription={(user) =>
              [user.email, user.phone].filter(Boolean).join(" · ")
            }
            placeholder="Search PIC by name, email, or phone"
            renderEmpty={() => (
              <button
                type="button"
                className="search-select-add-new"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setCreating(true)}
              >
                <UserPlus size={14} />
                User not found. Add User
              </button>
            )}
          />
          {!creating && (
            <div>
              <Button variant="secondary" onClick={() => setCreating(true)}>
                <UserPlus size={16} />
                Add User
              </Button>
            </div>
          )}
          {creating && (
            <div className="inline-user-form">
              <h3>Add New User</h3>
              <div className="form-grid">
                <Field label="First Name *">
                  <Input
                    value={newUser.firstName}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Last Name">
                  <Input
                    value={newUser.lastName}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Email *">
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Phone *">
                  <Input
                    inputMode="numeric"
                    maxLength={15}
                    value={newUser.phone}
                    onChange={(event) =>
                      setNewUser((current) => ({
                        ...current,
                        phone: event.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                  />
                </Field>
              </div>
              {createError && (
                <p className="form-error" role="alert">
                  {createError}
                </p>
              )}
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setCreating(false)}>
                  Cancel Add User
                </Button>
                <Button onClick={() => void createUser()}>
                  {userPending ? "Adding..." : "Add & Assign PIC"}
                </Button>
              </div>
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link
            className={buttonVariants({ variant: "secondary" })}
            href="/organization-management"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={pending || userPending || creating}>
            <Save size={16} />
            {pending ? "Saving..." : "Save Organization"}
          </Button>
        </div>
      </form>
    </section>
  );
}
