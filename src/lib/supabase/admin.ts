import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client. Bypasses row level security, so it is reserved for the
 * operations RLS deliberately withholds from the browser: running billing,
 * settling payments, issuing prepaid tokens, writing delivery receipts.
 *
 * Never import this into a Client Component. The `server-only` guard above
 * turns any such import into a build error.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Privileged operations (billing runs, " +
        "payment settlement, token issue) cannot run without it.",
    );
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the service role is configured, for degrading the UI gracefully. */
export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
