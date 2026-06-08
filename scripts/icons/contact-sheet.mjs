// Builds a single HTML page showing every generated icon for review.
//   node scripts/icons/contact-sheet.mjs  ->  public/icons/custom/_contact-sheet.html
import { readdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pub = (p) => resolve(ROOT, "public", p);
const list = (d) => (existsSync(pub(d)) ? readdirSync(pub(d)).filter((f) => !f.startsWith("_")).sort() : []);

function pngSection(title, dir, dark = false) {
  const files = list(dir).filter((f) => f.endsWith(".png"));
  if (!files.length) return "";
  const cells = files
    .map(
      (f) =>
        `<figure class="${dark ? "d" : ""}"><img src="/${dir}/${f}"/><figcaption>${f.replace(".png", "")}</figcaption></figure>`
    )
    .join("");
  return `<h2>${title} <span>(${files.length})</span></h2><div class="grid">${cells}</div>`;
}

function glyphSection() {
  const dir = resolve(ROOT, "scripts/icons/out/glyphs");
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
  const cells = files
    .map((f) => {
      const svg = readFileSync(resolve(dir, f), "utf8");
      return `<figure class="g"><div class="gi">${svg}</div><figcaption>${f.replace(".svg", "")}</figcaption></figure>`;
    })
    .join("");
  return `<h2>UI glyphs (SVG) <span>(${files.length})</span></h2><div class="grid">${cells}</div>`;
}

const html = `<!doctype html><meta charset="utf8"><title>Coastal CRM — icon contact sheet</title>
<style>
  body{font-family:system-ui;margin:0;background:#f4f6fb;color:#1a1a2e}
  header{background:#3052FF;color:#fff;padding:20px 28px}
  header h1{margin:0;font-size:20px}
  h2{padding:0 28px;margin:28px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#3052FF}
  h2 span{color:#9aa3c0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:14px;padding:0 28px}
  figure{margin:0;background:#fff;border:1px solid #e4e8f3;border-radius:14px;padding:14px;text-align:center}
  figure.d{background:#1a1a2e}
  figure img{width:64px;height:64px;object-fit:contain}
  figcaption{margin-top:8px;font-size:11px;color:#6b7390;word-break:break-word}
  .g .gi{display:flex;justify-content:center}
  .g svg{width:32px;height:32px;color:#3052FF}
</style>
<header><h1>Coastal CRM — Playful Icon Set</h1><div style="opacity:.8;font-size:13px;margin-top:4px">review sheet · style #3052FF</div></header>
${pngSection("Object / entity tiles", "icons/custom/tiles")}
${pngSection("App launcher tiles", "icons/custom/apps")}
${pngSection("Avatars", "icons/custom/avatars")}
${pngSection("Logo / mark", "icons/custom/logo")}
${glyphSection()}
`;

writeFileSync(pub("icons/custom/_contact-sheet.html"), html);
console.log("wrote public/icons/custom/_contact-sheet.html");
