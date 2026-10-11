"use client";
import { CalendarOff } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageColumns } from "@/components/common/page-layout";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants/routes";
import { useHomeSchedule } from "../_hooks/use-home-schedule";
import { HOME_TEXT } from "../_lib/home-text";
import { HomeStats } from "./home-stats";
import { TodayEvent } from "./today-event";
import { UpcomingCard } from "./upcoming-card";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Home admin dan organizer: event hari ini (kartu Live now + daftar kompetisi), statistik
 * singkat, dan "Coming up". Tanpa event hari ini tampil empty state dengan link ke Events.
 * Dipanggil dari `home-page.tsx`.
 */
export function OrganizerHome() {
  const { user } = useAuth();
  const schedule = useHomeSchedule();
  const firstName = user?.name.split(" ")[0] ?? "";
  const hasToday = schedule.today.length > 0;

  return (
    <div className="page-stack">
      <header>
        <p className="text-muted-foreground text-sm font-semibold">
          {dateFormat.format(new Date())}
        </p>
        <h1>
          {hasToday
            ? HOME_TEXT.eventDay
            : `Hi${firstName ? ", " + firstName : ""}`}
        </h1>
      </header>

      {schedule.isError ? (
        <ErrorState
          error={schedule.error}
          fallback={HOME_TEXT.loadError}
          onRetry={() => void schedule.refetch()}
        />
      ) : schedule.isPending ? (
        <p role="status" className="text-muted-foreground">
          {HOME_TEXT.loading}
        </p>
      ) : (
        <>
          <HomeStats
            eventsToday={schedule.today.length}
            upcomingTotal={schedule.upcomingTotal}
            isAdmin={schedule.isAdmin}
          />
          <PageColumns
            main={
              hasToday ? (
                schedule.today.map((event) => (
                  <TodayEvent key={event.id} event={event} />
                ))
              ) : (
                <EmptyState
                  icon={CalendarOff}
                  message={
                    <>
                      <b className="text-foreground block">
                        {HOME_TEXT.noEventTitle}
                      </b>
                      {HOME_TEXT.noEventMessage}
                    </>
                  }
                  action={{
                    label: HOME_TEXT.goToEvents,
                    href: ROUTES.eventManagement.root,
                  }}
                />
              )
            }
            aside={<UpcomingCard events={schedule.upcoming} />}
          />
        </>
      )}
    </div>
  );
}
