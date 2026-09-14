"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { SearchSelect } from "@/components/common/search-select";
import { DataTable, type Column } from "@/components/common/data-table";
import type { PortalRecord } from "@/types/portal";
import { RolePill } from "@/app/(portal)/event-management/_components/role-pill";

interface CommitteeRow {
  id: string;
  userId: string;
  role: string;
  user?: PortalRecord;
}

const ROLE_OPTIONS = [
  { value: "Race PIC", label: "PIC" },
  { value: "Judge", label: "Judge" },
];

export function CompetitionCommittee({
  competitionId,
  users,
  members,
  onAdd,
  onRemove,
}: {
  competitionId: string;
  users: PortalRecord[];
  members: PortalRecord[];
  onAdd: (member: PortalRecord) => void;
  onRemove: (id: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("Race PIC");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const assignedIds = new Set(members.map((member) => member.userId));
  const candidates = users.filter((user) => !assignedIds.has(user.id));

  function addMember() {
    if (!userId) return;
    onAdd({
      id: "COM-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: "Committee " + competitionId,
      eventId: members[0]?.eventId ?? "",
      competitionId,
      userId,
      role,
    });
    setUserId("");
  }

  const rows: CommitteeRow[] = members
    .map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      user: users.find((user) => user.id === member.userId),
    }))
    .filter(
      (row) =>
        (!roleFilter || row.role === roleFilter) &&
        (!search ||
          (row.user?.name + " " + row.userId + " " + row.role)
            .toLowerCase()
            .includes(search.toLowerCase())),
    );

  const columns: Column<CommitteeRow>[] = [
    { key: "userId", label: "User ID", value: (row) => row.userId },
    { key: "firstName", label: "First Name", value: (row) => row.user?.firstName ?? "-" },
    { key: "lastName", label: "Last Name", value: (row) => row.user?.lastName ?? "-" },
    { key: "phone", label: "Phone", value: (row) => row.user?.phone ?? "-" },
    {
      key: "role",
      label: "Role",
      value: (row) => (row.role === "Race PIC" ? "PIC" : row.role),
      render: (row) => <RolePill role={row.role === "Race PIC" ? "PIC" : row.role} />,
    },
  ];

  return (
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">COMPETITION COMMITTEE</div>
          <h2>Competition Committee</h2>
          <p className="muted">
            People assigned to operate and judge this competition. User data
            is sourced from User Management.
          </p>
        </div>
      </div>
      <div className="assignment-builder">
        <div className="min-w-65 flex-1">
          <Field label="Add Committee Member">
            <SearchSelect
              items={candidates}
              value={userId}
              onChange={setUserId}
              getId={(user) => user.id}
              getLabel={(user) => user.name}
              getDescription={(user) => user.id}
              placeholder="Search name or User ID"
            />
          </Field>
        </div>
        <Field label="Role">
          <Select value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="button" variant="secondary" disabled={!userId} onClick={addMember}>
          <Plus size={15} />
          Add Committee
        </Button>
      </div>
      <div className="toolbar">
        <Field label="Search">
          <Input
            type="search"
            placeholder="Search name, User ID, or role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label="Role">
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            <option value="Race PIC">PIC</option>
            <option value="Judge">Judge</option>
          </Select>
        </Field>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        label="Competition committee"
        actions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            title="Remove"
            aria-label={"Remove " + (row.user?.name ?? row.userId)}
            onClick={() => onRemove(row.id)}
          >
            <Trash2 size={15} />
          </Button>
        )}
      />
    </section>
  );
}
