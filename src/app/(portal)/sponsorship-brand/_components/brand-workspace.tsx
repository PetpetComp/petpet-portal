"use client";
import { RecordWorkspace } from "@/components/common/record-workspace";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { FieldDefinition, ViewMode } from "@/types/portal";
export function BrandWorkspace({ mode, id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const fields: FieldDefinition[] = [
    { key: "logo", label: "Brand Logo", type: "image" },
    { key: "name", label: "Brand Name", required: true },
    { key: "phone", label: "Phone", type: "tel", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "campaign", label: "Brand Campaign" },
    {
      key: "picUserId",
      label: "Person in Charge",
      type: "select",
      options: data.users.map((user) => ({ value: user.id, label: user.name })),
    },
    ...["instagram", "tiktok", "facebook", "youtube", "threads", "x"].map(
      (platform) => ({
        key: platform + "Id",
        label: platform.charAt(0).toUpperCase() + platform.slice(1),
      }),
    ),
  ];
  return (
    <RecordWorkspace
      key={mode + (id ?? "")}
      title="Brand Management"
      singular="Brand"
      basePath="/sponsorship-brand"
      records={data.brands}
      fields={fields}
      columns={["name", "phone", "campaign", "picUserId"]}
      mode={mode}
      id={id}
      onSave={(record) => save("brands", record)}
      onRemove={(id) => remove("brands", id)}
      canRemove={(record) =>
        data.partners.some((row) => row.sponsorId === record.id)
          ? "Remove this brand's event partnership before deleting."
          : undefined
      }
    />
  );
}
