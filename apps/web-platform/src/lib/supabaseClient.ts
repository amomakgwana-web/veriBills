import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// `.trim()` is load-bearing, not cosmetic: pasting the anon key into a
// Vercel env var very easily leaves a trailing newline, and supabase-js
// puts that key into the `apikey` / `Authorization` request headers
// verbatim. The Fetch API rejects any header value containing a newline
// with an opaque `TypeError: Type error` — which surfaces as a "login
// failed" with no useful message and never reaches the server, so it
// leaves no auth log to diagnose from. Trimming here neutralises that at
// the one point every request flows through.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/**
 * The configured Supabase URL, exported for diagnostic error messages.
 * This is the *real* supabase.co URL, not the same-origin proxy path the
 * client actually requests through (see getClient() below) — it's shown to
 * the user so a genuine misconfiguration still names the offending value.
 */
export const supabaseUrl = url;

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error(
      "veriBills is missing its Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in the Vercel project's Environment Variables (Production " +
        "environment included) and redeploy.",
    );
  }
  // A malformed URL is a common cause of an opaque `TypeError` at request
  // time (supabase-js builds request URLs from this and `fetch`/`new URL`
  // throws on a bad value). Validate up front so the failure names the
  // offending value instead of surfacing as a bare "Type error".
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${url}". Expected https://<project-ref>.supabase.co`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL must start with https:// — got "${url}"`);
  }
  // Route through this app's own origin (next.config.mjs rewrites
  // /vbapi/* to the real Supabase URL, server-to-server) instead of
  // requesting supabase.co directly from the browser. Only applies in the
  // browser (window is defined) — getClient() is never actually called
  // during prerender (see the module doc below), so this never runs
  // server-side.
  const requestUrl = typeof window !== "undefined" ? `${window.location.origin}/vbapi` : url;
  client = createClient(requestUrl, anonKey, {
    global: {
      // THE root cause of the login "Type error": @supabase/auth-js's
      // resolveFetch() (dist/main/lib/helpers.js) falls back to
      // `(...args) => fetch(...args)` — a *bare* call to the captured
      // `fetch` reference, not `window.fetch(...)`/`globalThis.fetch(...)`.
      // Chrome/Firefox's fetch() tolerates being invoked without its
      // original receiver; Safari/WebKit's fetch() is spec'd to require
      // `this` to be the real global object and throws exactly
      // `TypeError: Type error` — no further detail — the instant it's
      // called detached, before any network activity happens at all. That
      // matches every symptom seen debugging this: Safari-only, zero
      // Supabase logs ever (the call never leaves the JS engine), and
      // identical whether the target was supabase.co directly or this
      // app's own /vbapi proxy (the destination was never reached either
      // way). supabase-js's own docs name this exact fix
      // (SupabaseClient.ts's `global.fetch` option doc comment):
      // `fetch.bind(globalThis)` keeps the receiver intact through every
      // internal `(...args) => customFetch(...args)` re-wrap.
      fetch: typeof window !== "undefined" ? window.fetch.bind(window) : fetch,
    },
  });
  return client;
}

/**
 * The single Postgres client the whole app shares. Reads go straight to
 * RLS-gated vb_* tables (db/002), writes go through the SECURITY DEFINER
 * RPC functions added from db/004 onward, and auth is Supabase Auth's own
 * session (JWT persisted in localStorage by this client, refreshed
 * automatically). This project's Supabase instance is shared with an
 * unrelated product, but the vb_ prefix and this client only ever touch
 * veriBills' own schemas.
 *
 * Created lazily behind a Proxy so that merely *importing* this module can
 * never throw. Next.js evaluates every client-component module during the
 * static-prerender step of `next build`; a top-level `throw` there (the old
 * behaviour when env vars were absent at build time) fails the whole
 * production build. Prerender never actually *calls* Supabase — that only
 * happens in the browser from a `useEffect` or an event handler — so
 * deferring client creation to first use lets the build succeed while still
 * giving a clear error if the app is ever used without configuration.
 * Function properties are bound to the real client so supabase-js internals
 * that rely on `this` (e.g. `supabase.from(...)`, `supabase.rpc(...)`) keep
 * working through the Proxy.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
