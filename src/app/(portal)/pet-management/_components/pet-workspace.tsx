"use client";
import { RecordWorkspace } from "@/components/common/record-workspace";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { FieldDefinition, ViewMode } from "@/types/portal";
export function PetWorkspace({ mode, id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const fields: FieldDefinition[] = [
    { key: "photo", label: "Pet Photo", type: "image" },
    { key: "name", label: "Pet Name", required: true },
    {
      key: "ownerUserId",
      label: "Owner",
      type: "select",
      required: true,
      options: data.users.map((user) => ({ value: user.id, label: user.name })),
    },
    {
      key: "animal",
      label: "Animal",
      type: "select",
      required: true,
      options: ["Dog", "Cat", "Rabbit", "Hamster"].map((value) => ({
        value,
        label: value,
      })),
    },
    { key: "variant", label: "Breed", required: true },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      options: ["Male", "Female"].map((value) => ({ value, label: value })),
    },
    { key: "dob", label: "Date of Birth", type: "date" },
    { key: "heightLength", label: "Height / Length" },
    { key: "weight", label: "Weight" },
  ];
  return (
    <RecordWorkspace
      key={mode + (id ?? "")}
      title="Pet Management"
      singular="Pet"
      basePath="/pet-management"
      records={data.pets}
      fields={fields}
      columns={["name", "animal", "variant", "ownerUserId", "gender"]}
      mode={mode}
      id={id}
      filterKey="animal"
      onSave={(record) =>
        save("pets", {
          ...record,
          ownerName:
            data.users.find((user) => user.id === record.ownerUserId)?.name ??
            "",
        })
      }
      onRemove={(id) => remove("pets", id)}
      validate={(record) =>
        data.pets.some(
          (pet) =>
            pet.id !== record.id &&
            pet.name.toLowerCase() === record.name.toLowerCase() &&
            pet.ownerUserId === record.ownerUserId,
        )
          ? "This owner already has a pet with this name."
          : undefined
      }
      canRemove={(record) =>
        data.registrations.some((row) => row.petId === record.id)
          ? "This pet has an event registration and cannot be deleted."
          : undefined
      }
    />
  );
}
