/**
 * Banner kuning "Mock data" untuk layar yang datanya dari endpoint yang belum ada di backend asli.
 * `show` biasanya konstanta `*_API_IS_MOCK` domainnya; false tidak menampilkan apa pun.
 */
export function MockBanner({
  show,
  message,
}: {
  show: boolean;
  message: string;
}) {
  if (!show) return null;
  return (
    <p
      role="note"
      className="bg-warning-soft text-event-day-ink rounded-xl px-4 py-3 text-sm font-semibold"
    >
      {message}
    </p>
  );
}
