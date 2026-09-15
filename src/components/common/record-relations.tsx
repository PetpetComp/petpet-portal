"use client";
import { useEffect, useState } from "react";
import { USER_SERVICES } from "@/services/user-management";
import { SPONSOR_SERVICES } from "@/services/sponsorship-brand";
import { ORGANIZATION_SERVICES } from "@/services/organization";
import { collectRows } from "@/services/common";
import { type Row } from "@/services/backend-records";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { Field, Select } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { PortalRecord } from "@/types/portal";

export function RecordRelations({
  kind,
  record,
}: {
  kind: "roles" | "pics";
  record: PortalRecord;
}) {
  const { data, refresh } = usePortalData();
  const [roles, setRoles] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (kind !== "roles") return;
    let active = true;
    collectRows(USER_SERVICES.getRole)
      .then((rows) => {
        if (active) setRoles(rows);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Unable to load roles.",
          );
      });
    return () => {
      active = false;
    };
  }, [kind]);
  async function update(remove: boolean) {
    if (!selected || pending) return;
    if (
      remove &&
      !window.confirm(
        "Remove this " + (kind === "roles" ? "role" : "PIC") + "?",
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      if (kind === "roles") {
        if (remove) await USER_SERVICES.revokeRole(record.id, selected);
        else await USER_SERVICES.assignRole(record.id, selected);
      } else {
        if (remove) await SPONSOR_SERVICES.removePic(record.id, selected);
        else await SPONSOR_SERVICES.addPic(record.id, selected);
      }
      toast.success(remove ? "Assignment removed" : "Assignment added");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update assignment.",
      );
      setPending(false);
    }
  }
  const options =
    kind === "roles"
      ? roles.map((role) => ({
          value: String(role.code),
          label: String(role.name),
        }))
      : data.users.map((user) => ({ value: user.id, label: user.name }));
  return (
    <section className="form-section page-stack">
      <h2>{kind === "roles" ? "User roles" : "Brand PICs"}</h2>
      {kind === "roles" && <p>Assigned roles: {record.roles || "None"}</p>}
      <Field label={kind === "roles" ? "Role" : "User"}>
        <Select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={pending}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button
          disabled={!selected || pending}
          onClick={() => void update(false)}
        >
          Assign {kind === "roles" ? "role" : "PIC"}
        </Button>
        <Button
          variant="secondary"
          disabled={!selected || pending}
          onClick={() => void update(true)}
        >
          Remove {kind === "roles" ? "role" : "PIC"}
        </Button>
      </div>
    </section>
  );
}
export function OrganizationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const [organizations, setOrganizations] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    collectRows(ORGANIZATION_SERVICES.list)
      .then((rows) => {
        if (active) setOrganizations(rows);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load organizations.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <Select
        aria-label="Existing organization"
        value={value}
        onChange={onChange}
      >
        <option value="">Select organization or create below</option>
        {organizations.map((row) => (
          <option value={String(row.uuid)} key={String(row.uuid)}>
            {String(row.name)}
          </option>
        ))}
      </Select>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
