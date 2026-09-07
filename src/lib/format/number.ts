const IDR_FMT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const NUM_FMT = new Intl.NumberFormat("en-US");

export function formatCurrencyIDR(value: number | null | undefined): string {
  return IDR_FMT.format(Number(value ?? 0));
}

export function formatNumber(value: number | null | undefined): string {
  return NUM_FMT.format(Number(value ?? 0));
}
