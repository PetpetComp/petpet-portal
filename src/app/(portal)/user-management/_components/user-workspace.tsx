"use client";
import { RecordWorkspace } from "@/components/common/record-workspace";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { DataTable } from "@/components/common/data-table";
import type { FieldDefinition, ViewMode } from "@/types/portal";
const fields: FieldDefinition[] = [
  { key: "name", label: "Full Name", required: true },
  { key: "username", label: "Username", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "tel", required: true },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    options: [
      { value: "Male", label: "Male" },
      { value: "Female", label: "Female" },
    ],
  },
  { key: "dob", label: "Date of Birth", type: "date" },
  { key: "address", label: "Address", type: "textarea" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "nation", label: "Country" },
];
export function UserWorkspace({ mode, id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  return (
    <RecordWorkspace
      key={mode + (id ?? "")}
      title="User Management"
      singular="User"
      basePath="/user-management"
      records={data.users}
      fields={fields}
      columns={["name", "email", "phone", "city"]}
      mode={mode}
      id={id}
      onSave={(record) => save("users", record)}
      onRemove={(id) => remove("users", id)}
      validate={(record) =>
        data.users.some(
          (item) =>
            item.id !== record.id &&
            (item.email.toLowerCase() === record.email.toLowerCase() ||
              item.phone === record.phone),
        )
          ? "Email or phone is already registered."
          : undefined
      }
      canRemove={(record) =>
        data.pets.some((pet) => pet.ownerUserId === record.id) ||
        [...data.registrations, ...data.committee].some(
          (row) => row.userId === record.id,
        ) ||
        data.brands.some((row) => row.picUserId === record.id) ||
        data.prizes.some((row) =>
          row.winnerUserIds?.split(",").includes(record.id),
        )
          ? "This user still has linked records. Reassign them before deleting."
          : undefined
      }
    >
      <section className="form-section">
        <h2>Owned Pets</h2>
        <DataTable
          rows={data.pets.filter((pet) => pet.ownerUserId === id)}
          columns={[
            { key: "name", label: "Pet", value: (row) => row.name },
            { key: "animal", label: "Animal", value: (row) => row.animal },
            { key: "variant", label: "Breed", value: (row) => row.variant },
          ]}
        />
      </section>
    </RecordWorkspace>
  );
}
