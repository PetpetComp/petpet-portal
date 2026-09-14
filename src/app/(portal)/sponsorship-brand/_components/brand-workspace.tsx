"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord, ViewMode } from "@/types/portal";
import { BrandList } from "./brand-list";
import { BrandForm } from "./brand-form";
import { BrandDetail } from "./brand-detail";

function emptyBrand(): PortalRecord {
  return {
    id: "BRD-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: "",
    phone: "",
    email: "",
    campaign: "",
    logo: "",
    instagramId: "",
    tiktokId: "",
    facebookId: "",
    youtubeId: "",
    threadsId: "",
    xId: "",
    picUserIds: "",
  };
}

export function BrandWorkspace({ mode = "list", id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const [deleting, setDeleting] = useState<PortalRecord | null>(null);
  const [draftBrand] = useState(emptyBrand);
  const brand = id ? data.brands.find((item) => item.id === id) : undefined;
  const assignmentsFor = (brandId: string) =>
    data.partners.filter((row) => row.sponsorId === brandId);

  function requestDelete(record: PortalRecord) {
    setDeleting(record);
  }

  if ((mode === "detail" || mode === "edit") && !brand) {
    return (
      <div className="page-stack">
        <PageHeading title="Brand not found" />
        <Link className="back-link" href="/sponsorship-brand">
          <ArrowLeft size={16} />
          Back to Brands
        </Link>
      </div>
    );
  }

  return (
    <>
      {mode === "list" && (
        <BrandList brands={data.brands} onRequestDelete={requestDelete} />
      )}
      {mode === "create" && (
        <BrandForm
          mode="create"
          brand={draftBrand}
          brands={data.brands}
          users={data.users}
          events={data.events}
          assignments={assignmentsFor(draftBrand.id)}
          onSave={(record) => save("brands", record)}
          onAddUser={(user) => save("users", user)}
          onAddAssignment={(assignment) => save("partners", assignment)}
          onRemoveAssignment={(assignmentId) => remove("partners", assignmentId)}
        />
      )}
      {mode === "edit" && brand && (
        <BrandForm
          mode="edit"
          brand={brand}
          brands={data.brands}
          users={data.users}
          events={data.events}
          assignments={assignmentsFor(brand.id)}
          onSave={(record) => save("brands", record)}
          onAddUser={(user) => save("users", user)}
          onAddAssignment={(assignment) => save("partners", assignment)}
          onRemoveAssignment={(assignmentId) => remove("partners", assignmentId)}
        />
      )}
      {mode === "detail" && brand && (
        <BrandDetail
          brand={brand}
          pics={data.users.filter((user) =>
            brand.picUserIds?.split(",").includes(user.id),
          )}
          events={data.events}
          assignments={assignmentsFor(brand.id)}
          onAddAssignment={(assignment) => save("partners", assignment)}
          onRemoveAssignment={(assignmentId) => remove("partners", assignmentId)}
          onRequestDelete={() => requestDelete(brand)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={"Delete " + (deleting?.name ?? "brand") + "?"}
        description={
          deleting ? deleting.name + " will be removed from this session." : ""
        }
        onConfirm={() => {
          if (deleting) {
            remove("brands", deleting.id);
            toast.success("Brand deleted");
          }
        }}
      />
    </>
  );
}
