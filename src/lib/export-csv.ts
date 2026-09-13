export function exportCsv(
  filename: string,
  rows: Record<string, string | number>[],
) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv = [
    headers,
    ...rows.map((row) => headers.map((key) => row[key] ?? "")),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename + ".csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
