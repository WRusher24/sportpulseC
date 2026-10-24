// After `next build`: fails if the server bundle loads any third-party package at runtime via require()/import().
// Such "externals" are what caused ERR_REQUIRE_ESM on Vercel (sanitize-html -> htmlparser2). Everything must be bundled.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";

const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const externals = new Map();
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".js")) for (const m of readFileSync(p, "utf8").matchAll(/\.x\("([^"]+)"/g)) externals.set(m[1], p);
  }
};
walk(".next/server");
const offenders = [...externals].filter(([name]) => !builtins.has(name.split("/")[0]) && !builtins.has(name) && !name.startsWith("next/") && !name.startsWith("node:"));
if (offenders.length) {
  console.error("Third-party packages loaded at runtime (must be bundled):");
  for (const [n, f] of offenders) console.error(`  ${n}  (${f})`);
  process.exit(1);
}
console.log(`serverless bundle OK: ${externals.size} externals, all Node built-ins / Next internals`);
