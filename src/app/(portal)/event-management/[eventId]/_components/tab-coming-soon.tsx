import { Hourglass } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";

/**
 * Isi sementara untuk tab event yang halamannya belum dibangun (Committee, Sponsors, Doorprize).
 * Dipakai supaya tab di header tidak menuju 404. Ganti `page.tsx` tab itu saat halamannya jadi.
 */
export function TabComingSoon({ title }: { title: string }) {
  return (
    <EmptyState
      icon={Hourglass}
      message={`${title} is coming soon. It will be available here in a later release.`}
    />
  );
}
