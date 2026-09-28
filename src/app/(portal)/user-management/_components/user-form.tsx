"use client";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { SelectField } from "@/components/common/select-field";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { useAuth } from "@/hooks/use-auth";
import { USER_SERVICES } from "@/services/user-management";
import { ORGANIZATION_SERVICES } from "@/services/organization";
import { AUTH_SERVICES } from "@/services/auth";
import { recordPayload, type Row } from "@/services/backend-records";
import { collectRows } from "@/services/common";
import { REGION_SERVICES, type RegionRow } from "@/services/regions";
import type { PortalRecord } from "@/types/portal";
import {
  generateUsername,
  isDuplicateContact,
  isValidEmail,
  isValidPhone,
  userInitials,
} from "../_lib/user-rules";

const BASE_PATH = "/user-management";
const PROFILE_KEYS = ["dob", "gender", "address", "city", "province", "nation"];
const STATUSES = [
  { code: "Active", name: "Active" },
  { code: "Inactive", name: "Inactive" },
  { code: "Suspended", name: "Suspended" },
];
const GENDERS = [
  { code: "Male", name: "Male" },
  { code: "Female", name: "Female" },
];
function cityLabel(city: RegionRow) {
  if (!city.type) return city.name;
  const prefix = city.type.charAt(0) + city.type.slice(1).toLowerCase();
  return prefix + " " + city.name;
}

