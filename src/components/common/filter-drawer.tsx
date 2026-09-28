"use client";
import { useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FilterDrawer({
  activeCount,
  onReset,
  onApply,
  onOpen,
  children,
}: {
  activeCount: number;
  onReset: () => void;
  onApply: () => void;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filter-trigger-group">
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) onOpen?.();
        }}
      >
        <Dialog.Trigger asChild>
          <Button variant="secondary" className="filter-trigger">
            <ListFilter size={16} aria-hidden="true" />
            Filter
            {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="filter-drawer" aria-describedby={undefined}>
            <div className="filter-drawer-header">
              <Dialog.Title>Filter</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Tutup filter">
                  <X size={18} aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="filter-drawer-body">{children}</div>
            <div className="filter-drawer-footer">
              <Button variant="secondary" onClick={onReset}>
                Reset
              </Button>
              <Button
                onClick={() => {
                  onApply();
                  setOpen(false);
                }}
              >
                Terapkan
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  );
}
