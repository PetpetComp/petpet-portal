"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-field";
import {
  isValidEmail,
  organizerDisplayName,
  type OrganizerChoice,
  type OrganizerStepErrors,
  type PicChoice,
} from "@/domains/events/create-flow";
import type { Organization } from "@/domains/organizations/types";
import { useOrganizations } from "@/domains/organizations/queries";
import { useUserSearch } from "@/domains/users/queries";
import {
  USER_SEARCH_LIMIT,
  USER_SEARCH_MIN_LENGTH,
  type UserHit,
} from "@/domains/users/types";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { initials } from "@/lib/identity";
import { cn } from "@/lib/utils";

/** Maksimal organisasi yang ditampilkan sekaligus di hasil pencarian. */
const ORGANIZATION_LIMIT = 5;

const SECTION =
  "border-border grid gap-3 rounded-2xl border bg-white px-6 py-5";
const SEARCH_BOX =
  "flex min-h-12 items-center gap-2.5 rounded-xl border bg-white px-3.5";
const RESULT_LIST = "border-border overflow-hidden rounded-xl border";

type Props = {
  organizer: OrganizerChoice | null;
  onOrganizerChange: (organizer: OrganizerChoice | null) => void;
  pic: PicChoice | null;
  onPicChange: (pic: PicChoice | null) => void;
  errors: OrganizerStepErrors;
};

/**
 * Langkah 2 wizard New event: pilih organizer dari organisasi terverifikasi, lalu PIC event.
 * Memilih tidak menyimpan apa pun; semuanya baru dikirim di langkah Review (docs 08 bagian 9.1).
 * Dipanggil dari `EventCreateWizard`.
 */
export function OrganizerStep(props: Props) {
  return (
    <div className="grid gap-4">
      <OrganizerSection {...props} />
      <PicSection {...props} />
    </div>
  );
}

/**
 * Organisasi yang boleh dipilih akun ini. Super admin: semua. Lainnya: hanya organisasi
 * tempat akun menjadi OWNER atau ADMIN (backend menolak peran lain).
 */
function useChoosableOrganizations(): {
  items: Organization[] | undefined;
  isSuperAdmin: boolean;
  isPending: boolean;
  error: unknown;
} {
  const { hasRole, memberships } = useAuth();
  const organizations = useOrganizations();
  const isSuperAdmin = hasRole("SUPER_ADMIN");
  const managedIds = memberships
    .filter((m) => m.role === "OWNER" || m.role === "ADMIN")
    .map((m) => m.organizationId);
  return {
    items: isSuperAdmin
      ? organizations.data
      : organizations.data?.filter((o) => managedIds.includes(o.id)),
    isSuperAdmin,
    isPending: organizations.isPending,
    error: organizations.error,
  };
}

