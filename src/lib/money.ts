export function dollarsToCents(v: string | number) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "0"));
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}
