"use client";

import { useTransition } from "react";

import { acknowledgeUsageAlert } from "@/lib/actions/estate";
import { buttonClass } from "@/components/ui";

export function AcknowledgeAlertButton({ alertId }: { alertId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("secondary", "sm")}
      onClick={() => startTransition(() => void acknowledgeUsageAlert(alertId))}
    >
      {pending ? "…" : "Acknowledge"}
    </button>
  );
}
