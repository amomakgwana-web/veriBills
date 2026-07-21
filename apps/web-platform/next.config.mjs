/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared-types/ui-kit ship compiled dist/ output (built via `tsc -b` in
  // the workspace build order) — Next.js consumes them as ordinary
  // packages, no transpilePackages needed.

  // Some browsers/networks block direct requests to *.supabase.co outright
  // (corporate firewalls, some privacy extensions, DNS-level filtering) —
  // the request never leaves the browser, which the Fetch API surfaces as
  // an opaque `TypeError`, indistinguishable from a real Supabase outage.
  // Routing every Supabase call through this app's own origin instead
  // (browser -> /vbapi/* on this domain -> Vercel rewrite -> supabase.co
  // server-to-server) sidesteps that class of block entirely: from the
  // browser's perspective every request is same-origin. See
  // src/lib/supabaseClient.ts for the client-side half of this.
  async rewrites() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
    if (!supabaseUrl) return [];
    return [{ source: "/vbapi/:path*", destination: `${supabaseUrl}/:path*` }];
  },
};

export default nextConfig;
