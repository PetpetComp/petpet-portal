import { AtSign, Music2, Share2, PlayCircle, Hash, X } from "lucide-react";
import type { SocialPlatform } from "../_lib/brand-rules";

const ICONS: Record<SocialPlatform, typeof AtSign> = {
  instagram: AtSign,
  tiktok: Music2,
  facebook: Share2,
  youtube: PlayCircle,
  threads: Hash,
  x: X,
};

export function SocialIcon({
  icon,
  size = 15,
}: {
  icon: SocialPlatform;
  size?: number;
}) {
  const Icon = ICONS[icon];
  return <Icon size={size} aria-hidden="true" />;
}