function OrganizerSection({ organizer, onOrganizerChange, errors }: Props) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const { items, isSuperAdmin, isPending, error } = useChoosableOrganizations();

  const term = query.trim().toLowerCase();
  const results = (items ?? [])
    .filter((o) => !term || o.name.toLowerCase().includes(term))
    .slice(0, ORGANIZATION_LIMIT);
  const selectedId = organizer?.kind === "existing" ? organizer.id : null;

  /** Memakai nama organisasi baru yang diketik super admin. */
  function applyNewOrganization() {
    const name = newName.trim();
    if (!name) return;
    onOrganizerChange({ kind: "new", name });
    setCreating(false);
  }

  return (
    <section className={SECTION} aria-labelledby="organizer-heading">
      <div className="grid gap-1">
        <b id="organizer-heading" className="text-[17px]">
          Organizer
        </b>
        <span className="text-muted-foreground">
          The organization that owns this event and its data.
        </span>
      </div>

      {organizer?.kind === "new" && (
        <div className="bg-primary-soft border-primary flex items-center gap-3 rounded-[14px] border-2 px-3.5 py-3">
          <b className="flex-1">{organizerDisplayName(organizer)}</b>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOrganizerChange(null)}
          >
            Change
          </Button>
        </div>
      )}

      {organizer?.kind !== "new" && (
        <>
          <label className="grid gap-1.5">
            <span className="font-bold">Search organization</span>
            <span className={cn(SEARCH_BOX, "border-input")}>
              <Search size={18} aria-hidden className="text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type organization name"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              />
            </span>
          </label>
          <div className={RESULT_LIST}>
            {isPending && (
              <p className="text-muted-foreground p-3.5 text-[13px]">
                Loading organizations...
              </p>
            )}
            {!!error && (
              <p role="alert" className="text-danger-ink p-3.5 text-[13px]">
                Unable to load organizations. Reload the page to try again.
              </p>
            )}
            {!isPending && !error && results.length === 0 && (
              <p className="text-muted-foreground p-3.5 text-[13px]">
                No verified organization matches.
              </p>
            )}
            {results.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() =>
                  onOrganizerChange({
                    kind: "existing",
                    id: org.id,
                    name: org.name,
                  })
                }
                aria-pressed={org.id === selectedId}
                className={cn(
                  "border-muted flex min-h-13 w-full items-center gap-3 border-b px-3.5 text-left",
                  org.id === selectedId ? "bg-primary-soft" : "bg-white",
                )}
              >
                <span className="bg-primary-soft grid size-8 place-items-center rounded-[10px] text-xs font-extrabold">
                  {initials(org.name, "OR")}
                </span>
                <b className="flex-1">{org.name}</b>
                {org.id === selectedId && (
                  <span className="text-primary font-bold">Selected</span>
                )}
              </button>
            ))}
            <div className="text-muted-foreground p-3.5 text-[13px]">
              Not listed? Organizers apply from Organizations.
              {isSuperAdmin && (
                <>
                  {" "}
                  Super admin can{" "}
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="text-primary font-bold"
                  >
                    create one on their behalf
                  </button>
                  .
                </>
              )}
            </div>
          </div>
          {creating && (
            <div className="bg-background grid gap-3 rounded-[14px] p-4">
              <label className="grid gap-1.5">
                <b>New organization name</b>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={200}
                  className={fieldClass}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={applyNewOrganization}
                  disabled={!newName.trim()}
                >
                  Use this name
                </Button>
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {errors.organizer && (
        <span
          role="alert"
          className="text-danger-ink text-[13px] font-semibold"
        >
          {errors.organizer}
        </span>
      )}
    </section>
  );
}

