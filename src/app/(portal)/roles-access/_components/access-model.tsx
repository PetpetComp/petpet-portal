/**
 * Tiga kartu "lapis akses" + kotak "Effective access" di atas halaman Roles (desain Roles).
 * Teksnya penjelasan model akses yang tetap (doc 08 bagian 9.6), bukan data dari API,
 * jadi ditulis di sini. Dipanggil dari `RolesPage`.
 */
const LAYERS = [
  {
    n: 1,
    title: "Platform role -> permissions",
    body: "Global. Decides which menus and actions exist for this user at all.",
    source: "user_roles · role_permissions",
  },
  {
    n: 2,
    title: "Organization role",
    body: "Scoped to one org: Owner, Admin or Staff. Decides which org's events.",
    source: "organization_members",
  },
  {
    n: 3,
    title: "Event assignment",
    body: "Scoped to one event or competition: manager, PIC, judge, timer, marshal.",
    source: "staff_assignments",
  },
];

export function AccessModel() {
  return (
    <section
      aria-label="Access model"
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3"
    >
      {LAYERS.map((layer) => (
        <div
          key={layer.n}
          className="border-border grid content-start gap-1.5 rounded-2xl border bg-white px-[18px] py-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-primary-soft text-primary-dark grid size-[26px] place-items-center rounded-full font-mono text-[13px] font-bold">
              {layer.n}
            </span>
            <b>{layer.title}</b>
          </div>
          <span className="text-muted-foreground text-[13px] leading-[19px]">
            {layer.body}
          </span>
          <span className="text-primary-dark font-mono text-xs">
            {layer.source}
          </span>
        </div>
      ))}
      <div className="bg-primary-soft grid content-start gap-1.5 rounded-2xl px-[18px] py-4">
        <b className="text-primary-dark">Effective access</b>
        <span className="font-mono text-xs leading-[19px]">
          edit event = has <b>event.update</b>
          <br />
          AND (org OWNER/ADMIN
          <br />
          OR EVENT_MANAGER on it)
        </span>
      </div>
    </section>
  );
}
