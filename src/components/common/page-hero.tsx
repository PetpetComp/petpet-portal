import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <section className="page-hero">
      <p className="page-hero-eyebrow">
        <Sparkles size={14} aria-hidden="true" /> {eyebrow}
      </p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
