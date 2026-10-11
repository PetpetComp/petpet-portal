"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { useUserSearch } from "@/domains/users/queries";
import { USER_SEARCH_MIN_LENGTH, type UserHit } from "@/domains/users/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/**
 * Pemilih pemilik pet untuk staf (pola yang sama dengan langkah "Owner" di drawer Register pet):
 * ketik minimal 2 huruf, pilih satu user dari hasil, lalu tombol "Change" untuk memilih ulang.
 * Pencarian memakai `useUserSearch` dari domain users. Dipanggil dari form pet saat membuat pet
 * di mode mock; `onChange(null)` berarti kembali ke "akun saya sendiri".
 */
export function PetOwnerPicker({
  owner,
  onChange,
}: {
  owner: UserHit | null;
  onChange: (owner: UserHit | null) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useUserSearch(useDebouncedValue(query));
  const typedEnough = query.trim().length >= USER_SEARCH_MIN_LENGTH;

  if (owner)
    return (
      <div className="border-primary bg-primary-soft flex items-center justify-between gap-3 rounded-xl border p-3">
        <span className="min-w-0">
          <b>{owner.name}</b>
          <span className="text-muted-foreground block text-sm break-words">
            {[owner.email, owner.phone].filter(Boolean).join(" · ")}
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          Change
        </Button>
      </div>
    );

  return (
    <div className="grid gap-2">
      <Input
        type="search"
        aria-label="Search owner"
        placeholder="Name, username, email or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {!typedEnough ? (
        <p className="text-muted-foreground text-sm">
          Type at least {USER_SEARCH_MIN_LENGTH} characters, or leave empty to
          register the pet under your own account.
        </p>
      ) : (
        <ul
          className="border-border grid rounded-xl border"
          aria-label="Owners found"
        >
          {results.isFetching && !results.data && (
            <li className="text-muted-foreground p-3">Searching...</li>
          )}
          {results.isError && (
            <li className="text-danger p-3">
              {results.error instanceof Error
                ? results.error.message
                : "Search failed."}
            </li>
          )}
          {results.data?.items.length === 0 && (
            <li className="text-muted-foreground p-3">No owner found.</li>
          )}
          {results.data?.items.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onChange(hit)}
                className="hover:bg-muted w-full p-3 text-left"
              >
                <b>{hit.name}</b>
                <span className="text-muted-foreground block text-sm break-words">
                  {hit.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
