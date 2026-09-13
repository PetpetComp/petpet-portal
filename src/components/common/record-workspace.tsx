"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageInput } from "@/components/ui/image-input";
import { PageHeading } from "./page-heading";
import { DataTable, type Column } from "./data-table";
import { StatusBadge } from "./status-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { exportCsv } from "@/lib/export-csv";
import type { FieldDefinition, PortalRecord, ViewMode } from "@/types/portal";

interface RecordWorkspaceProps {
  title: string;
  singular: string;
  basePath: string;
  records: PortalRecord[];
  fields: FieldDefinition[];
  columns: string[];
  mode?: ViewMode;
  id?: string;
  onSave: (record: PortalRecord) => void;
  onRemove: (id: string) => void;
  validate?: (record: PortalRecord) => string | undefined;
  defaults?: Partial<PortalRecord>;
  children?: ReactNode;
  filterKey?: string;
  canRemove?: (record: PortalRecord) => string | undefined;
}
export function RecordWorkspace(props: RecordWorkspaceProps) {
  const {
    title,
    singular,
    basePath,
    records,
    fields,
    columns,
    mode = "list",
    id,
    onSave,
    onRemove,
    children,
    filterKey = "status",
  } = props;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<PortalRecord | null>(null);
  const record = records.find((item) => item.id === id);
  const [draft, setDraft] = useState<PortalRecord>(() =>
    record ? { ...record } : { id: "", name: "", ...props.defaults },
  );
  const [error, setError] = useState("");
  const filtered = records.filter(
    (item) =>
      Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || item[filterKey] === filter),
  );
  const fieldLabel = (key: string) =>
    fields.find((field) => field.key === key)?.label ??
    (key === "id" ? "ID" : key === "name" ? "Name" : key);
  const displayValue = (item: PortalRecord, key: string) =>
    fields
      .find((field) => field.key === key)
      ?.options?.find((option) => option.value === item[key])?.label ??
    item[key] ??
    "-";
  function requestDelete(item: PortalRecord) {
    const reason = props.canRemove?.(item);
    if (reason) {
      toast.error(reason);
      return;
    }
    setDeleting(item);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = { ...draft, id: draft.id || crypto.randomUUID() };
    const message = props.validate?.(next);
    if (message) {
      setError(message);
      return;
    }
    onSave(next);
    toast.success(singular + " saved");
    router.push(basePath);
  }
  if (mode !== "list" && mode !== "create" && !record)
    return (
      <div className="page-stack">
        <PageHeading title={singular + " not found"} />
        <Link className="back-link" href={basePath}>
          <ArrowLeft size={16} />
          Back to {title}
        </Link>
      </div>
    );
  const tableColumns: Column<PortalRecord>[] = columns.map((key) => ({
    key,
    label: fieldLabel(key),
    value: (row) => displayValue(row, key),
    render: (row) =>
      key === "name" ? (
        <div className="record-name">
          {row.photo || row.logo ? (
            <Image
              src={row.photo || row.logo}
              width={38}
              height={38}
              unoptimized
              alt=""
              className="image-preview"
            />
          ) : (
            <span className="record-initials">
              {row.name
                .split(" ")
                .slice(0, 2)
                .map((word) => word[0])
                .join("")}
            </span>
          )}
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ) : ["status", "paymentStatus"].includes(key) ? (
        <StatusBadge status={row[key] || "Pending"} />
      ) : (
        displayValue(row, key)
      ),
  }));
  return (
    <div className="page-stack">
      {mode !== "list" && (
        <Link className="back-link" href={basePath}>
          <ArrowLeft size={16} />
          Back to {title}
        </Link>
      )}
      <PageHeading
        title={
          mode === "list"
            ? title
            : mode === "detail"
              ? record!.name
              : (mode === "edit" ? "Edit " : "Add New ") + singular
        }
        actions={
          mode === "list" ? (
            <Link href={basePath + "/create"} className="link-button">
              <Plus size={16} />
              Add {singular}
            </Link>
          ) : mode === "detail" ? (
            <Link
              className="link-button secondary"
              href={basePath + "/" + id + "/edit"}
            >
              <Pencil size={15} />
              Edit {singular}
            </Link>
          ) : undefined
        }
      />
      {mode === "list" && (
        <section>
          <div className="toolbar">
            <Field label={singular + " search"}>
              <Input
                type="search"
                placeholder={"Search " + title.toLowerCase()}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
            {records.some((item) => item[filterKey]) && (
              <Field label={fieldLabel(filterKey)}>
                <Select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="">
                    All {fieldLabel(filterKey).toLowerCase()}
                  </option>
                  {Array.from(
                    new Set(
                      records.map((item) => item[filterKey]).filter(Boolean),
                    ),
                  ).map((value) => (
                    <option key={value} value={value}>
                      {displayValue(
                        { id: "", name: "", [filterKey]: value },
                        filterKey,
                      )}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="toolbar-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("");
                }}
              >
                <RotateCcw size={14} />
                Clear Filter
              </Button>
              <Button
                variant="secondary"
                disabled={!filtered.length}
                onClick={() => exportCsv(title, filtered)}
              >
                <Download size={14} />
                Export CSV
              </Button>
            </div>
          </div>
          <DataTable
            rows={filtered}
            columns={tableColumns}
            label={title}
            actions={(item) => (
              <>
                <Link
                  href={basePath + "/" + item.id}
                  title={"View " + item.name}
                  aria-label={"View " + item.name}
                >
                  <Eye size={15} />
                </Link>
                <Link
                  href={basePath + "/" + item.id + "/edit"}
                  title={"Edit " + item.name}
                  aria-label={"Edit " + item.name}
                >
                  <Pencil size={14} />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  title={"Delete " + item.name}
                  aria-label={"Delete " + item.name}
                  onClick={() => requestDelete(item)}
                >
                  <Trash2 size={15} />
                </Button>
              </>
            )}
          />
        </section>
      )}
      {(mode === "create" || mode === "edit") && (
        <form onSubmit={submit} className="page-stack">
          <section className="form-section">
            <h2>{singular} Information</h2>
            <div className="form-grid">
              {fields.map((field) => (
                <Field
                  key={field.key}
                  label={field.label + (field.required ? " *" : "")}
                >
                  {field.type === "image" ? (
                    <ImageInput
                      value={draft[field.key] ?? ""}
                      onChange={(value) =>
                        setDraft({ ...draft, [field.key]: value })
                      }
                    />
                  ) : field.type === "select" ? (
                    <Select
                      required={field.required}
                      value={draft[field.key] ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, [field.key]: event.target.value })
                      }
                    >
                      <option value="">
                        Select {field.label.toLowerCase()}
                      </option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      required={field.required}
                      value={draft[field.key] ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, [field.key]: event.target.value })
                      }
                    />
                  ) : (
                    <Input
                      type={field.type ?? "text"}
                      required={field.required}
                      min={field.min}
                      value={draft[field.key] ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, [field.key]: event.target.value })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Link className="link-button secondary" href={basePath}>
              Cancel
            </Link>
            <Button type="submit">
              <Save size={16} />
              Save {singular}
            </Button>
          </div>
        </form>
      )}
      {mode === "detail" && (
        <>
          <dl className="detail-grid">
            {fields.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>
                  {field.type === "image" ? (
                    record![field.key] ? (
                      <Image
                        src={record![field.key]}
                        width={100}
                        height={100}
                        unoptimized
                        alt={record!.name}
                        className="image-preview"
                      />
                    ) : (
                      "-"
                    )
                  ) : (
                    displayValue(record!, field.key)
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {children}
        </>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={"Delete " + singular + "?"}
        description={
          deleting ? deleting.name + " will be removed from this session." : ""
        }
        onConfirm={() => {
          if (deleting) {
            onRemove(deleting.id);
            toast.success(singular + " deleted");
          }
        }}
      />
    </div>
  );
}
