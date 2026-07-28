"use client";

import { useState, useTransition } from "react";

import { refreshTenantScores } from "@/lib/actions/estate";
import { buttonClass } from "@/components/ui";

export function RefreshScoresButton({ orgId }: { orgId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("secondary", "sm")}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshTenantScores(orgId);
            setMessage(result.message ?? null);
          })
        }
      >
        {pending ? "Recalculating…" : "Recalculate scores"}
      </button>
      {message && (
        <p role="status" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
