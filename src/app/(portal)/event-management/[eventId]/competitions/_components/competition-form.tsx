"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import type { PortalRecord } from "@/types/portal";
import { ANIMAL_OPTIONS } from "@/lib/constants/animals";
import { EventInfoCard } from "@/app/(portal)/event-management/_components/event-info-card";
import {
  COMPETITION_TYPES,
  REGISTRATION_CHANNELS,
  isDuplicateCompetitionName,
  isValidChannelWindow,
  parseContestCriteria,
  type ContestCriterion,
  typeConfigFields,
} from "../_lib/competition-rules";

const backPath = (eventId: string) => "/event-management/" + eventId;

export function CompetitionForm({
  mode,
  event,
  competition,
  competitions,
  onSave,
}: {
  mode: "create" | "edit";
  event: PortalRecord;
  competition?: PortalRecord;
  competitions: PortalRecord[];
  onSave: (record: PortalRecord) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PortalRecord>(
    () =>
      competition ?? {
        id: "",
        name: "",
        eventId: event.id,
        type: "",
        animal: "",
      },
  );
  const [error, setError] = useState("");
  const [criteria, setCriteria] = useState<ContestCriterion[]>(() =>
    parseContestCriteria(competition?.contestCriteria),
  );
  const config = typeConfigFields(draft.type);

  function setCriterion(index: number, patch: Partial<ContestCriterion>) {
    setCriteria((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    for (const channel of REGISTRATION_CHANNELS) {
      if (!isValidChannelWindow(draft[channel.key + "Open"] ?? "", draft[channel.key + "Close"] ?? "")) {
        setError("Registration close must be after registration open for " + channel.label + ".");
        return;
      }
    }
    if (draft.type === "Contest" && (!criteria.length || criteria.some((item) => !item.name.trim() || item.maxPoints <= 0))) {
      setError("Add at least one scoring criterion with a name and a max score above 0.");
      return;
    }
    const next: PortalRecord = {
      ...draft,
      id: draft.id || "CMP-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      eventId: event.id,
      registrationStatus: draft.registrationStatus || "Open",
      contestCriteria: draft.type === "Contest" ? JSON.stringify(criteria) : "",
    };
    if (isDuplicateCompetitionName(competitions, next)) {
      setError("This event already has a competition with this name.");
      return;
    }
    onSave(next);
    toast.success("Competition saved");
    router.push("/event-management/" + event.id + "/competitions/" + next.id);
  }

  return (
    <div className="page-stack">
      <Link className="back-link" href={backPath(event.id)}>
        Back to Event Details
      </Link>
      <header>
        <h1>{mode === "edit" ? "Edit Competition" : "Add New Competition"}</h1>
        <p className="muted">
          {mode === "edit"
            ? "Update the competition information and pricing."
            : "Create a competition for the selected event."}
        </p>
      </header>
      <EventInfoCard event={event} />
      <form onSubmit={submit} className="page-stack">
        <section className="form-section">
          <h2>Competition Information</h2>
          <p className="muted">Set the basic competition information and registration pricing.</p>
          <div className="form-grid">
            <Field label="Competition Name *">
              <Input required value={draft.name} onChange={(evt) => set("name", evt.target.value)} />
            </Field>
            <Field label="Competition Type *">
              <Select required value={draft.type} onChange={(evt) => set("type", evt.target.value)}>
                <option value="">Select competition type</option>
                {COMPETITION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Animal *">
              <Select required value={draft.animal} onChange={(evt) => set("animal", evt.target.value)}>
                <option value="">Select animal</option>
                {ANIMAL_OPTIONS.map((animal) => (
                  <option key={animal} value={animal}>
                    {animal}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {(config.lanes || config.checkpoints || config.cutoff) && (
            <div className="form-section">
              <h3>Competition Type Configuration</h3>
              <p className="muted">Additional fields shown based on the selected competition type.</p>
              <div className="form-grid">
                {config.lanes && (
                  <Field label="Number of Lanes">
                    <Input
                      type="number"
                      min={1}
                      value={draft.lanes ?? "4"}
                      onChange={(evt) => set("lanes", evt.target.value)}
                    />
                  </Field>
                )}
                {config.checkpoints && (
                  <Field label="Number of Checkpoints">
                    <Input
                      type="number"
                      min={1}
                      value={draft.checkpoints ?? "3"}
                      onChange={(evt) => set("checkpoints", evt.target.value)}
                    />
                  </Field>
                )}
                {config.cutoff && (
                  <Field label="Cutoff Time (seconds)">
                    <Input
                      type="number"
                      min={1}
                      value={draft.cutoff ?? "60"}
                      onChange={(evt) => set("cutoff", evt.target.value)}
                    />
                  </Field>
                )}
              </div>
            </div>
          )}
          {draft.type === "Contest" && (
            <div className="form-section">
              <h3>Scoring Criteria</h3>
              <p className="muted">Define the criteria judges score participants against.</p>
              <div className="criteria-list">
                {criteria.map((item, index) => (
                  <div key={index} className="criteria-row">
                    <Field label="Criterion Name">
                      <Input
                        value={item.name}
                        onChange={(evt) => setCriterion(index, { name: evt.target.value })}
                      />
                    </Field>
                    <Field label="Max Points">
                      <Input
                        type="number"
                        min={1}
                        value={item.maxPoints}
                        onChange={(evt) => setCriterion(index, { maxPoints: Number(evt.target.value) })}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={"Remove " + (item.name || "criterion")}
                      onClick={() => setCriteria((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCriteria((current) => [...current, { name: "", maxPoints: 100 }])}
              >
                <Plus size={14} />
                Add Criterion
              </Button>
            </div>
          )}
        </section>
        <section className="form-section">
          <h2>Registration &amp; Pricing</h2>
          <p className="muted">Configure price and registration period for each channel.</p>
          <div className="registration-channels">
            {REGISTRATION_CHANNELS.map((channel) => (
              <div key={channel.key} className="registration-channel-card">
                <div>
                  <strong>{channel.label}</strong>
                  <span className="muted">{channel.description}</span>
                </div>
                <div className="form-grid">
                  <Field label="Price">
                    <div className="social-input-wrap">
                      <span>Rp</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        placeholder="Enter price"
                        value={draft[channel.key + "Price"] ?? ""}
                        onChange={(evt) => set(channel.key + "Price", evt.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Open Date">
                    <Input
                      type="datetime-local"
                      value={draft[channel.key + "Open"] ?? ""}
                      onChange={(evt) => set(channel.key + "Open", evt.target.value)}
                    />
                  </Field>
                  <Field label="Closed Date">
                    <Input
                      type="datetime-local"
                      value={draft[channel.key + "Close"] ?? ""}
                      onChange={(evt) => set(channel.key + "Close", evt.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </section>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link className="link-button secondary" href={backPath(event.id)}>
            Cancel
          </Link>
          <Button type="submit">
            <Save size={16} />
            Save Competition
          </Button>
        </div>
      </form>
    </div>
  );
}
