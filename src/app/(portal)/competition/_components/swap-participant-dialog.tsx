"use client";
import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import type { PortalRecord } from "@/types/portal";

export function SwapParticipantDialog({
  open,
  onOpenChange,
  currentPet,
  candidates,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPet?: PortalRecord;
  candidates: PortalRecord[];
  onConfirm: (candidateId: string) => void;
}) {
  const [candidateId, setCandidateId] = useState("");
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setCandidateId("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="pr-10 text-lg font-bold">Swap Participant</Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-3">
            Choose another participant in the same round who does not have a
            match result.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button size="icon" variant="ghost" className="dialog-close" aria-label="Close">
              <X size={18} />
            </Button>
          </Dialog.Close>
          <div className="page-stack mt-4">
            <div className="swap-current-participant">
              <span>CURRENT PARTICIPANT</span>
              <strong>{currentPet?.name ?? "-"}</strong>
            </div>
            <Field label="Swap With *">
              <Select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                <option value="">Select participant</option>
                {candidates.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="form-actions mt-6">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              disabled={!candidateId}
              onClick={() => {
                onConfirm(candidateId);
                onOpenChange(false);
                setCandidateId("");
              }}
            >
              Confirm Swap
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
