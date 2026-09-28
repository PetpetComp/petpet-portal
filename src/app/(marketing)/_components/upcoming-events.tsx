"use client";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { EVENT_SERVICES } from "@/services/event-management";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";
import { formatDate } from "@/lib/format/date";
import styles from "../landing.module.css";

export function UpcomingEvents() {
  const [events, setEvents] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    collectRows(EVENT_SERVICES.list)
      .then((rows) => {
        if (active) setEvents(rows.filter((row) => row.status !== "Draft"));
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || events.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Event yang sedang dibuka">
      <h2 className={styles.sectionTitle}>Event yang sedang dibuka</h2>
      <p className={styles.sectionSubtitle}>
        Beberapa event yang bisa langsung kamu ikuti atau sponsori.
      </p>
      <div className={styles.eventGrid}>
        {events.slice(0, 3).map((event) => (
          <div key={String(event.uuid)} className={styles.eventCard}>
            <span className={styles.eventBadge}>{String(event.status ?? "Open")}</span>
            <h3>{String(event.name ?? "")}</h3>
            <span className={styles.eventMeta}>
              <CalendarDays size={14} aria-hidden="true" />
              {event.start_at ? formatDate(String(event.start_at)) : "-"}
            </span>
            {event.venue_name ? (
              <span className={styles.eventMeta}>
                <MapPin size={14} aria-hidden="true" />
                {String(event.venue_name)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
