/**
 * Money handling.
 *
 * Amounts move through the database as `numeric`, which the Supabase client
 * hands back as a string to avoid the precision loss of IEEE-754. Everything
 * here works in integer cents and only converts at the edges.
 */

export const CURRENCY = "ZAR";
export const VAT_RATE = 0.15;

/** Parse a numeric column (string | number | null) into cents. */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Cents back to the decimal a numeric column expects. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatMoney(
  value: string | number | null | undefined,
  options: { showZero?: boolean; signed?: boolean } = {},
): string {
  const cents = toCents(value);
  if (cents === 0 && options.showZero === false) return "—";

  const formatted = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);

  if (options.signed && cents !== 0) {
    return `${cents > 0 ? "+" : "-"}${formatted}`;
  }
  return cents < 0 ? `-${formatted}` : formatted;
}

export function formatNumber(
  value: string | number | null | undefined,
  fractionDigits = 2,
): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Split VAT out of a VAT-inclusive amount. */
export function extractVat(inclusiveCents: number, rate = VAT_RATE) {
  const net = Math.round(inclusiveCents / (1 + rate));
  return { net, vat: inclusiveCents - net };
}

/** Add VAT to a VAT-exclusive amount. */
export function addVat(netCents: number, rate = VAT_RATE) {
  const vat = Math.round(netCents * rate);
  return { vat, total: netCents + vat };
}

/**
 * Split an amount into n instalments without losing or inventing cents.
 * The remainder lands on the first instalment, which is how collections teams
 * expect a payment arrangement to read.
 */
export function splitInstalments(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}
