import { OrganizationShell } from "../_components/organization-shell";

/** Header + tab yang dipakai semua tab detail organisasi. */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <OrganizationShell organizationId={organizationId}>
      {children}
    </OrganizationShell>
  );
}
