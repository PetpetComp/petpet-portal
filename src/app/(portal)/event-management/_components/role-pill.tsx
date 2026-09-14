export function RolePill({ role }: { role: string }) {
  const tone = role === "Judge" ? "judge" : "pic";
  return <span className={"role-pill role-pill-" + tone}>{role}</span>;
}
