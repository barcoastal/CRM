// Icon generation driver.
//   node scripts/icons/generate.mjs tiles|apps|avatars|glyphs|logo|all
// Hero icons (tiles/apps/avatars/logo) -> PNG via gemini-2.5-flash-image,
// anchored to scripts/icons/_anchor.png for style consistency.
// Glyphs -> playful SVG via gemini text model.
import { generateImage, generateText, save, readPng, sleep } from "./lib.mjs";
import { STYLE, TILES, APPS, GLYPHS, AVATARS } from "./manifest.mjs";

const ANCHOR = readPng("scripts/icons/_anchor.png");
const CONCURRENCY = 4;
const phase = process.argv[2] || "all";

// Run tasks with a bounded pool + 2 retries each.
async function pool(items, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          results[idx] = await worker(item, idx);
          process.stdout.write(`  ok ${results[idx]}\n`);
          break;
        } catch (e) {
          if (attempt === 2) {
            process.stdout.write(`  FAIL ${item[0] ?? idx}: ${e.message}\n`);
            results[idx] = null;
          } else {
            await sleep(1500 * (attempt + 1));
          }
        }
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function heroIcon(subject, outPath) {
  const prompt = `Draw: ${subject}.\n\n${STYLE}`;
  const buf = await generateImage(prompt, { anchor: ANCHOR });
  save(outPath, buf);
  return outPath;
}

async function genTiles() {
  console.log(`\n== tiles (${TILES.length}) ==`);
  await pool(TILES, ([key, desc]) => heroIcon(desc, `public/icons/custom/tiles/${key}.png`));
}
async function genApps() {
  console.log(`\n== apps (${APPS.length}) ==`);
  await pool(APPS, ([key, desc]) => heroIcon(desc, `public/icons/custom/apps/${key}.png`));
}
async function genAvatars() {
  console.log(`\n== avatars (${AVATARS.length}) ==`);
  await pool(
    AVATARS.map((d, i) => [`avatar-${i + 1}`, d]),
    ([key, desc]) =>
      heroIcon(
        `${desc}, head and shoulders portrait, centered, on a soft solid light-blue (#E8EDFF) circular background that fills the square`,
        `public/icons/custom/avatars/${key}.png`
      )
  );
}
async function genLogo() {
  console.log(`\n== logo + favicon ==`);
  await heroIcon(
    "a logo MARK (no text) for 'Coastal Debt': a friendly stylized ocean wave curling into an upward growth arrow, forming a rounded badge",
    "public/icons/custom/logo/mark.png"
  );
}

function cleanSvg(raw) {
  let s = raw.trim();
  s = s.replace(/```(?:svg|xml|html)?/gi, "").replace(/```/g, "").trim();
  const start = s.indexOf("<svg");
  const end = s.lastIndexOf("</svg>");
  if (start === -1 || end === -1) throw new Error("no <svg> in output");
  return s.slice(start, end + 6).trim();
}

async function genGlyphs() {
  console.log(`\n== glyphs (${GLYPHS.length}) ==`);
  await pool(GLYPHS, async ([name, desc]) => {
    const prompt = `Generate ONE SVG icon of ${desc}.
STRICT requirements:
- viewBox="0 0 24 24", width and height attributes omitted.
- fill="none", stroke="currentColor", stroke-width="2", stroke-linecap="round", stroke-linejoin="round".
- Playful, friendly, slightly rounded/bouncy geometry but instantly legible at 16px.
- Consistent with a single cohesive icon family. Simple, few paths, no inner text.
- Output ONLY the raw <svg>...</svg> markup. No markdown, no explanation.`;
    const svg = cleanSvg(await generateText(prompt));
    save(`scripts/icons/out/glyphs/${name}.svg`, Buffer.from(svg, "utf8"));
    return name;
  });
}

const run = {
  tiles: genTiles, apps: genApps, avatars: genAvatars, logo: genLogo, glyphs: genGlyphs,
  all: async () => { await genTiles(); await genApps(); await genAvatars(); await genLogo(); await genGlyphs(); },
};
if (!run[phase]) { console.error(`unknown phase: ${phase}`); process.exit(1); }
await run[phase]();
console.log("\ndone.");
