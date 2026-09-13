import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CheckpointControl({
  name,
  count,
  total,
  disabled,
  onCapture,
}: {
  name: string;
  count: number;
  total: number;
  disabled: boolean;
  onCapture: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled || count >= total}
      aria-label={"Checkpoint for " + name}
      onClick={onCapture}
    >
      <MapPin size={14} />
      {count} / {total}
    </Button>
  );
}
