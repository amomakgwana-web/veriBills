"use client";

import { useState, useTransition } from "react";

import { pollMeters } from "@/lib/actions/admin";
import { buttonClass } from "@/components/ui";

export function PollMetersButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("primary", "sm")}
        onClick={() =>
          startTransition(async () => {
            const result = await pollMeters();
            setMessage(result.message ?? null);
          })
        }
      >
        {pending ? "Polling…" : "Poll meters now"}
      </button>
      {message && (
        <p role="status" className="mt-1 max-w-sm text-xs text-slate-500">
          {message}
        </p>
      )}
    </div>
  );
}
