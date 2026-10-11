"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useAddBrandPic } from "@/domains/brands/queries";
import { useUserSearch } from "@/domains/users/queries";
import {
  USER_SEARCH_LIMIT,
  USER_SEARCH_MIN_LENGTH,
  type UserHit,
} from "@/domains/users/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { initials } from "@/lib/identity";

/**
 * Drawer "Add PIC": cari user (minimal 2 huruf), pilih satu, simpan.
 * Dipanggil dari `BrandDetailPage`. `existingPicIds` = user yang sudah PIC brand ini; mereka
 * tampil tetapi tidak bisa dipilih lagi. Galat dari server tampil di bawah form.
 * Menutup drawer mengosongkan pilihan dan pencarian supaya pembukaan berikutnya bersih.
 */
export function AddPicDrawer({
  brandId,
  existingPicIds,
  open,
  onOpenChange,
}: {
  brandId: string;
  existingPicIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<UserHit | null>(null);
  const add = useAddBrandPic(brandId);
  const debounced = useDebouncedValue(query);
  const search = useUserSearch(debounced);

  function reset() {
    setQuery("");
    setChosen(null);
    add.reset();
  }

  function submit() {
    if (!chosen) return;
    add.mutate(chosen.id, {
      onSuccess: () => {
        toast.success(`${chosen.name} added as PIC`);
        reset();
        onOpenChange(false);
      },
    });
  }

  const items = search.data?.items ?? [];
  const typedEnough = query.trim().length >= USER_SEARCH_MIN_LENGTH;
  const waiting = debounced.trim() !== query.trim() || search.isPending;
  const note = !typedEnough
    ? `Type at least ${USER_SEARCH_MIN_LENGTH} characters.`
    : waiting
      ? "Searching..."
      : `${search.data?.total ?? 0} found, showing ${Math.min(USER_SEARCH_LIMIT, items.length)}.`;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Add PIC"
      description="A PIC is the person at the brand we talk to. Pick an existing user."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!chosen || add.isPending}>
            {add.isPending ? "Adding..." : "Add PIC"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {chosen ? (
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setChosen(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-bold">Name, email or phone</span>
              <span className="border-input focus-within:border-primary flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3">
                <Search
                  size={16}
                  aria-hidden
                  className="text-muted-foreground"
                />
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
                {items.map((hit) => {
                  const already = existingPicIds.includes(hit.id);
                  return (
                    <li key={hit.id}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => setChosen(hit)}
                        className="border-muted hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b bg-white px-3.5 text-left last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60"
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
                        {already && (
                          <span className="bg-primary-soft text-primary-dark rounded-full px-2.5 py-0.5 text-xs font-bold">
                            Already a PIC
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {search.isError && typedEnough && (
              <p
                role="alert"
                className="text-danger-ink text-[13px] font-semibold"
              >
                {search.error instanceof Error
                  ? search.error.message
                  : "Unable to search users."}
              </p>
            )}
            <p className="text-muted-foreground text-[13px]" aria-live="polite">
              {note}
            </p>
          </div>
        )}

        {add.isError && (
          <p role="alert" className="text-danger-ink font-semibold">
            {add.error instanceof Error
              ? add.error.message
              : "Unable to add the PIC."}
          </p>
        )}
      </div>
    </Drawer>
  );
}
