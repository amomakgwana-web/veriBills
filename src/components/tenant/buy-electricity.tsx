"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { buyElectricity, type ElectricityState } from "@/lib/actions/electricity";
import { costForUnits, unitsForAmount, type TariffBlock } from "@/lib/domain/tariff";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/domain/money";

const INITIAL: ElectricityState = { status: "idle" };
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

type MeterOption = {
  id: string;
  meterNumber: string;
  tariff: {
    name: string;
    fixed_charge: string | number;
    vat_rate: string | number;
    markup_percent: string | number;
    blocks: TariffBlock[];
  } | null;
};

export function BuyElectricityForm({ meters }: { meters: MeterOption[] }) {
  const [state, action] = useActionState(buyElectricity, INITIAL);
  const [meterId, setMeterId] = useState(meters[0]?.id ?? "");
  const [amount, setAmount] = useState(200);

  const meter = meters.find((m) => m.id === meterId) ?? meters[0];

  // Quote live so the tenant sees the units before committing. The same maths
  // runs server-side at purchase time, so the number cannot drift.
  const quote = useMemo(() => {
    if (!meter?.tariff || !Number.isFinite(amount) || amount <= 0) return null;

    const units = unitsForAmount(meter.tariff, meter.tariff.blocks, amount);
    if (units <= 0) return { units: 0, rate: 0 };

    const cost = costForUnits(meter.tariff, meter.tariff.blocks, units);
    return { units, rate: cost.total / units };
  }, [meter, amount]);

  if (state.status === "success" && state.token) {
    return (
      <div className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Your token</p>
        <p className="my-3 rounded-lg bg-slate-100 px-3 py-4 font-mono text-lg tracking-wider text-slate-900 dark:bg-slate-800 dark:text-slate-100">
          {state.token}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatNumber(state.units, 2)} kWh. We have also sent this by SMS.
        </p>
        <a href="/tenant/electricity" className={`${buttonClass("secondary")} mt-4 w-full`}>
          Buy again
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="meter_id">
          Meter
        </label>
        <select
          id="meter_id"
          name="meter_id"
          value={meterId}
          onChange={(e) => setMeterId(e.target.value)}
          className={inputClass}
        >
          {meters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.meterNumber}
            </option>
          ))}
        </select>
        {meter?.tariff && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meter.tariff.name}</p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="amount">
          Amount
        </label>
        <div className="relative">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">R</span>
          <input
            id="amount"
            name="amount"
            type="number"
            min="10"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className={`${inputClass} pl-7`}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={
                amount === value
                  ? "bg-brand-700 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }
            >
              R{value}
            </button>
          ))}
        </div>
      </div>

      {quote && (
        <div className="bg-brand-50 dark:bg-brand-950/40 rounded-lg px-3 py-2.5 text-sm">
          {quote.units > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">You will receive</span>
                <span className="text-brand-800 dark:text-brand-200 font-semibold">
                  {formatNumber(quote.units, 2)} kWh
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Effective rate</span>
                <span className="tabular text-slate-600 dark:text-slate-300">
                  {formatMoney(quote.rate)}/kWh
                </span>
              </div>
            </>
          ) : (
            <p className="text-amber-700 dark:text-amber-300">
              This amount only covers the fixed charges. Increase it to buy units.
            </p>
          )}
        </div>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.message}
        </p>
      )}

      <SubmitButton disabled={!quote || quote.units <= 0} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${buttonClass("primary")} w-full`}
    >
      {pending ? "Purchasing…" : "Buy electricity"}
    </button>
  );
}
