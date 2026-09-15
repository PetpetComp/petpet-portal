"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Eye, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PageHeading } from "./page-heading";
import { DataTable } from "./data-table";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { EVENT_SERVICES } from "@/services/event-management";
import { COMPETITION_SERVICES } from "@/services/competition";
import { ENTRY_SERVICES } from "@/services/event-operations";
import { ORGANIZATION_SERVICES } from "@/services/organization";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";
import { formatDate } from "@/lib/format/date";
import { RecordRelations, OrganizationSelect } from "./record-relations";
import { CompetitionSettings } from "./competition-settings";
import type {
  Collection,
  FieldDefinition,
  PortalRecord,
  ViewMode,
} from "@/types/portal";

type Supported = Exclude<Collection, "prizes">;
const config: Record<
  Supported,
  { title: string; singular: string; path: string; columns: string[] }
> = {
  committee: {
    title: "Committee Registration",
    singular: "Staff invitation",
    path: "/event-management/committee-registration",
    columns: ["name", "eventId", "role", "kind", "status"],
  },
  users: {
    title: "User Management",
    singular: "User",
    path: "/user-management",
    columns: ["name", "username", "email", "phone", "status"],
  },
  pets: {
    title: "Pet Management",
    singular: "Pet",
    path: "/pet-management",
    columns: ["name", "registrationNumber", "gender", "dob", "welfareStatus"],
  },
  brands: {
    title: "Sponsorship Brands",
    singular: "Brand",
    path: "/sponsorship-brand",
    columns: ["name", "phone", "email", "websiteUrl", "status"],
  },
  events: {
    title: "Event Management",
    singular: "Event",
    path: "/event-management",
    columns: [
      "name",
      "organizer",
      "location",
      "address",
      "startDate",
      "endDate",
      "status",
    ],
  },
  competitions: {
    title: "Competitions",
    singular: "Competition",
    path: "",
    columns: [
      "name",
      "location",
      "startDate",
      "endDate",
      "capacity",
      "earlyBirdPrice",
      "earlyBirdWindow",
      "onlinePrice",
      "onlineWindow",
      "onSitePrice",
      "onSiteWindow",
      "status",
    ],
  },
  registrations: {
    title: "Event Registration",
    singular: "Entry",
    path: "/event-management/event-registration",
    columns: [
      "name",
      "competitionId",
      "petId",
      "paymentStatus",
      "checkinStatus",
      "status",
    ],
  },
  partners: {
    title: "Partner Registration",
    singular: "Sponsorship",
    path: "/event-management/partner-registration",
    columns: ["brandId", "eventId", "category", "campaign", "status"],
  },
};
const f = (
  key: string,
  label: string,
  type: FieldDefinition["type"] = "text",
  required = false,
): FieldDefinition => ({ key, label, type, required });
const choice = (
  key: string,
  label: string,
  options: string[],
): FieldDefinition => ({
  key,
  label,
  type: "select",
  options: options.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  })),
});
export function recordFields(
  collection: Supported,
  editing: boolean,
  data: ReturnType<typeof usePortalData>["data"],
): FieldDefinition[] {
  const relation = (
    key: string,
    label: string,
    records: PortalRecord[],
    required = false,
  ): FieldDefinition => ({
    key,
    label,
    type: "select",
    required,
    options: records.map((row) => ({ value: row.id, label: row.name })),
  });
  switch (collection) {
    case "committee":
      return [
        relation("eventId", "Event", data.events, true),
        relation("competitionId", "Competition (optional)", data.competitions),
        f("email", "Invite email", "email", true),
        {
          ...choice("role", "Assignment role", [
            "EVENT_MANAGER",
            "COMPETITION_PIC",
            "TIMER_OPERATOR",
            "MARSHAL",
            "JUDGE",
            "HEAD_JUDGE",
          ]),
          required: true,
        },
      ];
    case "users":
      return [
        ...(!editing
          ? [
              f("username", "Username", "text", true),
              f("email", "Email", "email", true),
            ]
          : []),
        f("firstName", "First name", "text", true),
        f("lastName", "Last name"),
        f("phone", "Phone", "tel"),
        choice("status", "Status", ["Active", "Inactive", "Suspended"]),
        ...(editing
          ? [
              f("dob", "Date of birth", "date"),
              choice("gender", "Gender", ["Male", "Female"]),
              f("address", "Address", "textarea"),
              f("city", "City"),
              f("province", "Province"),
              f("nation", "Country"),
            ]
          : []),
      ];
    case "pets":
      return [
        f("name", "Pet name", "text", true),
        ...(!editing
          ? [
              f("speciesId", "Species ID (UUID)", "text", true),
              f("morphId", "Morph ID (UUID)"),
            ]
          : []),
        f("registrationNumber", "Registration number"),
        choice("gender", "Gender", ["Male", "Female"]),
        f("dob", "Date of birth", "date"),
        f("heightLength", "Height / length (cm)", "number"),
        f("weight", "Weight (grams)", "number"),
      ];
    case "brands":
      return [
        f("name", "Brand name", "text", true),
        f("phone", "Phone", "tel"),
        f("email", "Email", "email"),
        f("websiteUrl", "Website URL"),
      ];
    case "events":
      return [
        ...(!editing
          ? [
              f("organizationId", "Existing organization ID (UUID)"),
              f("newOrganizationName", "Or create organization named"),
            ]
          : []),
        f("name", "Event name", "text", true),
        f("tagline", "Tagline"),
        f("description", "Description", "textarea"),
        f("location", "Venue"),
        f("address", "Venue address", "textarea"),
        f("mapLocation", "Map location"),
        f("timezone", "Event timezone"),
        f("startDate", "Start (your local time)", "datetime-local", true),
        f("endDate", "End (your local time)", "datetime-local", true),
      ];
    case "competitions":
      return [
        f("name", "Competition name", "text", true),
        ...(!editing
          ? [
              f(
                "competitionTypeId",
                "Competition type ID (UUID)",
                "text",
                true,
              ),
              f("speciesId", "Species ID (UUID)"),
            ]
          : []),
        f("description", "Description", "textarea"),
        f("location", "Arena"),
        f("capacity", "Capacity", "number"),
        f("minimumJudges", "Minimum judges", "number"),
        f("startDate", "Start (your local time)", "datetime-local", true),
        f("endDate", "End (your local time)", "datetime-local", true),
      ];
    case "registrations":
      return [
        relation("competitionId", "Competition", data.competitions, true),
        relation("petId", "Pet", data.pets),
        f("teamId", "Or team ID (UUID)"),
        f("registrationPeriodId", "Registration period ID (UUID)"),
      ];
    case "partners":
      return [
        relation("eventId", "Event", data.events, true),
        relation("brandId", "Sponsor", data.brands, true),
        {
          ...choice("category", "Sponsorship level", [
            "PLATINUM",
            "GOLD",
            "SILVER",
            "BRONZE",
            "MEDIA_PARTNER",
          ]),
          required: true,
        },
        f("campaign", "Campaign text"),
        f("displayOrder", "Display order", "number"),
        f("startDate", "Start (your local time)", "datetime-local"),
        f("endDate", "End (your local time)", "datetime-local"),
      ];
  }
}
function localDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function RecordForm({
  collection,
  record,
  eventId,
  fields,
  onSaved,
}: {
  collection: Supported;
  record?: PortalRecord;
  eventId?: string;
  fields: FieldDefinition[];
  onSaved: () => void;
}) {
  const { save } = usePortalData();
  const [draft, setDraft] = useState<PortalRecord>(() => {
    const next = {
      id: "",
      name: "",
      status: "Active",
      timezone: "Asia/Jakarta",
      ...record,
      ...(eventId ? { eventId } : {}),
    };
    const result: PortalRecord = { ...next };
    fields
      .filter((field) => field.type === "datetime-local")
      .forEach((field) => {
        result[field.key] = localDate(result[field.key]);
      });
    return result;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const field of fields) {
        if (
          field.label.includes("(UUID)") &&
          draft[field.key] &&
          !uuid.test(draft[field.key].trim())
        )
          throw new Error(field.label + " must be a valid UUID.");
      }
      if (
        draft.startDate &&
        draft.endDate &&
        new Date(draft.endDate) <= new Date(draft.startDate)
      )
        throw new Error("End must be after start.");
      if (
        collection === "registrations" &&
        Boolean(draft.petId) === Boolean(draft.teamId)
      )
        throw new Error("Select either a pet or a team.");
      await save(collection, draft);
      toast.success(config[collection].singular + " saved");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="page-stack" onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="form-section">
        <legend className="sr-only">
          {config[collection].singular} information
        </legend>
        <div className="form-grid">
          {fields.map((field) => {
            const id = "api-field-" + field.key;
            const props = {
              id,
              required: field.required,
              value: draft[field.key] ?? "",
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                >,
              ) =>
                setDraft((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                })),
            };
            return (
              <Field
                key={field.key}
                label={field.label + (field.required ? " *" : "")}
              >
                {field.key === "organizationId" ? (
                  <OrganizationSelect
                    value={props.value}
                    onChange={props.onChange}
                  />
                ) : field.type === "select" ? (
                  <Select {...props} aria-label={field.label}>
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea {...props} aria-label={field.label} />
                ) : (
                  <Input
                    {...props}
                    aria-label={field.label}
                    type={field.type ?? "text"}
                    min={field.type === "number" ? 0 : undefined}
                    step={field.type === "number" ? "any" : undefined}
                  />
                )}
              </Field>
            );
          })}
        </div>
      </fieldset>
      {!record && ["pets", "competitions"].includes(collection) && (
        <p className="muted">
          Use the species / competition type ID supplied by your administrator.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onSaved} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Save size={16} />
          {pending ? "Saving..." : "Save " + config[collection].singular}
        </Button>
      </div>
    </form>
  );
}
export function ApiAction({
  action,
  label,
  confirm = false,
}: {
  action: () => Promise<unknown>;
  label: string;
  confirm?: boolean;
}) {
  const { refresh } = usePortalData();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        disabled={pending}
        variant="secondary"
        onClick={async () => {
          if (confirm && !window.confirm(label + "?")) return;
          setPending(true);
          setError("");
          try {
            await action();
            toast.success(label + " completed");
            await refresh();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Action failed.");
            setPending(false);
          }
        }}
      >
        {pending ? "Processing..." : label}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function ApiWorkspace({
  collection,
  mode = "list",
  id,
  eventId,
}: {
  collection: Supported;
  mode?: ViewMode;
  id?: string;
  eventId?: string;
}) {
  const { data, errors, remove, refresh } = usePortalData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [inlineMode, setInlineMode] = useState<ViewMode>(mode);
  const [selectedId, setSelectedId] = useState(id);
  const [pendingDelete, setPendingDelete] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [organizations, setOrganizations] = useState<Row[]>([]);
  useEffect(() => {
    if (collection !== "events") return;
    let active = true;
    collectRows(ORGANIZATION_SERVICES.list).then((rows) => {
      if (active) setOrganizations(rows);
    });
    return () => {
      active = false;
    };
  }, [collection]);
  const inline = ["registrations", "partners"].includes(collection);
  const currentMode = inline ? inlineMode : mode;
  const currentId = inline ? selectedId : id;
  const info = config[collection];
  const path =
    collection === "competitions"
      ? "/event-management/" + eventId + "/competitions"
      : info.path;
  const records = data[collection].filter(
    (row) => !eventId || row.eventId === eventId,
  );
  const [periodsByCompetition, setPeriodsByCompetition] = useState<
    Record<string, Row[]>
  >({});
  const competitionIds =
    collection === "competitions" && mode === "list"
      ? records.map((row) => row.id).join(",")
      : "";
  useEffect(() => {
    if (!competitionIds) return;
    let active = true;
    Promise.all(
      competitionIds.split(",").map((competitionId) =>
        collectRows((params) =>
          COMPETITION_SERVICES.periods(competitionId, params),
        ).then((rows) => [competitionId, rows] as const),
      ),
    ).then((entries) => {
      if (active) setPeriodsByCompetition(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [competitionIds]);
  const record = records.find((row) => row.id === currentId);
  const fields =
    currentMode === "detail"
      ? Array.from(
          new Map(
            [
              ...recordFields(collection, false, data),
              ...recordFields(collection, true, data),
            ].map((field) => [field.key, field]),
          ).values(),
        ).filter((field) => field.key !== "newOrganizationName")
      : recordFields(collection, currentMode === "edit", data);
  const canEdit = !["partners", "registrations", "committee"].includes(
    collection,
  );
  const canDelete = [
    "users",
    "events",
    "pets",
    "registrations",
    "partners",
    "committee",
  ].includes(collection);
  const goBack = () => {
    if (inline) {
      setInlineMode("list");
      setSelectedId(undefined);
    } else router.push(path);
  };
  const label = (key: string) =>
    fields.find((field) => field.key === key)?.label ??
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase());
  const periodTypeByKey: Record<string, string> = {
    earlyBird: "EARLY_BIRD",
    online: "ONLINE",
    onSite: "ON_SITE",
  };
  const display = (row: PortalRecord, key: string) => {
    const priceMatch = key.match(/^(earlyBird|online|onSite)(Price|Window)$/);
    if (priceMatch) {
      const period = periodsByCompetition[row.id]?.find(
        (item) => item.period_type === periodTypeByKey[priceMatch[1]],
      );
      if (!period) return "-";
      if (priceMatch[2] === "Price") return "Rp " + String(period.price ?? "-");
      const start = period.registration_start_at
        ? formatDate(String(period.registration_start_at))
        : "-";
      const end = period.registration_end_at
        ? formatDate(String(period.registration_end_at))
        : "-";
      return start + " - " + end;
    }
    if (key === "organizer") {
      const org = organizations.find(
        (item) => item.uuid === row.organizationId,
      );
      return org ? String(org.name) : "-";
    }
    const relation =
      key === "eventId"
        ? data.events
        : key === "competitionId"
          ? data.competitions
          : key === "brandId"
            ? data.brands
            : key === "petId"
              ? data.pets
              : null;
    return (
      relation?.find((item) => item.id === row[key])?.name ?? row[key] ?? "-"
    );
  };
  if (errors[collection])
    return (
      <section className="page-stack">
        <PageHeading title={info.title} />
        <p role="alert" className="form-error">
          {errors[collection]}
        </p>
        <Button onClick={() => void refresh()}>Retry loading</Button>
      </section>
    );
  if (eventId && !data.events.some((event) => event.id === eventId))
    return <p role="alert">Event not found.</p>;
  if (["detail", "edit"].includes(currentMode) && !record)
    return (
      <section className="page-stack">
        <PageHeading title={info.singular + " not found"} />
        <Button onClick={goBack}>Back to {info.title}</Button>
      </section>
    );
  if (currentMode === "edit" && !canEdit)
    return (
      <section className="page-stack">
        <p>Use the actions on this record to update its status.</p>
        <Button onClick={goBack}>Back</Button>
      </section>
    );
  if (
    currentMode === "edit" &&
    collection === "events" &&
    record?.status === "Closed"
  )
    return (
      <section className="page-stack">
        <p>Closed events cannot be edited.</p>
        <Button onClick={goBack}>Back</Button>
      </section>
    );
  const actions: ReactNode =
    currentMode === "list" ? (
      inline ? (
        <Button onClick={() => setInlineMode("create")}>
          <Plus size={16} />
          Add {info.singular}
        </Button>
      ) : (
        <Link className="link-button" href={path + "/create"}>
          <Plus size={16} />
          Add {info.singular}
        </Link>
      )
    ) : currentMode === "detail" && canEdit ? (
      collection === "events" && record?.status === "Closed" ? (
        <span
          className="row-action-disabled"
          title="Closed events cannot be edited."
          aria-disabled="true"
        >
          <Pencil size={16} />
          Edit {info.singular}
        </span>
      ) : (
        <Link
          className="link-button secondary"
          href={path + "/" + currentId + "/edit"}
        >
          <Pencil size={16} />
          Edit {info.singular}
        </Link>
      )
    ) : null;
  return (
    <div className="page-stack">
      {currentMode !== "list" && (
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft size={16} />
          Back to {info.title}
        </Button>
      )}
      {eventId && (
        <Link className="back-link" href={"/event-management/" + eventId}>
          Back to event
        </Link>
      )}
      <PageHeading
        title={
          currentMode === "list"
            ? info.title
            : currentMode === "detail"
              ? record!.name
              : (currentMode === "edit" ? "Edit " : "Add ") + info.singular
        }
        actions={actions}
      />
      {currentMode === "list" && (
        <section className="form-section">
          <div className="toolbar">
            <Input
              aria-label={"Search " + info.title}
              placeholder="Search records..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <DataTable
            rows={records.filter((row) =>
              Object.values(row)
                .join(" ")
                .toLowerCase()
                .includes(query.toLowerCase()),
            )}
            label={info.title}
            columns={info.columns.map((key) => ({
              key,
              label: label(key),
              value: (row: PortalRecord) => display(row, key),
            }))}
            actions={(row) => {
              const closed = collection === "events" && row.status === "Closed";
              return (
                <>
                  {inline ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={"View " + row.name}
                      onClick={() => {
                        setSelectedId(row.id);
                        setInlineMode("detail");
                      }}
                    >
                      <Eye size={16} />
                    </Button>
                  ) : (
                    <Link
                      aria-label={"View " + row.name}
                      href={path + "/" + row.id}
                    >
                      <Eye size={16} />
                    </Link>
                  )}
                  {canEdit &&
                    (closed ? (
                      <span
                        className="row-action-disabled"
                        title="Closed events cannot be edited."
                        aria-disabled="true"
                      >
                        <Pencil size={16} />
                      </span>
                    ) : (
                      <Link
                        aria-label={"Edit " + row.name}
                        href={path + "/" + row.id + "/edit"}
                      >
                        <Pencil size={16} />
                      </Link>
                    ))}
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!!pendingDelete || closed}
                      title={
                        closed
                          ? "Closed events cannot be removed."
                          : "Delete " + row.name
                      }
                      aria-label={"Delete " + row.name}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Delete " +
                              row.name +
                              "? This removes the record from the server.",
                          )
                        )
                          return;
                        setPendingDelete(row.id);
                        setDeleteError("");
                        try {
                          await remove(collection, row.id);
                          toast.success(info.singular + " deleted");
                        } catch (cause) {
                          setDeleteError(
                            cause instanceof Error
                              ? cause.message
                              : "Unable to delete.",
                          );
                        } finally {
                          setPendingDelete("");
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </>
              );
            }}
          />
          {deleteError && (
            <p role="alert" className="form-error">
              {deleteError}
            </p>
          )}
        </section>
      )}
      {["create", "edit"].includes(currentMode) && (
        <RecordForm
          key={currentId ?? "new"}
          collection={collection}
          record={record}
          fields={fields}
          eventId={eventId}
          onSaved={goBack}
        />
      )}
      {currentMode === "detail" && record && (
        <>
          <dl className="detail-grid">
            {Array.from(
              new Set(["id", ...fields.map((field) => field.key), "status"]),
            ).map((key) => (
              <div key={key}>
                <dt>{label(key)}</dt>
                <dd>{display(record, key) || "-"}</dd>
              </div>
            ))}
          </dl>
          {collection === "users" && (
            <RecordRelations kind="roles" record={record} />
          )}
          {collection === "brands" && (
            <RecordRelations kind="pics" record={record} />
          )}
          {collection === "events" && (
            <div className="form-actions">
              <Link
                className="link-button"
                href={path + "/" + record.id + "/competitions"}
              >
                Manage competitions
              </Link>
              <ApiAction
                action={() => EVENT_SERVICES.publish(record.id)}
                label="Publish event"
                confirm
              />
            </div>
          )}
          {collection === "competitions" && (
            <>
              <ApiAction
                action={() => COMPETITION_SERVICES.closeRegistration(record.id)}
                label="Close registration"
                confirm
              />
              <CompetitionSettings competitionId={record.id} />
              <section className="form-section page-stack">
                <h2>Competition committee</h2>
                <DataTable
                  label="Competition committee"
                  rows={data.committee.filter(
                    (row) => row.competitionId === record.id,
                  )}
                  columns={[
                    { key: "name", label: "Name", value: (row) => row.name },
                    { key: "email", label: "Email", value: (row) => row.email },
                    { key: "role", label: "Role", value: (row) => row.role },
                    {
                      key: "status",
                      label: "Status",
                      value: (row) => row.status,
                    },
                  ]}
                  actions={(row) => (
                    <Link
                      aria-label={"View " + row.name}
                      href={config.committee.path + "/" + row.id}
                    >
                      <Eye size={16} />
                    </Link>
                  )}
                />
              </section>
              <section className="form-section page-stack">
                <h2>Competition participants</h2>
                <DataTable
                  label="Competition participants"
                  rows={data.registrations.filter(
                    (row) => row.competitionId === record.id,
                  )}
                  columns={[
                    { key: "name", label: "Entry", value: (row) => row.name },
                    {
                      key: "petId",
                      label: "Pet",
                      value: (row) =>
                        data.pets.find((pet) => pet.id === row.petId)?.name ??
                        "-",
                    },
                    {
                      key: "paymentStatus",
                      label: "Payment",
                      value: (row) => row.paymentStatus,
                    },
                    {
                      key: "checkinStatus",
                      label: "Check-in",
                      value: (row) => row.checkinStatus,
                    },
                    {
                      key: "status",
                      label: "Status",
                      value: (row) => row.status,
                    },
                  ]}
                  actions={(row) => (
                    <Link
                      aria-label={"View " + row.name}
                      href={config.registrations.path + "/" + row.id}
                    >
                      <Eye size={16} />
                    </Link>
                  )}
                />
              </section>
            </>
          )}
          {collection === "registrations" && (
            <div className="form-actions">
              {(["approve", "reject", "checkin"] as const).map((action) => (
                <ApiAction
                  key={action}
                  action={() => ENTRY_SERVICES[action](record.id)}
                  label={
                    action === "checkin"
                      ? "Check in"
                      : action === "approve"
                        ? "Approve entry"
                        : "Reject entry"
                  }
                  confirm
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
