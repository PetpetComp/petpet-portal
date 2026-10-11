"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { homeAudience } from "../_lib/home";
import { HOME_TEXT } from "../_lib/home-text";
import { OrganizerHome } from "./organizer-home";

/**
 * Pintu Home. Dipanggil dari `home/page.tsx`. Memilih tampilan dari profil akses:
 * admin dan organizer melihat `OrganizerHome`; staf dan juri (hanya punya penugasan)
 * dialihkan ke My assignments di sisi klien setelah profil akses diketahui, dengan teks
 * memuat selama menunggu supaya Home organizer tidak sempat berkedip.
 */
export function HomePage() {
  const router = useRouter();
  const { can, assignments, loading } = useAuth();
  const audience = homeAudience({
    loading,
    isManager:
      can(PERMISSION.EVENT_UPDATE) || can(PERMISSION.ORGANIZATION_VERIFY),
    assignmentCount: assignments.length,
  });

  useEffect(() => {
    if (audience === "staff") router.replace(ROUTES.assignments);
  }, [audience, router]);

  if (audience === "loading" || audience === "staff")
    return (
      <p role="status" className="text-muted-foreground">
        {audience === "staff" ? HOME_TEXT.redirecting : HOME_TEXT.loading}
      </p>
    );

  if (audience === "none")
    return (
      <EmptyState
        icon={Inbox}
        message={
          <>
            <b className="text-foreground block">
              {HOME_TEXT.nothingToManageTitle}
            </b>
            {HOME_TEXT.nothingToManageMessage}
          </>
        }
      />
    );

  return <OrganizerHome />;
}
