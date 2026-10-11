"use client";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { SectionCard } from "@/components/common/page-layout";
import { useAssignmentRoles } from "@/domains/staff/queries";
import { roleLabel } from "@/domains/staff/roles";
import {
  ASSIGNMENTS_TEXT,
  ROLE_GUIDE,
  ROLE_GUIDE_FALLBACK,
} from "@/domains/staff/constants";
import { distinctRoles } from "@/domains/staff/my-assignments";
import { useAuth } from "@/hooks/use-auth";
import { useMyAssignments } from "../_hooks/use-my-assignments";
import { AssignmentCard } from "./assignment-card";

/** Huruf awal nama untuk avatar di pojok kanan atas ("Farhan Hidayat" -> "FH"). */
function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/**
 * Layar My assignments (HP dulu): kompetisi hari ini yang ditugaskan ke akun ini, kartu peran,
 * dan footer. Satu kolom dan tidak scroll ke samping di 375px; di desktop dipusatkan.
 * Dipanggil dari `assignments/page.tsx`.
 */
export function AssignmentsPage() {
  const { user } = useAuth();
  const mine = useMyAssignments();
  const roles = useAssignmentRoles();
  const labelOf = (code: string) => roleLabel(roles.data ?? [], code);
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-lg min-w-0 content-start gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {firstName && (
            <p className="text-muted-foreground text-sm">
              {ASSIGNMENTS_TEXT.greeting}, {firstName}
            </p>
          )}
          <h1 className="font-display text-3xl">{ASSIGNMENTS_TEXT.title}</h1>
        </div>
        {user && (
          <span
            aria-hidden
            className="bg-primary-soft text-primary-dark grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold"
          >
            {initialsOf(user.name)}
          </span>
        )}
      </header>

      {mine.isLoading && (
        <p role="status" className="text-muted-foreground">
          Loading your assignments...
        </p>
      )}

      {!mine.isLoading && mine.isError && (
        <ErrorState
          error={mine.error}
          fallback={ASSIGNMENTS_TEXT.loadError}
          onRetry={() => void mine.refetch()}
        />
      )}

      {!mine.isLoading && !mine.isError && mine.groups.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          message={
            <>
              <b className="text-foreground block">
                {ASSIGNMENTS_TEXT.emptyTitle}
              </b>
              {ASSIGNMENTS_TEXT.emptyMessage}
            </>
          }
        />
      )}

      {!mine.isLoading &&
        !mine.isError &&
        mine.groups.map((group) => (
          <section
            key={group.event.id}
            aria-label={group.event.name}
            className="grid gap-3"
          >
            <h2 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {ASSIGNMENTS_TEXT.todayHeading(group.event.name)}
            </h2>
            <ul className="grid gap-3">
              {group.cards.map((card) => (
                <AssignmentCard
                  key={card.key}
                  card={card}
                  roleLabel={labelOf(card.role)}
                />
              ))}
            </ul>
          </section>
        ))}

      {!mine.isLoading &&
        !mine.isError &&
        distinctRoles(mine.groups).map((code) => (
          <SectionCard
            key={code}
            title={ASSIGNMENTS_TEXT.roleTitle(labelOf(code))}
          >
            <p className="text-muted-foreground text-sm">
              {ROLE_GUIDE[code] ?? ROLE_GUIDE_FALLBACK}
            </p>
          </SectionCard>
        ))}

      <p className="text-muted-foreground mt-4 text-center text-sm">
        {ASSIGNMENTS_TEXT.footer}
      </p>
    </div>
  );
}
