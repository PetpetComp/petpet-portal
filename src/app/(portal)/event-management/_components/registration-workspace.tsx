"use client";
import { RecordWorkspace } from "@/components/common/record-workspace";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { Collection, FieldDefinition, ViewMode } from "@/types/portal";
type RegistrationKind = "registrations" | "committee" | "partners";
const config: Record<
  RegistrationKind,
  { title: string; singular: string; path: string }
> = {
  registrations: {
    title: "Event Registration",
    singular: "Registration",
    path: "event-registration",
  },
  committee: {
    title: "Committee Registration",
    singular: "Committee",
    path: "committee-registration",
  },
  partners: {
    title: "Partner Registration",
    singular: "Partner",
    path: "partner-registration",
  },
};
export function RegistrationWorkspace({
  kind,
  mode,
  id,
}: {
  kind: RegistrationKind;
  mode?: ViewMode;
  id?: string;
}) {
  const { data, save, remove } = usePortalData();
  const options = (collection: Collection) =>
    data[collection].map((item) => ({ value: item.id, label: item.name }));
  const common: FieldDefinition[] = [
    {
      key: "eventId",
      label: "Event",
      type: "select",
      required: true,
      options: options("events"),
    },
  ];
  const fields: FieldDefinition[] =
    kind === "registrations"
      ? [
          ...common,
          {
            key: "userId",
            label: "Owner",
            type: "select",
            required: true,
            options: options("users"),
          },
          {
            key: "petId",
            label: "Pet",
            type: "select",
            required: true,
            options: options("pets"),
          },
          {
            key: "competitionId",
            label: "Competition",
            type: "select",
            required: true,
            options: options("competitions"),
          },
          {
            key: "paymentStatus",
            label: "Payment Status",
            type: "select",
            required: true,
            options: ["Pending", "Paid", "Verified"].map((value) => ({
              value,
              label: value,
            })),
          },
        ]
      : kind === "committee"
        ? [
            ...common,
            {
              key: "userId",
              label: "Committee Member",
              type: "select",
              required: true,
              options: options("users"),
            },
            {
              key: "role",
              label: "Role",
              type: "select",
              required: true,
              options: ["Event PIC", "Race PIC", "Judge"].map((value) => ({
                value,
                label: value,
              })),
            },
          ]
        : [
            ...common,
            {
              key: "sponsorId",
              label: "Brand",
              type: "select",
              required: true,
              options: options("brands"),
            },
            {
              key: "category",
              label: "Category",
              type: "select",
              required: true,
              options: ["Sponsor", "Media Partner"].map((value) => ({
                value,
                label: value,
              })),
            },
          ];
  const settings = config[kind];
  return (
    <RecordWorkspace
      key={kind + mode + (id ?? "")}
      title={settings.title}
      singular={settings.singular}
      basePath={"/event-management/" + settings.path}
      records={data[kind]}
      fields={fields}
      columns={fields.map((field) => field.key)}
      mode={mode}
      id={id}
      filterKey="eventId"
      defaults={{ eventId: data.events[0]?.id ?? "", paymentStatus: "Pending" }}
      onSave={(record) =>
        save(kind, {
          ...record,
          name:
            data.users.find((user) => user.id === record.userId)?.name ??
            data.brands.find((brand) => brand.id === record.sponsorId)?.name ??
            settings.singular,
        })
      }
      onRemove={(id) => remove(kind, id)}
      validate={(record) => {
        if (kind !== "registrations") return undefined;
        if (
          data.competitions.find((item) => item.id === record.competitionId)
            ?.eventId !== record.eventId
        )
          return "The selected competition belongs to a different event.";
        if (
          data.pets.find((item) => item.id === record.petId)?.ownerUserId !==
          record.userId
        )
          return "The selected pet does not belong to this owner.";
        if (
          data.registrations.some(
            (item) =>
              item.id !== record.id &&
              item.petId === record.petId &&
              item.competitionId === record.competitionId,
          )
        )
          return "This pet is already registered for this competition.";
        return undefined;
      }}
    />
  );
}
