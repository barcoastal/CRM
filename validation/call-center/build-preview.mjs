import { build } from "esbuild";
import { readFile, writeFile, readdir, symlink, lstat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const folder = path.join(root, "validation/call-center");
const cssFolder = path.join(root, ".next/static/css");
const cssFiles = await readdir(cssFolder);
for (const file of cssFiles) {
  const content = await readFile(path.join(cssFolder, file), "utf8");
  if (content.includes("sf-global-bar")) { await writeFile(path.join(folder, "crm-shell.css"), content.replaceAll("/_next/static/media/", "/media/")); break; }
}
for (const [name, target] of Object.entries({brand:"../../public/brand",slds:"../../public/slds",icons:"../../public/icons",media:"../../.next/static/media"})) {
  try { await lstat(path.join(folder, name)); } catch { await symlink(target, path.join(folder, name), "dir"); }
}
await build({ absWorkingDir: root, entryPoints: ["validation/call-center/preview.tsx"], bundle: true, minify: true, outfile: "validation/call-center/preview.js", alias: { "next/link": "./validation/call-center/preview-link.tsx", "next/navigation": "./validation/call-center/preview-navigation.ts", "next-auth/react": "./validation/call-center/preview-auth.tsx" }, define: { "process.env.NODE_ENV": '"production"' } });
console.log("CRM shell preview rebuilt. Serve validation/call-center and open preview.html.");
