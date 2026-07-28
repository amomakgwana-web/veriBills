"use client";

import { useTransition } from "react";

import { revokeAccessCode } from "@/lib/actions/tenant";
import { buttonClass } from "@/components/ui";

export function RevokeCodeButton({ codeId }: { codeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("secondary", "sm")}
      onClick={() => startTransition(() => void revokeAccessCode(codeId))}
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
