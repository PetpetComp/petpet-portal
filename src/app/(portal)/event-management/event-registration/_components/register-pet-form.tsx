"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import type { PortalRecord } from "@/types/portal";
import { generateId } from "@/lib/identity";
import { PAYMENT_STATUSES, isAnimalMismatch, isDuplicateRegistration, resolvePriceCategory } from "../_lib/registration-rules";

const CURRENT_ACTOR = "Admin Petpet";

export function RegisterPetForm({
  event,
  user,
  pets,
  competitions,
  registrations,
  onSave,
  onCancel,
}: {
  event: PortalRecord;
  user: PortalRecord;
  pets: PortalRecord[];
  competitions: PortalRecord[];
  registrations: PortalRecord[];
  onSave: (registration: PortalRecord) => void;
  onCancel: () => void;
}) {
  const [petId, setPetId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [error, setError] = useState("");

  const ownedPets = pets.filter((pet) => pet.ownerUserId === user.id);

  function submit() {
    const pet = ownedPets.find((item) => item.id === petId);
    const competition = competitions.find((item) => item.id === competitionId);
    if (!pet || !competition) {
      setError("Select a pet and a competition.");
      return;
    }
    if (isAnimalMismatch(pet, competition)) {
      setError("This pet's animal type does not match the competition.");
      return;
    }
    const draft = { id: "", name: "", petId, competitionId };
    if (isDuplicateRegistration(registrations, draft)) {
      setError("This pet is already registered for this competition.");
      return;
    }
    const now = new Date();
    const { category, fee } = resolvePriceCategory(competition, now);
    const nowIso = now.toISOString();
    onSave({
      id: generateId("REG"),
      name: "Registration " + pet.name,
      eventId: event.id,
      competitionId,
      userId: user.id,
      petId,
      paymentStatus,
      paymentMethod,
      priceCategory: category,
      registrationFee: String(fee),
      registrationDate: nowIso,
      paymentDate: paymentStatus !== "Pending" ? nowIso : "",
      paymentBy: paymentStatus !== "Pending" ? CURRENT_ACTOR : "",
      paymentVerificationDate: paymentStatus === "Verified" ? nowIso : "",
      paymentVerifiedBy: paymentStatus === "Verified" ? CURRENT_ACTOR : "",
      createdDate: nowIso,
      createdBy: CURRENT_ACTOR,
      updatedDate: nowIso,
      updatedBy: CURRENT_ACTOR,
    });
  }

  return (
    <div className="inline-user-form">
      <div className="eyebrow">Register Pet</div>
      {!ownedPets.length ? (
        <p className="muted">
          This participant has no pets yet.{" "}
          <Link className="link-button-plain" href="/pet-management/create">
            Add a pet in Pet Management
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="form-grid">
          <Field label="Pet *">
            <Select value={petId} onChange={(evt) => setPetId(evt.target.value)}>
              <option value="">Select pet</option>
              {ownedPets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} ({pet.animal})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Competition *">
            <Select value={competitionId} onChange={(evt) => setCompetitionId(evt.target.value)}>
              <option value="">Select competition</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment Status">
            <Select value={paymentStatus} onChange={(evt) => setPaymentStatus(evt.target.value)}>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment Method">
            <Select value={paymentMethod} onChange={(evt) => setPaymentMethod(evt.target.value)}>
              <option value="">-</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="E-Wallet">E-Wallet</option>
              <option value="Cash">Cash</option>
            </Select>
          </Field>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {!!ownedPets.length && <Button onClick={submit}>Save Registration</Button>}
      </div>
    </div>
  );
}
