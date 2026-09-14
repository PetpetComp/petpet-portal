export function initials(name: string, fallback: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || fallback
  );
}

export function generateId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function generateUniqueSlug(base: string, taken: string[]): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9.]/g, "") || "user";
  let candidate = clean;
  let suffix = 1;
  while (taken.includes(candidate)) {
    candidate = clean + suffix;
    suffix += 1;
  }
  return candidate;
}
