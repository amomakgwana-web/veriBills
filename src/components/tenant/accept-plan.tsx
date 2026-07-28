"use client";

import { useState, useTransition } from "react";

import { acceptPaymentPlan } from "@/lib/actions/tenant";
import { buttonClass } from "@/components/ui";

export function AcceptPlanButton({ planId }: { planId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={`${buttonClass("primary", "sm")} w-full`}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptPaymentPlan(planId);
            setMessage(result.message ?? null);
          })
        }
      >
        {pending ? "Accepting…" : "Accept arrangement"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {message}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Accepting confirms you will pay the instalments alongside your normal monthly charges.
      </p>
    </div>
  );
}
