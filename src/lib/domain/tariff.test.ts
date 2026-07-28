import test from "node:test";
import assert from "node:assert/strict";

import { costForUnits, unitsForAmount, effectiveRate } from "./tariff.ts";

// Mirrors the seeded "Eskom Homepower Prepaid 2026" tariff.
const prepaid = { fixed_charge: 0, vat_rate: 0.15, markup_percent: 3.5 };
const prepaidBlocks = [
  { sequence: 1, block_from_units: 0, block_to_units: 350, rate_per_unit: 2.4113 },
  { sequence: 2, block_from_units: 350, block_to_units: null, rate_per_unit: 3.7189 },
];

// Mirrors the seeded "Municipal Water 2026" tariff: first 6 kL free.
const water = { fixed_charge: 85, vat_rate: 0.15, markup_percent: 5 };
const waterBlocks = [
  { sequence: 1, block_from_units: 0, block_to_units: 6, rate_per_unit: 0 },
  { sequence: 2, block_from_units: 6, block_to_units: 15, rate_per_unit: 22.15 },
  { sequence: 3, block_from_units: 15, block_to_units: 30, rate_per_unit: 31.8 },
  { sequence: 4, block_from_units: 30, block_to_units: null, rate_per_unit: 46.2 },
];

test("prepaid electricity matches the values the database returns", () => {
  // Verified against calculate_tariff_cost() on the live schema.
  assert.equal(costForUnits(prepaid, prepaidBlocks, 200).total, 574.01);
  assert.equal(costForUnits(prepaid, prepaidBlocks, 400).total, 1225.84);
});

test("water tariff gives away the first block", () => {
  // Only the fixed charge applies below 6 kL.
  const free = costForUnits(water, waterBlocks, 5);
  assert.equal(free.net, 85);
  assert.equal(free.total, 97.75);
});

test("water tariff steps through each block", () => {
  // 12.828 kL -> 6.828 kL charged in block 2, matching invoice INV-2026-000009.
  assert.equal(costForUnits(water, waterBlocks, 12.828).total, 280.37);
});

test("consumption above the top block uses the open-ended rate", () => {
  // 47.6 kL -> blocks 2 and 3 in full, remainder at 46.20, matching B204.
  assert.equal(costForUnits(water, waterBlocks, 47.6).total, 1896.28);
});

test("unitsForAmount inverts costForUnits", () => {
  const kwh = unitsForAmount(prepaid, prepaidBlocks, 500);
  assert.equal(kwh, 174.213); // matches units_for_amount() in the database

  // A quote must never credit more units than the buyer paid for.
  assert.ok(costForUnits(prepaid, prepaidBlocks, kwh).total <= 500);
});

test("zero and negative consumption never produce a negative charge", () => {
  assert.equal(costForUnits(prepaid, prepaidBlocks, 0).total, 0);
  assert.equal(costForUnits(prepaid, prepaidBlocks, -10).total, 0);
  assert.equal(unitsForAmount(prepaid, prepaidBlocks, 0), 0);
  assert.equal(unitsForAmount(prepaid, prepaidBlocks, -50), 0);
});

test("blocks are applied in sequence order regardless of input order", () => {
  const shuffled = [...waterBlocks].reverse();
  assert.equal(
    costForUnits(water, shuffled, 47.6).total,
    costForUnits(water, waterBlocks, 47.6).total,
  );
});

test("effective rate reflects the blended price", () => {
  const rate = effectiveRate(prepaid, prepaidBlocks, 200);
  assert.equal(rate, 2.87);
});
