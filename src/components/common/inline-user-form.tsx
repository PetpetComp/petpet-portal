"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import { generateUniqueSlug } from "@/lib/identity";
import type { PortalRecord } from "@/types/portal";

export function InlineUserForm({
  users,
  onCreate,
  onCancel,
  submitLabel = "Add User",
}: {
  users: PortalRecord[];
  onCreate: (user: PortalRecord) => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Phone must contain 8-15 digits.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email format.");
      return;
    }
    const id = "USR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const username = generateUniqueSlug(
      firstName + (lastName ? "." + lastName : ""),
      users.map((user) => user.username),
    );
    onCreate({
      id,
      name: firstName + (lastName ? " " + lastName : ""),
      username,
      firstName,
      lastName,
      email,
      phone,
      gender: "",
      dob: "",
      address: "",
      city: "",
      province: "",
      nation: "",
    });
  }

  return (
    <div className="inline-user-form">
      <div className="section-head">
        <div>
          <div className="eyebrow">New User</div>
          <p className="muted">
            User not found. Complete the fields below to create and assign a
            new user.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}>
          <X size={16} />
        </Button>
      </div>
      <div className="form-grid">
        <Field label="First Name *">
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </Field>
        <Field label="Last Name">
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Phone *">
          <Input
            inputMode="numeric"
            maxLength={15}
            placeholder="081234567890"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
