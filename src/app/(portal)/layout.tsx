import { PortalDataProvider } from "@/components/providers/portal-data-provider";
import { PortalShell } from "@/components/layouts/portal-shell";
import { getPortalData } from "@/services/portal";
import "./portal.css";
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalDataProvider initialData={getPortalData()}>
      <PortalShell>{children}</PortalShell>
    </PortalDataProvider>
  );
}
