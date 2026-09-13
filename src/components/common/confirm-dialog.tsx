"use client";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Delete",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="pr-10 text-lg font-bold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-3">
            {description}
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              size="icon"
              variant="ghost"
              className="dialog-close"
              aria-label="Close"
            >
              <X size={18} />
            </Button>
          </Dialog.Close>
          <div className="form-actions mt-6">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
