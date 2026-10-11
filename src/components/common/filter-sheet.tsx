"use client";
import { useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tombol "Filter" + panel yang meluncur dari tepi kanan (pola list di semua menu Data).
 * Isi panel (`children`) adalah form DRAFT milik halaman: perubahan baru berlaku setelah
 * "Apply" ditekan, "Reset" mengosongkan semua filter. Pencarian TIDAK di sini, tetap di atas tabel.
 *
 * - `activeCount`: jumlah filter yang sedang berlaku (lencana di tombol).
 * - `onOpen`: dipanggil saat panel dibuka, halaman menyalin filter berlaku ke draft.
 * - `onApply`: halaman menyalin draft ke filter berlaku (panel menutup sendiri).
 * - `onReset`: mengosongkan filter berlaku dan draft.
 */
export function FilterSheet({
  activeCount,
  onOpen,
  onApply,
  onReset,
  children,
}: {
  activeCount: number;
  onOpen?: () => void;
  onApply: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpen?.();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" className="min-h-11 gap-2 rounded-xl">
          <ListFilter size={16} aria-hidden="true" />
          Filter
          {activeCount > 0 && (
            <span className="bg-primary inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-[61] flex w-[min(360px,100%)] flex-col bg-white shadow-lg"
        >
          <header className="border-border flex items-center justify-between gap-3 border-b p-5">
            <Dialog.Title className="font-display text-xl font-semibold">
              Filters
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close filters">
                <X size={18} aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="grid flex-1 content-start gap-4 overflow-y-auto p-5">
            {children}
          </div>
          <footer className="border-border flex justify-between gap-2 border-t p-4">
            <Button variant="secondary" onClick={onReset}>
              Reset
            </Button>
            <Button
              onClick={() => {
                onApply();
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
