"use client";
import { useEffect, useState } from "react";
import { Building2, Mail, Phone, Users } from "lucide-react";
import { PageHero } from "@/components/common/page-hero";
import { EmptyState } from "@/components/common/empty-state";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { useCapabilities } from "@/hooks/use-capabilities";
import { ORGANIZATION_SERVICES, mapOrganization } from "@/services/organization";
import type { Organization } from "@/types/organization";
import "./my-organization.css";

export function MyOrganization() {
  const capabilities = useCapabilities();
  const { data } = usePortalData();
  const organizationId = capabilities.organizationIds[0] ?? null;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    ORGANIZATION_SERVICES.detail(organizationId)
      .then((response) => {
        if (active) setOrganization(mapOrganization(response.data));
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to load organization.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  if (loading) return <p role="status">Memuat organisasi...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!organizationId || !organization)
    return (
      <EmptyState
        icon={Building2}
        message="Kamu belum tergabung di organisasi manapun. Bikin event pertama buat mulai organisasimu."
      />
    );

  return (
    <div className="my-organization">
      <PageHero
        eyebrow="Organisasiku"
        title={organization.name}
        description="Anggota (PIC) yang terdaftar di organisasi ini."
      />
      {organization.pics.length === 0 ? (
        <EmptyState icon={Users} message="Belum ada PIC yang terdaftar di organisasi ini." />
      ) : (
        <div className="my-organization-pic-grid">
          {organization.pics.map((pic) => {
            const user = data.users.find((item) => item.id === pic.id);
            return (
              <article key={pic.id} className="my-organization-pic-card">
                <span className="my-organization-pic-icon">
                  <Users size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3>{pic.name}</h3>
                  {user?.email && (
                    <span className="my-organization-meta">
                      <Mail size={13} aria-hidden="true" />
                      {user.email}
                    </span>
                  )}
                  {user?.phone && (
                    <span className="my-organization-meta">
                      <Phone size={13} aria-hidden="true" />
                      {user.phone}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