function PicSection({ organizer, pic, onPicChange, errors }: Props) {
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const debounced = useDebouncedValue(query);
  // Hanya organisasi yang sudah ada punya anggota; organisasi baru belum.
  const organizationId =
    organizer?.kind === "existing" ? organizer.id : undefined;
  const search = useUserSearch(debounced, organizationId);
  const orgLabel =
    organizer?.kind === "existing" ? organizer.name : "the organizer";

  /** Memakai email yang diketik sebagai PIC undangan, setelah dicek formatnya. */
  function applyInvitation() {
    if (!isValidEmail(inviteEmail)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setInviteError("");
    onPicChange({ kind: "invite", email: inviteEmail.trim() });
    setInviting(false);
  }

  function pick(hit: UserHit) {
    onPicChange({
      kind: "user",
      id: hit.id,
      name: hit.name,
      email: hit.email,
      isMember: hit.isMember,
    });
    setInviting(false);
  }

  const items = search.data?.items ?? [];
  const typedEnough = query.trim().length >= USER_SEARCH_MIN_LENGTH;
  const note = !typedEnough
    ? `Type at least ${USER_SEARCH_MIN_LENGTH} characters`
    : search.isPending || debounced.trim() !== query.trim()
      ? "Searching..."
      : `${search.data?.total ?? 0} found, showing ${Math.min(USER_SEARCH_LIMIT, items.length)}`;

  return (
    <section className={SECTION} aria-labelledby="pic-heading">
      <div className="grid gap-1">
        <b id="pic-heading" className="text-[17px]">
          Event PIC
        </b>
        <span className="text-muted-foreground">
          Any registered user. Members of {orgLabel} are listed first. The PIC
          gets Event manager access.
        </span>
      </div>

      {pic ? (
        <SelectedPic pic={pic} onChange={() => onPicChange(null)} />
      ) : (
        <>
          <label className="grid gap-1.5">
            <span className="font-bold">
              Search user by name, email or phone
            </span>
            <span className={cn(SEARCH_BOX, "border-primary border-2")}>
              <Search size={18} aria-hidden className="text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`At least ${USER_SEARCH_MIN_LENGTH} characters`}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              />
            </span>
          </label>
          <div className={RESULT_LIST}>
            {items.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => pick(hit)}
                className="border-muted flex min-h-14 w-full items-center gap-3 border-b bg-white px-3.5 text-left"
              >
                <span className="bg-primary-soft text-primary-dark grid size-9 place-items-center rounded-full text-[13px] font-extrabold">
                  {initials(hit.name, "?")}
                </span>
                <span className="flex flex-1 flex-col">
                  <b>{hit.name}</b>
                  <span className="text-muted-foreground text-[13px]">
                    {hit.email}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-primary-dark rounded-full px-2.5 py-0.5 text-xs font-bold",
                    hit.isMember ? "bg-primary-soft" : "bg-background",
                  )}
                >
                  {hit.isMember ? "Member" : "User"}
                </span>
              </button>
            ))}
            {search.isError && (
              <p role="alert" className="text-danger-ink p-3.5 text-[13px]">
                {search.error instanceof Error
                  ? search.error.message
                  : "Unable to search users."}{" "}
                You can still invite the PIC by email.
              </p>
            )}
            <div className="text-muted-foreground p-3.5 text-[13px]">
              {note} · Not found?{" "}
              <button
                type="button"
                onClick={() => setInviting(true)}
                className="text-primary font-bold"
              >
                Invite by email
              </button>
            </div>
          </div>
          {inviting && (
            <div className="bg-background grid gap-3 rounded-[14px] p-4">
              <label className="grid gap-1.5">
                <b>
                  Email <span className="text-danger-ink">*</span>
                </b>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  aria-invalid={!!inviteError}
                  className={fieldClass}
                />
              </label>
              {inviteError && (
                <span
                  role="alert"
                  className="text-danger-ink text-[13px] font-semibold"
                >
                  {inviteError}
                </span>
              )}
              <span className="text-muted-foreground">
                We email an invitation. They become PIC once they accept.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button onClick={applyInvitation}>Use this email</Button>
                <Button variant="ghost" onClick={() => setInviting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {errors.pic && (
        <span
          role="alert"
          className="text-danger-ink text-[13px] font-semibold"
        >
          {errors.pic}
        </span>
      )}
    </section>
  );
}

/** Kartu PIC terpilih dengan tombol Change. */
function SelectedPic({
  pic,
  onChange,
}: {
  pic: PicChoice;
  onChange: () => void;
}) {
  const name = pic.kind === "user" ? pic.name : pic.email;
  const sub =
    pic.kind === "invite"
      ? "Invitation by email"
      : `${pic.email} · ${pic.isMember ? "member" : "not a member yet"}`;
  return (
    <div className="bg-primary-soft border-primary flex min-h-15 items-center gap-3 rounded-[14px] border-2 px-3.5">
      <span className="text-primary-dark grid size-9 place-items-center rounded-full bg-white text-[13px] font-extrabold">
        {initials(name, "?")}
      </span>
      <span className="flex flex-1 flex-col">
        <b>{name}</b>
        <span className="text-muted-foreground text-[13px]">{sub}</span>
      </span>
      <Button variant="secondary" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}
