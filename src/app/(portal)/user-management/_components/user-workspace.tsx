"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord, ViewMode } from "@/types/portal";
import { UserList } from "./user-list";
import { UserForm } from "./user-form";
import { UserDetail } from "./user-detail";
import { hasLinkedRecords } from "../_lib/user-rules";

export function UserWorkspace({ mode = "list", id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const [deleting, setDeleting] = useState<PortalRecord | null>(null);
  const user = id ? data.users.find((item) => item.id === id) : undefined;

  function requestDelete(record: PortalRecord) {
    if (hasLinkedRecords(data, record.id)) {
      toast.error("This user still has linked records. Reassign them before deleting.");
      return;
    }
    setDeleting(record);
  }

  if ((mode === "detail" || mode === "edit") && !user) {
    return (
      <div className="page-stack">
        <PageHeading title="User not found" />
        <Link className="back-link" href="/user-management">
          <ArrowLeft size={16} />
          Back to User Management
        </Link>
      </div>
    );
  }

  return (
    <>
      {mode === "list" && (
        <UserList users={data.users} onRequestDelete={requestDelete} />
      )}
      {mode === "create" && (
        <UserForm mode="create" users={data.users} onSave={(record) => save("users", record)} />
      )}
      {mode === "edit" && user && (
        <UserForm
          mode="edit"
          user={user}
          users={data.users}
          onSave={(record) => save("users", record)}
        />
      )}
      {mode === "detail" && user && (
        <UserDetail
          user={user}
          pets={data.pets.filter((pet) => pet.ownerUserId === user.id)}
          onRequestDelete={() => requestDelete(user)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={"Delete " + (deleting?.name ?? "user") + "?"}
        description={
          deleting ? deleting.name + " will be removed from this session." : ""
        }
        onConfirm={() => {
          if (deleting) {
            remove("users", deleting.id);
            toast.success("User deleted");
          }
        }}
      />
    </>
  );
}
