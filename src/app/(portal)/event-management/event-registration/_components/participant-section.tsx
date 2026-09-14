"use client";
import { Field } from "@/components/ui/form-controls";
import { SearchSelect } from "@/components/common/search-select";
import type { PortalRecord } from "@/types/portal";

export function ParticipantSection({
  users,
  participant,
  onSelect,
}: {
  users: PortalRecord[];
  participant?: PortalRecord;
  onSelect: (userId: string) => void;
}) {
  return (
    <>
      <section className="form-section pet-detail-card">
        <div className="eyebrow">STEP 2</div>
        <h2>Find Participant</h2>
        <p className="muted">
          Search User Management by User ID, First Name, Last Name, Email, or
          Phone.
        </p>
        <Field label="User">
          <SearchSelect
            items={users}
            value={participant?.id ?? ""}
            onChange={onSelect}
            getId={(user) => user.id}
            getLabel={(user) => user.name}
            getDescription={(user) => user.id + " · " + (user.phone || user.email || "-")}
            placeholder="Search User ID, first name, last name, email, or phone"
          />
        </Field>
      </section>
      {participant && (
        <section className="form-section pet-detail-card">
          <div className="eyebrow">PARTICIPANT DETAILS</div>
          <h2>{participant.name}</h2>
          <p className="muted">Read-only user information from User Management.</p>
          <dl className="detail-grid">
            <div>
              <dt>User ID</dt>
              <dd>{participant.id}</dd>
            </div>
            <div>
              <dt>First Name</dt>
              <dd>{participant.firstName}</dd>
            </div>
            <div>
              <dt>Last Name</dt>
              <dd>{participant.lastName || "-"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{participant.phone}</dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}
