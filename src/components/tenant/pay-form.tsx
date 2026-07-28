"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { payAccount, type PaymentActionState } from "@/lib/actions/payments";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import { formatMoney } from "@/lib/domain/money";

const INITIAL: PaymentActionState = { status: "idle" };

const CHANNELS = [
  { value: "rent", label: "Rent" },
  { value: "levy", label: "Levy" },
  { value: "water", label: "Water" },
  { value: "electricity", label: "Electricity" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

export function PayForm({ accountId, balance }: { accountId: string; balance: number }) {
  const [state, action] = useActionState(payAccount, INITIAL);

  // A 3DS challenge hands back a URL the cardholder must be sent to.
  useEffect(() => {
    if (state.status === "requires_3ds" && state.redirectUrl) {
      window.location.href = state.redirectUrl;
    }
  }, [state]);

  const suggested = balance > 0 ? balance.toFixed(2) : "";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="account_id" value={accountId} />

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
            step="0.01"
            min="1"
            required
            defaultValue={suggested}
            className={`${inputClass} pl-7`}
            placeholder="0.00"
          />
        </div>
        {balance > 0 && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Full balance is {formatMoney(balance)}.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="channel">
          Paying towards
        </label>
        <select id="channel" name="channel" className={inputClass} defaultValue="rent">
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Payments are allocated to the oldest invoice first.
        </p>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <p
          role="status"
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300"
        >
          {state.message}
        </p>
      )}

      {state.status === "requires_3ds" && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Redirecting you to your bank to verify this payment…
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-xs text-slate-400">
        Card details are tokenised by the gateway and never stored by veriBills.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
      {pending ? "Processing…" : "Pay now"}
    </button>
  );
}
