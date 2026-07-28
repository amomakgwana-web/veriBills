"use client";

import { useState, useTransition } from "react";

import { runHealthCheck } from "@/lib/actions/admin";
import { buttonClass } from "@/components/ui";

export function HealthCheckButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ status: string; message?: string } | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("primary", "sm")}
        onClick={() =>
          startTransition(async () => {
            setResult(await runHealthCheck());
          })
        }
      >
        {pending ? "Probing…" : "Run health check"}
      </button>
      {result?.message && (
        <p
          role="status"
          className={`mt-1 max-w-sm text-xs ${
            result.status === "success"
              ? "text-brand-600"
              : "text-red-600"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
