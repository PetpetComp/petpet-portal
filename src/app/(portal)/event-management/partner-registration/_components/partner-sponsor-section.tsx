"use client";
import { useState } from "react";
import Image from "next/image";
import { Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { CategoryPill } from "@/components/common/category-pill";
import { MultiSearchSelect } from "@/components/common/search-select";
import { SPONSOR_CATEGORIES, canModifyAssignment, isDuplicateAssignment } from "@/lib/constants/sponsorship";
import type { PortalRecord } from "@/types/portal";
import { initials } from "@/lib/identity";

interface PartnerRow {
  id: string;
  sponsorId: string;
  category: string;
  brand?: PortalRecord;
}

export function PartnerSponsorSection({
  event,
  brands,
  assignments,
  onAdd,
  onUpdateCategory,
  onRemove,
}: {
  event: PortalRecord;
  brands: PortalRecord[];
  assignments: PortalRecord[];
  onAdd: (assignment: PortalRecord) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [adding, setAdding] = useState(false);
  const [pickedBrandIds, setPickedBrandIds] = useState<string[]>([]);
  const [addCategory, setAddCategory] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [error, setError] = useState("");

  const editable = canModifyAssignment(event.status);
  const assignedBrandIds = new Set(assignments.map((row) => row.sponsorId));
  const availableBrands = brands.filter((brand) => !assignedBrandIds.has(brand.id));

  const rows: PartnerRow[] = assignments
    .map((row) => ({
      id: row.id,
      sponsorId: row.sponsorId,
      category: row.category,
      brand: brands.find((brand) => brand.id === row.sponsorId),
    }))
    .filter(
      (row) =>
        (row.brand?.name ?? "").toLowerCase().includes(name.toLowerCase()) &&
        (!category || row.category === category),
    );

  function confirmAdd() {
    if (!pickedBrandIds.length || !addCategory) {
      setError("Select at least one brand and a category.");
      return;
    }
    for (const brandId of pickedBrandIds) {
      if (isDuplicateAssignment(assignments, brandId, event.id)) continue;
      onAdd({
        id: "PAR-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        name: "Partner " + brandId,
        eventId: event.id,
        sponsorId: brandId,
        category: addCategory,
      });
    }
    setPickedBrandIds([]);
    setAddCategory("");
    setAdding(false);
    setError("");
  }

  const columns: Column<PartnerRow>[] = [
    {
      key: "logo",
      label: "Brand Logo",
      value: (row) => row.brand?.name ?? "",
      render: (row) =>
        row.brand?.logo ? (
          <Image
            src={row.brand.logo}
            width={32}
            height={32}
            unoptimized
            alt=""
            className="image-preview image-preview-circle"
          />
        ) : (
          <span className="record-initials">{initials(row.brand?.name ?? "", "B")}</span>
        ),
    },
    { key: "name", label: "Brand Name", value: (row) => row.brand?.name ?? "Unknown" },
    {
      key: "category",
      label: "Category",
      value: (row) => row.category,
      render: (row) =>
        editingId === row.id ? (
          <div className="row-actions">
            <Select value={editCategory} onChange={(evt) => setEditCategory(evt.target.value)}>
              {SPONSOR_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={() => {
                onUpdateCategory(row.id, editCategory);
                setEditingId("");
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId("")}>
              Cancel
            </Button>
          </div>
        ) : (
          <CategoryPill category={row.category} />
        ),
    },
    { key: "phone", label: "Brand Phone", value: (row) => row.brand?.phone ?? "-" },
  ];

  return (
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          <h2>Sponsorship and Media Partners</h2>
          <p className="muted">
            Manage brands assigned to this event. Data is synchronized with
            Brand Details.
          </p>
        </div>
        {editable && (
          <Button onClick={() => setAdding((current) => !current)}>
            <Plus size={15} />
            Add Partner
          </Button>
        )}
      </div>
      {adding && (
        <div className="inline-user-form">
          <MultiSearchSelect
            items={availableBrands}
            selectedIds={pickedBrandIds}
            onAdd={(id) => setPickedBrandIds((current) => [...current, id])}
            onRemove={(id) => setPickedBrandIds((current) => current.filter((item) => item !== id))}
            getId={(brand) => brand.id}
            getLabel={(brand) => brand.name}
            getDescription={(brand) => brand.phone}
            placeholder="Search brand name"
          />
          <div className="assignment-builder">
            <Field label="Category">
              <Select value={addCategory} onChange={(evt) => setAddCategory(evt.target.value)}>
                <option value="">Select category</option>
                {SPONSOR_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={confirmAdd}>Add Partner</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              <X size={15} />
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
      )}
      <div className="toolbar">
        <Field label="Brand name">
          <Input
            type="search"
            placeholder="Search brand name"
            value={name}
            onChange={(evt) => setName(evt.target.value)}
          />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(evt) => setCategory(evt.target.value)}>
            <option value="">All categories</option>
            {SPONSOR_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <div className="toolbar-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setName("");
              setCategory("");
            }}
          >
            <RotateCcw size={14} />
            Clear Filter
          </Button>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        label="Sponsors and media partners"
        actions={
          editable
            ? (row) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit category"
                    aria-label={"Edit " + (row.brand?.name ?? row.sponsorId)}
                    onClick={() => {
                      setEditingId(row.id);
                      setEditCategory(row.category);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove partner"
                    aria-label={"Remove " + (row.brand?.name ?? row.sponsorId)}
                    onClick={() => onRemove(row.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </>
              )
            : undefined
        }
      />
    </section>
  );
}
