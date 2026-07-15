/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared-types/ui-kit ship compiled dist/ output (built via `tsc -b` in
  // the workspace build order) — Next.js consumes them as ordinary
  // packages, no transpilePackages needed.
};

export default nextConfig;
