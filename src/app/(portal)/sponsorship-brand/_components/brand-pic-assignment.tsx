"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { MultiSearchSelect } from "@/components/common/search-select";
import { InlineUserForm } from "@/components/common/inline-user-form";
import type { PortalRecord } from "@/types/portal";

export function BrandPicAssignment({
  users,
  selectedIds,
  onAdd,
  onRemove,
  onCreateUser,
}: {
  users: PortalRecord[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCreateUser: (user: PortalRecord) => void;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <MultiSearchSelect
        items={users}
        selectedIds={selectedIds}
        onAdd={onAdd}
        onRemove={onRemove}
        getId={(user) => user.id}
        getLabel={(user) => user.name}
        getDescription={(user) => user.id + " · " + (user.phone || "no phone")}
        placeholder="Search by name, User ID, or phone"
        renderEmpty={() =>
          creating ? null : (
            <button
              type="button"
              className="search-select-add-new"
              onClick={() => setCreating(true)}
            >
              <UserPlus size={14} />
              User not found. Add a new PIC user.
            </button>
          )
        }
      />
      {creating && (
        <InlineUserForm
          users={users}
          submitLabel="Add & Assign PIC"
          onCancel={() => setCreating(false)}
          onCreate={(user) => {
            onCreateUser(user);
            onAdd(user.id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
