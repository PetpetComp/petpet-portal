"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { COMPETITION_SERVICES } from "@/services/competition";
import { collectRows } from "@/services/common";
import { type Row } from "@/services/backend-records";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { toast } from "sonner";

type Kind = "rules" | "registration-periods" | "score-criteria";
type SettingField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  createOnly?: boolean;
};
const schemas: Record<Kind, SettingField[]> = {
  "registration-periods": [
    {
      key: "period_type",
      label: "Period type",
      options: ["EARLY_BIRD", "ONLINE", "ON_SITE"],
      required: true,
      createOnly: true,
    },
    { key: "price", label: "Price", type: "number", required: true },
    { key: "quota", label: "Quota", type: "number" },
    {
      key: "registration_start_at",
      label: "Registration starts (local time)",
      type: "datetime-local",
      required: true,
    },
    {
      key: "registration_end_at",
      label: "Registration ends (local time)",
      type: "datetime-local",
      required: true,
    },
  ],
  "score-criteria": [
    { key: "code", label: "Code", required: true, createOnly: true },
    { key: "name", label: "Name", required: true },
    { key: "description", label: "Description" },
    { key: "weight", label: "Weight", type: "number", required: true },
    {
      key: "min_score",
      label: "Minimum score",
      type: "number",
      required: true,
    },
    {
      key: "max_score",
      label: "Maximum score",
      type: "number",
      required: true,
    },
    {
      key: "note_required",
      label: "Note required",
      options: ["true", "false"],
    },
    { key: "display_order", label: "Display order", type: "number" },
  ],
  rules: [
    {
      key: "ranking_rule",
      label: "Ranking rules (comma separated)",
      required: true,
    },
    { key: "tie_break_rule", label: "Tie-break rules (comma separated)" },
    {
      key: "countdown_enabled",
      label: "Countdown enabled",
      options: ["true", "false"],
    },
    ...[
      "countdown_seconds",
      "concurrent_participant_limit",
      "time_limit_ms",
      "attempt_limit",
      "checkpoint_total",
      "lane_total",
      "qualifier_limit",
    ].map((key) => ({ key, label: key.replaceAll("_", " "), type: "number" })),
    { key: "best_result_method", label: "Best result method" },
    { key: "timeout_result", label: "Timeout result" },
  ],
};
function SettingsSection({
  competitionId,
  kind,
}: {
  competitionId: string;
  kind: Kind;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const fetchRows = useCallback(
    () =>
      collectRows((params) => {
        if (kind === "rules")
          return COMPETITION_SERVICES.rules(competitionId, params);
        if (kind === "registration-periods")
          return COMPETITION_SERVICES.periods(competitionId, params);
        return COMPETITION_SERVICES.criteria(competitionId, params);
      }),
    [competitionId, kind],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchRows());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchRows]);
  useEffect(() => {
    let active = true;
    fetchRows()
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Unable to load settings.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchRows]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const body: Row = {};
      for (const field of schemas[kind]) {
        if (editing && field.createOnly) continue;
        const value = draft[field.key];
        if (!value?.trim()) continue;
        if (field.type === "number") body[field.key] = Number(value);
        else if (field.type === "datetime-local")
          body[field.key] = new Date(value).toISOString();
        else if (["ranking_rule", "tie_break_rule"].includes(field.key))
          body[field.key] = value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        else if (["note_required", "countdown_enabled"].includes(field.key))
          body[field.key] = value === "true";
        else body[field.key] = value;
      }
      if (
        body.registration_start_at &&
        body.registration_end_at &&
        String(body.registration_end_at) <= String(body.registration_start_at)
      )
        throw new Error("Registration end must be after start.");
      if (
        body.min_score !== undefined &&
        body.max_score !== undefined &&
        Number(body.min_score) > Number(body.max_score)
      )
        throw new Error("Maximum score must be at least the minimum score.");
      if (kind === "rules") {
        await COMPETITION_SERVICES.createRule(competitionId, {
          ...body,
          ranking_rule: Array.isArray(body.ranking_rule)
            ? (body.ranking_rule as string[])
            : [],
        });
      } else if (kind === "registration-periods") {
        if (editing) await COMPETITION_SERVICES.updatePeriod(editing, body);
        else
          await COMPETITION_SERVICES.createPeriod(competitionId, {
            ...body,
            period_type: String(body.period_type ?? ""),
            price: Number(body.price),
            registration_start_at: String(body.registration_start_at ?? ""),
            registration_end_at: String(body.registration_end_at ?? ""),
          });
      } else {
        if (editing) await COMPETITION_SERVICES.updateCriterion(editing, body);
        else
          await COMPETITION_SERVICES.createCriterion(competitionId, {
            ...body,
            code: String(body.code ?? ""),
            name: String(body.name ?? ""),
            weight: Number(body.weight),
            min_score: Number(body.min_score),
            max_score: Number(body.max_score),
          });
      }
      setDraft({});
      setEditing("");
      toast.success("Competition settings saved");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save settings.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="form-section page-stack">
      <h2>
        {kind
          .replaceAll("-", " ")
          .replace(/^./, (letter) => letter.toUpperCase())}
      </h2>
      {loading ? (
        <p role="status">Loading...</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={String(row.uuid)}
              className="border-border rounded-lg border p-4"
            >
              <strong>
                {String(
                  row.name ?? row.period_type ?? "Rule version " + row.version,
                )}
              </strong>
              <dl className="detail-grid">
                <div>
                  <dt>ID</dt>
                  <dd>{String(row.uuid)}</dd>
                </div>
                {schemas[kind].map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {Array.isArray(row[field.key])
                        ? (row[field.key] as string[]).join(", ")
                        : String(row[field.key] ?? "-")}
                    </dd>
                  </div>
                ))}
              </dl>
              {kind !== "rules" && (
                <div className="form-actions">
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      const values: Record<string, string> = {};
                      schemas[kind].forEach((field) => {
                        let value = String(row[field.key] ?? "");
                        if (field.type === "datetime-local" && value) {
                          const date = new Date(value);
                          value = new Date(
                            date.getTime() - date.getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16);
                        }
                        values[field.key] = value;
                      });
                      setDraft(values);
                      setEditing(String(row.uuid));
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Delete this " + kind.replaceAll("-", " ") + "?",
                        )
                      )
                        return;
                      setPending(true);
                      try {
                        if (kind === "registration-periods")
                          await COMPETITION_SERVICES.deletePeriod(
                            String(row.uuid),
                          );
                        else
                          await COMPETITION_SERVICES.deleteCriterion(
                            String(row.uuid),
                          );
                        toast.success("Deleted");
                        await load();
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Unable to delete.",
                        );
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div>
          <p role="alert" className="form-error">
            {error}
          </p>
          <Button variant="secondary" onClick={() => void load()}>
            Retry loading
          </Button>
        </div>
      )}
      <form onSubmit={submit} className="page-stack">
        <h3>
          {editing
            ? "Edit"
            : kind === "rules"
              ? "Create new rule version"
              : "Add new"}
        </h3>
        <fieldset disabled={pending || loading} className="form-grid">
          {schemas[kind]
            .filter((field) => !(editing && field.createOnly))
            .map((field) => (
              <Field
                key={field.key}
                label={field.label + (field.required ? " *" : "")}
              >
                {field.options ? (
                  <Select
                    required={field.required}
                    value={draft[field.key] ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, [field.key]: event.target.value })
                    }
                  >
                    <option value="">Select</option>
                    {field.options.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={field.type ?? "text"}
                    required={field.required}
                    min={field.type === "number" ? 0 : undefined}
                    step={field.type === "number" ? "any" : undefined}
                    value={draft[field.key] ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, [field.key]: event.target.value })
                    }
                  />
                )}
              </Field>
            ))}
        </fieldset>
        <div className="form-actions">
          {editing && (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft({});
                setEditing("");
              }}
            >
              Cancel edit
            </Button>
          )}
          <Button type="submit" disabled={pending || loading}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
export function CompetitionSettings({
  competitionId,
}: {
  competitionId: string;
}) {
  return (
    <div className="page-stack">
      {(["rules", "registration-periods", "score-criteria"] as const).map(
        (kind) => (
          <SettingsSection
            key={kind}
            competitionId={competitionId}
            kind={kind}
          />
        ),
      )}
    </div>
  );
}
