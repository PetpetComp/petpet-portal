"use client";
import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Right-side panel for "add / edit" forms. Keeps the list visible behind it. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[61] flex w-[min(460px,100%)] flex-col bg-white shadow-lg">
          <header className="border-border flex items-start justify-between gap-3 border-b p-5">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-muted-foreground mt-1">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close">
                <X size={18} />
              </Button>
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && (
            <footer className="border-border flex justify-end gap-2 border-t p-4">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
