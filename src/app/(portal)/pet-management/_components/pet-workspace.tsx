"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord, ViewMode } from "@/types/portal";
import { PetList } from "./pet-list";
import { PetForm } from "./pet-form";
import { PetDetail } from "./pet-detail";
import { hasActiveRegistration } from "../_lib/pet-rules";

export function PetWorkspace({ mode = "list", id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const [deleting, setDeleting] = useState<PortalRecord | null>(null);
  const pet = id ? data.pets.find((item) => item.id === id) : undefined;

  function requestDelete(record: PortalRecord) {
    if (hasActiveRegistration(data.registrations, record.id)) {
      toast.error("This pet has an event registration and cannot be deleted.");
      return;
    }
    setDeleting(record);
  }

  if ((mode === "detail" || mode === "edit") && !pet) {
    return (
      <div className="page-stack">
        <PageHeading title="Pet not found" />
        <Link className="back-link" href="/pet-management">
          <ArrowLeft size={16} />
          Back to Pet Management
        </Link>
      </div>
    );
  }

  return (
    <>
      {mode === "list" && (
        <PetList pets={data.pets} onRequestDelete={requestDelete} />
      )}
      {mode === "create" && (
        <PetForm mode="create" pets={data.pets} users={data.users} onSave={(record) => save("pets", record)} />
      )}
      {mode === "edit" && pet && (
        <PetForm
          mode="edit"
          pet={pet}
          pets={data.pets}
          users={data.users}
          onSave={(record) => save("pets", record)}
        />
      )}
      {mode === "detail" && pet && (
        <PetDetail pet={pet} onRequestDelete={() => requestDelete(pet)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={"Delete " + (deleting?.name ?? "pet") + "?"}
        description={
          deleting ? deleting.name + " will be removed from this session." : ""
        }
        onConfirm={() => {
          if (deleting) {
            remove("pets", deleting.id);
            toast.success("Pet deleted");
          }
        }}
      />
    </>
  );
}
