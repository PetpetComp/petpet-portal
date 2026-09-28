"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePortalData } from "@/components/providers/portal-data-provider";
import {
  ORGANIZATION_SERVICES,
  mapOrganization,
  type OrganizationRecord,
} from "@/services/organization";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { collectRows } from "@/services/common";
import { Button } from "@/components/ui/button";
import type { Organization, OrganizationDraft } from "@/types/organization";
import { OrganizationForm } from "./organization-form";
import { OrganizationList } from "./organization-list";

function matchesQuery(organization: Organization, query: string): boolean {
  return [
    organization.name,
    organization.campaign,
    ...organization.pics.map((pic) => pic.name),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase());
}

function readDrafts(key: string): Organization[] {
  const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (
    !Array.isArray(raw) ||
    !raw.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.photo === "string" &&
        typeof item.campaign === "string" &&
        Array.isArray(item.pics) &&
        item.pics.every(
          (pic: Record<string, unknown>) =>
            pic && typeof pic.id === "string" && typeof pic.name === "string",
        ),
    )
  ) {
    throw new Error("Saved organization drafts could not be read.");
  }
  return raw;
}
export function OrganizationWorkspace({
  mode = "list",
  id,
}: {
  mode?: "list" | "create" | "edit";
  id?: string;
}) {
  const { user } = useAuth();
  const { data, errors, save } = usePortalData();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [drafts, setDrafts] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(mode !== "create" && mode !== "list");
  const [loadError, setLoadError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const storageKey = user ? "petpet.organization-drafts.v1." + user.id : null;
  const draftId = id?.startsWith("draft:") ? id.slice(6) : undefined;
  const list = usePaginatedList<OrganizationRecord, Organization>(
    ORGANIZATION_SERVICES.list,
    mapOrganization,
    query,
    matchesQuery,
    mode === "list",
  );
  useEffect(() => {
    let active = true;
    async function load() {
      if (storageKey) {
        try {
          const stored = readDrafts(storageKey);
          if (active) setDrafts(stored);
        } catch (cause) {
          if (active)
            setDraftError(
              cause instanceof Error
                ? cause.message
                : "Unable to read browser drafts.",
            );
        }
      }
      if (mode === "create" || mode === "list") return;
      if (mode === "edit" && id && !draftId) {
        const response = await ORGANIZATION_SERVICES.detail(id);
        if (active) setOrganizations([mapOrganization(response.data)]);
      } else {
        const rows = await collectRows(ORGANIZATION_SERVICES.list);
        if (active) setOrganizations(rows.map(mapOrganization));
      }
    }
    load()
      .catch((cause) => {
        if (active)
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "Unable to load organizations.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, id, draftId, storageKey, attempt]);

  async function submit(draft: OrganizationDraft) {
    const existing = organizations.find((org) => org.id === (draftId ?? id));
    if (existing) await ORGANIZATION_SERVICES.update(existing.id, draft);
    else await ORGANIZATION_SERVICES.create(draft);
    if (draftId && storageKey) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(
            readDrafts(storageKey).filter((item) => item.id !== draftId),
          ),
        );
      } catch {
        toast.warning(
          "Organization saved, but the old browser draft could not be cleared.",
        );
      }
    }
    toast.success("Organization saved");
    router.push("/organization-management");
  }

  if (loading) return <p role="status">Loading organizations...</p>;
  if (loadError)
    return (
      <div className="page-stack">
        <p role="alert" className="form-error">
          {loadError}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setLoadError("");
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </Button>
        <Link href="/organization-management">Back to organizations</Link>
      </div>
    );
  const organization = draftId
    ? drafts.find((item) => item.id === draftId)
    : organizations.find((item) => item.id === id);
  const populated = list.rows.map((org) => ({
    ...org,
    pics: org.pics.map(
      (pic) => data.users.find((item) => item.id === pic.id) ?? pic,
    ),
  }));
  return (
    <div className="page-stack">
      {draftError && (
        <p role="alert" className="form-error">
          {draftError}
        </p>
      )}
      {draftId && (
        <p className="muted">
          Review this browser draft and save it to your organization account.
        </p>
      )}
      {mode === "list" ? (
        <>
          <OrganizationList
            organizations={populated}
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              list.setPage(0);
            }}
            loadError={list.error}
            server={{
              page: list.page,
              pageSize: list.pageSize,
              total: list.total,
              onPageChange: list.setPage,
              onPageSizeChange: list.setPageSize,
              loading: list.loading,
            }}
          />
          {drafts.length > 0 && (
            <section className="form-section page-stack">
              <h2>Browser drafts</h2>
              <p className="muted">
                These drafts have not been synced. Open one to review and save
                it.
              </p>
              {drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={
                    "/organization-management/" +
                    encodeURIComponent("draft:" + draft.id) +
                    "/edit"
                  }
                >
                  Continue draft: {draft.name}
                </Link>
              ))}
            </section>
          )}
        </>
      ) : mode === "edit" && !organization ? (
        <div>
          <p>Organization not found.</p>
          <Link href="/organization-management">Back to organizations</Link>
        </div>
      ) : (
        <OrganizationForm
          key={id ?? "create"}
          organization={organization}
          users={data.users}
          userError={errors.users}
          onSave={submit}
          onCreateUser={(record) => save("users", record)}
        />
      )}
    </div>
  );
}
