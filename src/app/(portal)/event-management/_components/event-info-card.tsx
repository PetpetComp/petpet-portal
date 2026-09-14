import { StatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";

export function EventInfoCard({ event }: { event: PortalRecord }) {
  return (
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">EVENT INFORMATION</div>
          <h2>{event.name}</h2>
          <p className="muted">Organized by {event.organizer || "-"}</p>
        </div>
        <StatusBadge status={event.status} />
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Event ID</dt>
          <dd>{event.id}</dd>
        </div>
        <div>
          <dt>Start Date</dt>
          <dd>{formatDateTime(event.startDate)}</dd>
        </div>
        <div>
          <dt>End Date</dt>
          <dd>{formatDateTime(event.endDate)}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{event.address || "-"}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{event.location || "-"}</dd>
        </div>
      </dl>
    </section>
  );
}
