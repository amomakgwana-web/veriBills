import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set — see .env.local.example");
}

/**
 * The single Postgres client the whole app shares. Reads go straight to
 * RLS-gated vb_* tables (db/002), writes go through the SECURITY DEFINER
 * RPC functions added from db/004 onward, and auth is Supabase Auth's own
 * session (JWT persisted in localStorage by this client, refreshed
 * automatically). This project's Supabase instance is shared with an
 * unrelated product, but the vb_ prefix and this client only ever touch
 * veriBills' own schemas.
 */
export const supabase = createClient(url, anonKey);
