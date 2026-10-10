"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Select } from "@/components/ui/form-controls";
import { useAddSponsor } from "@/domains/sponsors/queries";
import {
  SPONSOR_LEVELS,
  levelLabel,
  type Brand,
} from "@/domains/sponsors/types";
import { cn } from "@/lib/utils";

/** Tier yang terpilih saat drawer dibuka. */
const DEFAULT_LEVEL = "GOLD";

/**
 * Drawer "Add sponsor": pilih satu brand yang belum terhubung ke event, pilih tier, simpan.
 * Dipanggil dari `EventSponsors`. `brands` sudah disaring (hanya yang belum terhubung).
 * Galat dari server (mis. 422 brand sudah terhubung) ditampilkan di bawah form.
 */
export function AddSponsorDrawer({
  eventId,
  brands,
  open,
  onOpenChange,
}: {
  eventId: string;
  brands: Brand[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [level, setLevel] = useState<string>(DEFAULT_LEVEL);
  const add = useAddSponsor(eventId);

  const term = query.trim().toLowerCase();
  const shown = brands.filter((brand) =>
    brand.name.toLowerCase().includes(term),
  );

  /** Mengosongkan isian setiap drawer ditutup supaya pembukaan berikutnya bersih. */
  function reset() {
    setQuery("");
    setBrandId("");
    setLevel(DEFAULT_LEVEL);
    add.reset();
  }

  function submit() {
    if (!brandId) return;
    add.mutate(
      { brandId, level },
      {
        onSuccess: () => {
          toast.success("Sponsor added");
          reset();
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Add sponsor"
      description="Link a brand to this event and choose its tier."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!brandId || add.isPending}>
            {add.isPending ? "Adding…" : "Add sponsor"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <section className="grid gap-2">
          <label htmlFor="brand-search" className="font-semibold">
            1. Brand
          </label>
          <Input
            id="brand-search"
            type="search"
            placeholder="Search brand"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {brands.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every brand is already linked to this event.
            </p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No brand matches this search.
            </p>
          ) : (
            <ul
              aria-label="Brands"
              className="border-border grid max-h-72 overflow-y-auto rounded-xl border"
            >
              {shown.map((brand) => (
                <li key={brand.id}>
                  <button
                    type="button"
                    aria-pressed={brandId === brand.id}
                    onClick={() => setBrandId(brand.id)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left",
                      brandId === brand.id
                        ? "bg-primary-soft font-semibold"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0 truncate">{brand.name}</span>
                    {brandId === brand.id && (
                      <span className="text-primary text-sm">Selected</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-2">
          <label htmlFor="sponsor-tier" className="font-semibold">
            2. Tier
          </label>
          <Select
            id="sponsor-tier"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {SPONSOR_LEVELS.map((value) => (
              <option key={value} value={value}>
                {levelLabel(value)}
              </option>
            ))}
          </Select>
        </section>

        {add.isError && (
          <p role="alert" className="form-error">
            {add.error instanceof Error
              ? add.error.message
              : "Unable to add the sponsor."}
          </p>
        )}
      </div>
    </Drawer>
  );
}
