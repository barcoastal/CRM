// Copies SLDS assets from node_modules into public/slds so Next.js serves them as static files.
// Runs on every build (idempotent).
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";

const SRC = "node_modules/@salesforce-ux/design-system/assets";
const DST = "public/slds";

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

if (!(await exists(SRC))) {
  console.error(`SLDS source not found at ${SRC}; did you run npm install?`);
  process.exit(1);
}

await rm(DST, { recursive: true, force: true });
await cp(SRC, DST, { recursive: true });
console.log(`✓ Copied SLDS assets to ${DST}`);
