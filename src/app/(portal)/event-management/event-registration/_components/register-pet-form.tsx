"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { SearchSelect } from "@/components/common/search-select";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { COMPETITION_SERVICES } from "@/services/competition";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";
import type { PortalRecord } from "@/types/portal";
import { currentPeriod, isDuplicateRegistration } from "../_lib/registration-rules";

export function RegisterPetForm({
  competitions,
  onSaved,
  onCancel,
}: {
  competitions: PortalRecord[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, save } = usePortalData();
  const [petId, setPetId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [periods, setPeriods] = useState<Row[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!competitionId) {
      setPeriods([]);
      return;
    }
    let active = true;
    collectRows((params) =>
      COMPETITION_SERVICES.periods(competitionId, params),
    ).then((rows) => {
      if (active) setPeriods(rows);
    });
    return () => {
      active = false;
    };
  }, [competitionId]);

  const activePeriod = currentPeriod(periods);
  const priceCategory = activePeriod
    ? String(activePeriod.period_type ?? "").replaceAll("_", " ")
    : "";
  const registrationFee = activePeriod ? String(activePeriod.price ?? "") : "";

  async function submit() {
    if (pending) return;
    if (!petId || !competitionId) {
      setError("Select a pet and a competition.");
      return;
    }
    if (
      isDuplicateRegistration(data.registrations, {
        id: "",
        petId,
        competitionId,
      })
    ) {
      setError("This pet is already registered for this competition.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await save("registrations", {
        id: "",
        name: "",
        competitionId,
        petId,
        registrationPeriodId: activePeriod ? String(activePeriod.uuid) : "",
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to register.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-user-form">
      <div className="eyebrow">Register Pet</div>
      <p className="muted">
        Select one of this owner&apos;s pets and an available competition in the
        selected event.
      </p>
      <div className="form-grid">
        <Field label="Pet *">
          <SearchSelect
            items={data.pets}
            value={petId}
            onChange={setPetId}
            getId={(pet) => pet.id}
            getLabel={(pet) => pet.name}
            getDescription={(pet) => pet.registrationNumber || pet.id}
            placeholder="Search pet by name or registration number"
          />
        </Field>
        <Field label="Competition *">
          <Select
            value={competitionId}
            onChange={(event) => setCompetitionId(event.target.value)}
            disabled={pending}
          >
            <option value="">Select competition</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price Category">
          <Input readOnly value={priceCategory} placeholder="-" />
          <p className="muted">
            Automatically follows the currently active registration price
            window.
          </p>
        </Field>
        <Field label="Registration Fee">
          <Input
            readOnly
            value={registrationFee ? "Rp " + registrationFee : ""}
            placeholder="-"
          />
          <p className="muted">
            Automatically calculated from the selected competition.
          </p>
        </Field>
        <Field label="Payment Method *">
          <Select disabled>
            <option value="">Select payment method</option>
            <option value="QRIS">QRIS</option>
            <option value="Transfer/Virtual Account">
              Transfer/Virtual Account
            </option>
            <option value="e-Wallet">e-Wallet</option>
            <option value="Card">Card</option>
            <option value="Paylater">Paylater</option>
            <option value="Cash">Cash</option>
          </Select>
          <p className="muted">
            Not yet supported by the connected API — payment is recorded
            outside the portal.
          </p>
        </Field>
        <Field label="Payment Date *">
          <Input type="datetime-local" disabled />
          <p className="muted">
            Not yet supported by the connected API — payment is recorded
            outside the portal.
          </p>
        </Field>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving..." : "Register Pet"}
        </Button>
      </div>
    </div>
  );
}
