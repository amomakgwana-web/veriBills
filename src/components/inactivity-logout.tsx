"use client";

import { useEffect, useRef } from "react";

import { signOut } from "@/lib/actions/auth";

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

/** Signs the caller out after `timeoutMs` of no mouse/keyboard/touch/scroll activity. */
export function InactivityLogout({ timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void signOut();
      }, timeoutMs);
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [timeoutMs]);

  return null;
}
