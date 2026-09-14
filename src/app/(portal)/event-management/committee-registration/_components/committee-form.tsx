"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { SearchSelect } from "@/components/common/search-select";
import type { PortalRecord } from "@/types/portal";
import { COMMITTEE_ROLES, isDuplicateCommitteeAssignment } from "../_lib/committee-rules";

const BASE_PATH = "/event-management/committee-registration";

export function CommitteeForm({
  mode,
  record,
  committee,
  users,
  events,
  competitions,
  onSave,
}: {
  mode: "create" | "edit";
  record?: PortalRecord;
  committee: PortalRecord[];
  users: PortalRecord[];
  events: PortalRecord[];
  competitions: PortalRecord[];
  onSave: (record: PortalRecord) => void;
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState(record?.eventId ?? events[0]?.id ?? "");
  const [competitionId, setCompetitionId] = useState(record?.competitionId ?? "");
  const [userId, setUserId] = useState(record?.userId ?? "");
  const [role, setRole] = useState(record?.role ?? "Event PIC");
  const [error, setError] = useState("");

  const eventCompetitions = competitions.filter((item) => item.eventId === eventId);

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!eventId || !userId || !role) {
      setError("Event, user, and role are required.");
      return;
    }
    const next: PortalRecord = {
      id: record?.id || "COM-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: "Committee " + eventId,
      eventId,
      competitionId: role === "Event PIC" ? "" : competitionId,
      userId,
      role,
    };
    if (isDuplicateCommitteeAssignment(committee, next)) {
      setError("This user already has this role for the selected scope.");
      return;
    }
    onSave(next);
    toast.success("Committee assignment saved");
    router.push(BASE_PATH + "/" + next.id);
  }

  return (
    <div className="page-stack">
      <Link className="back-link" href={record ? BASE_PATH + "/" + record.id : BASE_PATH}>
        Back to Committee Registration
      </Link>
      <header>
        <h1>{mode === "edit" ? "Edit Committee Assignment" : "Add Committee Assignment"}</h1>
        <p className="muted">Assign a user as Event PIC, Race PIC, or Judge.</p>
      </header>
      <form onSubmit={submit} className="page-stack">
        <section className="form-section">
          <div className="form-grid">
            <Field label="Event *">
              <Select
                required
                value={eventId}
                onChange={(evt) => {
                  setEventId(evt.target.value);
                  setCompetitionId("");
                }}
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Role *">
              <Select required value={role} onChange={(evt) => setRole(evt.target.value)}>
                {COMMITTEE_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            {role !== "Event PIC" && (
              <Field label="Competition (optional)">
                <Select value={competitionId} onChange={(evt) => setCompetitionId(evt.target.value)}>
                  <option value="">All competitions in this event</option>
                  {eventCompetitions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="form-grid-span-2">
              <Field label="User *">
                <SearchSelect
                  items={users}
                  value={userId}
                  onChange={setUserId}
                  getId={(user) => user.id}
                  getLabel={(user) => user.name}
                  getDescription={(user) => user.id + " · " + (user.phone || "no phone")}
                  placeholder="Search by name, User ID, or phone"
                />
              </Field>
            </div>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Link className="link-button secondary" href={BASE_PATH}>
              Cancel
            </Link>
            <Button type="submit">
              <Save size={16} />
              Save Assignment
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
