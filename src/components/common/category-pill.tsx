import { categoryClass } from "@/lib/constants/sponsorship";

export function CategoryPill({ category }: { category: string }) {
  return (
    <span className={"category-pill category-pill-" + categoryClass(category)}>
      {category}
    </span>
  );
}
