#!/usr/bin/env node
// Copies every apps/*/.env.local.example to a sibling .env.local if one
// doesn't already exist, so `pnpm dev` works with zero config beyond
// filling in the two NEXT_PUBLIC_SUPABASE_* values.
import { readdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const roots = ["apps"];
let copied = 0;

for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    const example = join(dir, ".env.local.example");
    const target = join(dir, ".env.local");
    if (existsSync(example) && !existsSync(target)) {
      copyFileSync(example, target);
      console.log(`created ${target}`);
      copied++;
    }
  }
}

console.log(copied > 0 ? `\nDone — created ${copied} .env file(s).` : "\nAll .env files already present.");
