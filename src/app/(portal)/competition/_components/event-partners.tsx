"use client";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
export function EventPartners({ eventId }: { eventId: string }) {
  const { data } = usePortalData();
  const partners: PortalRecord[] = data.partners
    .filter((item) => item.eventId === eventId)
    .flatMap((item) => {
      const brand = data.brands.find((brand) => brand.id === item.sponsorId);
      return brand ? [{ ...brand, category: item.category }] : [];
    });
  if (!partners.length) return null;
  return (
    <section className="sponsor-strip">
      <span className="eyebrow">EVENT PARTNERS</span>
      {partners.map((brand) => (
        <div key={brand.id}>
          <strong className="sponsor-wordmark">
            {brand.name}
            <span>{brand.campaign}</span>
          </strong>
          <span className="sponsor-tier">{brand.category}</span>
        </div>
      ))}
    </section>
  );
}