export function UserForm({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: string;
}) {
  const router = useRouter();
  const { data, save, refresh } = usePortalData();
  const { user: authUser, refreshSession } = useAuth();
  const user = mode === "edit" ? data.users.find((item) => item.id === id) : undefined;
  const currentRole = user?.roles?.split(",")[0]?.trim() ?? "";
  const isSelf = mode === "edit" && !!user && user.id === authUser?.id;
  const [draft, setDraft] = useState<PortalRecord>(() => ({
    id: "",
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    status: "Active",
    organizationId: "",
    role: currentRole,
    ...user,
  }));
  const [roles, setRoles] = useState<Row[]>([]);
  const [organizations, setOrganizations] = useState<Row[]>([]);
  const [countries, setCountries] = useState<RegionRow[]>([]);
  const [provinces, setProvinces] = useState<RegionRow[]>([]);
  const [cities, setCities] = useState<RegionRow[]>([]);
  const [countryId, setCountryId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [cityId, setCityId] = useState("");
  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl ?? "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const backPath = mode === "edit" && user ? BASE_PATH + "/" + user.id : BASE_PATH;

  useEffect(() => {
    let active = true;
    collectRows(USER_SERVICES.getRole)
      .then((rows) => {
        if (active) setRoles(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    collectRows(ORGANIZATION_SERVICES.list)
      .then((rows) => {
        if (active) setOrganizations(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    REGION_SERVICES.countries()
      .then((rows) => {
        if (!active) return;
        setCountries(rows);
        const match = rows.find(
          (row) => row.name.toLowerCase() === draft.nation?.trim().toLowerCase(),
        );
        if (match) setCountryId(match.uuid);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!countryId) return;
    let active = true;
    REGION_SERVICES.provinces(countryId)
      .then((rows) => {
        if (!active) return;
        setProvinces(rows);
        const match = rows.find(
          (row) => row.name.toLowerCase() === draft.province?.trim().toLowerCase(),
        );
        if (match) setProvinceId(match.uuid);
      })
      .catch(() => {
        if (active) setProvinces([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  useEffect(() => {
    if (!provinceId) return;
    let active = true;
    REGION_SERVICES.cities(provinceId)
      .then((rows) => {
        if (!active) return;
        setCities(rows);
        const match = rows.find(
          (row) => row.name.toLowerCase() === draft.city?.trim().toLowerCase(),
        );
        if (match) setCityId(match.uuid);
      })
      .catch(() => {
        if (active) setCities([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceId]);

  if (mode === "edit" && !user)
    return (
      <section className="page-stack">
        <h1>User not found</h1>
        <Link className="link-button" href={BASE_PATH}>
          Back to User Management
        </Link>
      </section>
    );

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setCountry(uuid: string) {
    const row = countries.find((item) => item.uuid === uuid);
    setDraft((current) => ({
      ...current,
      nation: row?.name ?? "",
      province: "",
      city: "",
    }));
    setCountryId(uuid);
    setProvinceId("");
    setCityId("");
    setProvinces([]);
    setCities([]);
  }

  function setProvince(uuid: string) {
    const row = provinces.find((item) => item.uuid === uuid);
    setDraft((current) => ({ ...current, province: row?.name ?? "", city: "" }));
    setProvinceId(uuid);
    setCityId("");
    setCities([]);
  }

  function setCity(uuid: string) {
    const row = cities.find((item) => item.uuid === uuid);
    set("city", row?.name ?? "");
    setCityId(uuid);
  }

  function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result));
    reader.readAsDataURL(file);
    if (mode !== "edit" || !id) return;
    setPhotoUploading(true);
    const upload = isSelf
      ? AUTH_SERVICES.uploadMyPhoto(file)
      : USER_SERVICES.uploadPhoto(id, file);
    upload
      .then(async () => {
        await Promise.all([isSelf ? refreshSession() : Promise.resolve(), refresh()]);
        toast.success("Profile photo updated");
      })
      .catch((cause) => {
        toast.error(
          cause instanceof Error ? cause.message : "Unable to upload photo.",
        );
      })
      .finally(() => setPhotoUploading(false));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!isValidPhone(draft.phone ?? "")) {
      setError("Phone must contain 8-15 digits.");
      return;
    }
    if (draft.email && !isValidEmail(draft.email)) {
      setError("Enter a valid email format.");
      return;
    }
    if (!draft.role) {
      setError("Role is required.");
      return;
    }
    const username =
      draft.username?.trim() ||
      generateUsername(draft.firstName, draft.lastName, data.users);
    const next: PortalRecord = { ...draft, username };
    if (isDuplicateContact(data.users, next)) {
      setError("Email or phone is already registered.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const saved = await save("users", next);
      if (mode === "create" && PROFILE_KEYS.some((key) => draft[key]?.trim())) {
        const body = recordPayload("users", { ...draft, id: saved.id }, true);
        await USER_SERVICES.update(saved.id, body);
        await refresh();
      }
      if (mode === "edit" && draft.role && draft.role !== currentRole) {
        await USER_SERVICES.assignRole(saved.id, draft.role);
        await refresh();
      }
      toast.success("User saved");
      router.push(mode === "edit" ? BASE_PATH + "/" + saved.id : BASE_PATH);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save user.");
      setPending(false);
    }
  }

  const breadcrumbItems = [
    { label: "User Management", href: BASE_PATH },
    ...(mode === "edit" && user
      ? [{ label: user.name || user.id, href: backPath }]
      : []),
    { label: mode === "edit" ? "Edit User" : "Add New User" },
  ];

  return (
    <div className="page-stack">
      <Breadcrumb items={breadcrumbItems} />
      <header>
        <h1>{mode === "edit" ? "Edit User" : "Add New User"}</h1>
        <p className="muted">
          {mode === "edit"
            ? "Update the selected user's profile information."
            : "Create a new platform user record."}
        </p>
      </header>
      <form onSubmit={submit} className="page-stack">
        <fieldset disabled={pending} className="form-section">
          <h2>General Information</h2>
          <div className="form-grid">
            <div className="form-grid-span-2">
              <Field label="User Photo">
                <div className="photo-uploader">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt=""
                      className="image-preview-circle image-placeholder-lg"
                    />
                  ) : (
                    <span
                      className="image-placeholder image-preview-circle image-placeholder-lg"
                      aria-hidden="true"
                    >
                      {userInitials(draft.firstName, draft.lastName ?? "")}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={photoUploading}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {photoUploading ? "Uploading..." : "Choose Photo"}
                  </Button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={pickPhoto}
                  />
                </div>
                <p className="muted photo-uploader-note">
                  {mode === "edit"
                    ? "Uploaded and saved when you pick a file."
                    : "Save the user first, then open Edit User to set a photo."}
                </p>
              </Field>
            </div>
            <div className="form-grid-span-2">
              <Field label="Username">
                <Input
                  placeholder="Leave blank to auto-generate"
                  value={draft.username ?? ""}
                  onChange={(event) => set("username", event.target.value)}
                />
              </Field>
            </div>
            <Field label="First Name *">
              <Input
                required
                value={draft.firstName}
                onChange={(event) => set("firstName", event.target.value)}
              />
            </Field>
            <Field label="Last Name">
              <Input
                value={draft.lastName ?? ""}
                onChange={(event) => set("lastName", event.target.value)}
              />
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={draft.dob ?? ""}
                onChange={(event) => set("dob", event.target.value)}
              />
            </Field>
            <Field label="Gender">
              <SelectField
                items={GENDERS}
                value={draft.gender ?? ""}
                onChange={(value) => set("gender", value)}
                getId={(item) => item.code}
                getLabel={(item) => item.name}
                placeholder="Search gender"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                placeholder="name@example.com"
                value={draft.email ?? ""}
                onChange={(event) => set("email", event.target.value)}
              />
            </Field>
            <Field label="Phone *">
              <Input
                required
                inputMode="numeric"
                maxLength={15}
                placeholder="081234567890"
                value={draft.phone ?? ""}
                onChange={(event) =>
                  set("phone", event.target.value.replace(/[^0-9]/g, ""))
                }
              />
            </Field>
            <Field label="Status">
              <SelectField
                items={STATUSES}
                value={draft.status ?? "Active"}
                onChange={(value) => set("status", value)}
                getId={(item) => item.code}
                getLabel={(item) => item.name}
                placeholder="Search status"
              />
            </Field>
            <Field label="Role *">
              <SelectField
                items={roles}
                value={draft.role ?? ""}
                onChange={(value) => set("role", value)}
                getId={(role) => String(role.code)}
                getLabel={(role) => String(role.name)}
                placeholder="Search role"
              />
            </Field>
            <div className="form-grid-span-2">
              <Field label="Organization">
                <SelectField
                  items={organizations}
                  value={draft.organizationId ?? ""}
                  onChange={(value) => set("organizationId", value)}
                  getId={(org) => String(org.uuid)}
                  getLabel={(org) => String(org.name)}
                  placeholder="Search organization"
                />
              </Field>
            </div>
            <div className="form-grid-span-2">
              <Field label="Address">
                <Textarea
                  rows={3}
                  value={draft.address ?? ""}
                  onChange={(event) => set("address", event.target.value)}
                />
              </Field>
            </div>
            <Field label="Country">
              <SelectField
                items={countries}
                value={countryId}
                onChange={setCountry}
                getId={(country) => country.uuid}
                getLabel={(country) => country.name}
                placeholder="Search country"
              />
            </Field>
            <Field label="State / Province">
              <SelectField
                items={countryId ? provinces : []}
                value={provinceId}
                onChange={setProvince}
                getId={(province) => province.uuid}
                getLabel={(province) => province.name}
                placeholder={countryId ? "Search province" : "Select country first"}
              />
            </Field>
            <Field label="City">
              <SelectField
                items={provinceId ? cities : []}
                value={cityId}
                onChange={setCity}
                getId={(city) => city.uuid}
                getLabel={cityLabel}
                placeholder={provinceId ? "Search city" : "Select province first"}
              />
            </Field>
            <Field label="Postal / ZIP Code">
              <Input
                value={draft.postalCode ?? ""}
                onChange={(event) => set("postalCode", event.target.value)}
                placeholder="e.g. 12345"
              />
              <p className="muted">Not yet supported by the connected API — not saved.</p>
            </Field>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link className={buttonVariants({ variant: "secondary" })} href={backPath}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            <Save size={16} />
            {pending ? "Saving..." : mode === "edit" ? "Save Changes" : "Save User"}
          </Button>
        </div>
      </form>
    </div>
  );
}
