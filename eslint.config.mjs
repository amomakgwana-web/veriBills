import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Generated from the live database schema; not ours to lint.
      "src/lib/supabase/types.ts",
    ],
  },
];

export default config;
