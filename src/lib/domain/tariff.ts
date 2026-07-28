/**
 * Stepped (block) tariff maths.
 *
 * Mirrors the `calculate_tariff_cost` / `units_for_amount` SQL functions so the
 * UI can quote a purchase before it is committed, without a database round
 * trip per keystroke. The database remains the authority at write time.
 */

export type TariffBlock = {
  sequence: number;
  block_from_units: string | number;
  block_to_units: string | number | null;
  rate_per_unit: string | number;
};

export type Tariff = {
  fixed_charge: string | number;
  vat_rate: string | number;
  markup_percent: string | number;
};

const num = (v: string | number | null | undefined) =>
  v === null || v === undefined ? 0 : typeof v === "string" ? Number(v) : v;

export type TariffCost = {
  net: number;
  vat: number;
  total: number;
};

/** Cost of consuming `units` under a stepped tariff. */
export function costForUnits(
  tariff: Tariff,
  blocks: TariffBlock[],
  units: number,
): TariffCost {
  let remaining = Math.max(units, 0);
  let net = 0;

  const ordered = [...blocks].sort((a, b) => a.sequence - b.sequence);

  for (const block of ordered) {
    if (remaining <= 0) break;

    const from = num(block.block_from_units);
    const to = block.block_to_units === null ? null : num(block.block_to_units);
    const unitsInBlock = to === null ? remaining : Math.min(remaining, to - from);

    net += unitsInBlock * num(block.rate_per_unit);
    remaining -= unitsInBlock;
  }

  net = net * (1 + num(tariff.markup_percent) / 100) + num(tariff.fixed_charge);
  net = round2(net);

  const vat = round2(net * num(tariff.vat_rate));
  return { net, vat, total: round2(net + vat) };
}

/**
 * Inverse of the above: how many units a given rand amount buys. Stepped
 * tariffs are monotonic in consumption, so bisection converges quickly and
 * handles any block layout without special-casing.
 */
export function unitsForAmount(
  tariff: Tariff,
  blocks: TariffBlock[],
  amount: number,
): number {
  if (amount <= 0) return 0;

  let low = 0;
  let high = 100_000;

  for (let i = 0; i < 60 && high - low >= 0.001; i++) {
    const mid = (low + high) / 2;
    if (costForUnits(tariff, blocks, mid).total > amount) {
      high = mid;
    } else {
      low = mid;
    }
  }

  // Truncate rather than round: rounding up can land on a quantity that costs
  // fractionally more than the buyer actually paid.
  return Math.floor(low * 1000) / 1000;
}

/** Effective average rate, for showing "R2.87/kWh" alongside a quote. */
export function effectiveRate(
  tariff: Tariff,
  blocks: TariffBlock[],
  units: number,
): number {
  if (units <= 0) return 0;
  return round2(costForUnits(tariff, blocks, units).total / units);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
