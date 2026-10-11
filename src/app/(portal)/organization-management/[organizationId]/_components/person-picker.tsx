"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSearch } from "@/domains/users/queries";
import {
  USER_SEARCH_LIMIT,
  USER_SEARCH_MIN_LENGTH,
  type UserHit,
} from "@/domains/users/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { initials } from "@/lib/identity";

/**
 * Kotak cari user untuk drawer "Invite member": ketik minimal 2 huruf (ditunda 300 ms),
 * maksimal 5 hasil, anggota organisasi ini diurutkan duluan oleh server (`organization_id`).
 * Hasil yang sudah anggota ditandai "Member" dan tidak bisa dipilih. Bila sudah ada pilihan,
 * tampil kartu orang terpilih dengan tombol Change.
 * Dipanggil dari `InviteMemberDrawer`.
 */
export function PersonPicker({
  organizationId,
  chosen,
  onChoose,
  onClear,
}: {
  organizationId: string;
  chosen: UserHit | null;
  onChoose: (hit: UserHit) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query);
  const search = useUserSearch(debounced, organizationId);

  if (chosen)
    return (
      <div className="bg-primary-soft border-primary flex min-h-15 items-center gap-3 rounded-[14px] border-2 px-3.5">
        <span className="text-primary-dark grid size-9 place-items-center rounded-full bg-white text-[13px] font-extrabold">
          {initials(chosen.name, "?")}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="break-words">{chosen.name}</b>
          <span className="text-muted-foreground text-[13px] break-all">
            {chosen.email}
          </span>
        </span>
        <Button variant="secondary" size="sm" onClick={onClear}>
          Change
        </Button>
      </div>
    );

  const items = search.data?.items ?? [];
  const typedEnough = query.trim().length >= USER_SEARCH_MIN_LENGTH;
  const waiting = debounced.trim() !== query.trim() || search.isPending;
  const note = !typedEnough
    ? `Type at least ${USER_SEARCH_MIN_LENGTH} characters.`
    : waiting
      ? "Searching..."
      : `${search.data?.total ?? 0} found, showing ${Math.min(USER_SEARCH_LIMIT, items.length)}.`;

  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5">
        <span className="text-sm font-bold">Name, email or phone</span>
        <span className="border-input focus-within:border-primary flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3">
          <Search size={16} aria-hidden className="text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            placeholder={`At least ${USER_SEARCH_MIN_LENGTH} characters`}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
        </span>
      </label>
      {typedEnough && !waiting && items.length > 0 && (
        <ul
          aria-label="Users found"
          className="border-border overflow-hidden rounded-xl border"
        >
          {items.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                disabled={hit.isMember}
                onClick={() => onChoose(hit)}
                className="border-muted hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b bg-white px-3.5 text-left last:border-b-0 disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="bg-primary-soft text-primary-dark grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                >
                  {initials(hit.name, "?")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="break-words">{hit.name}</b>
                  <span className="text-muted-foreground text-[13px] break-all">
                    {hit.email}
                  </span>
                </span>
                {hit.isMember && (
                  <span className="bg-primary-soft text-primary-dark rounded-full px-2.5 py-0.5 text-xs font-bold">
                    Already a member
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.isError && typedEnough && (
        <p role="alert" className="text-danger-ink text-[13px] font-semibold">
          {search.error instanceof Error
            ? search.error.message
            : "Unable to search users."}{" "}
          You can still invite by email.
        </p>
      )}
      <p className="text-muted-foreground text-[13px]" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
