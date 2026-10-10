import { RequirePermission } from "@/components/common/can";
import { PERMISSION } from "@/lib/auth/permissions";
import { EventCreateWizard } from "../_components/event-create-wizard";

export default function Page() {
  return (
    <RequirePermission permission={PERMISSION.EVENT_CREATE}>
      <EventCreateWizard />
    </RequirePermission>
  );
}
