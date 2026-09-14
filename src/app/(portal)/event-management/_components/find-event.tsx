"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Field, Input } from "@/components/ui/form-controls";
import type { PortalRecord } from "@/types/portal";
import { isEligibleEvent } from "../_lib/event-rules";

export function FindEvent({
  events,
  onSelect,
  eyebrow,
}: {
  events: PortalRecord[];
  onSelect: (event: PortalRecord) => void;
  eyebrow?: string;
}) {
  const [query, setQuery] = useState("");
  const matches = query
    ? events
        .filter(isEligibleEvent)
        .filter((event) => event.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : [];
  return (
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>Find Event</h2>
          <p className="muted">Search active or upcoming events by Event Name.</p>
        </div>
        <span className="muted">Open &amp; Pending only</span>
      </div>
      <Field label="Event Name">
        <div className="search-select-input">
          <Search size={14} aria-hidden="true" />
          <Input
            type="search"
            placeholder="Type event name, e.g. Surabaya Paw Race"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Field>
      {query && (
        <ul className="search-select-results search-select-results-static">
          {matches.length ? (
            matches.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => onSelect(event)}>
                  <strong>{event.name}</strong>
                  <small>{event.organizer || "-"} · {event.status}</small>
                </button>
              </li>
            ))
          ) : (
            <li className="search-select-empty">No matching event found.</li>
          )}
        </ul>
      )}
    </section>
  );
}
