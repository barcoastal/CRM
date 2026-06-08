// Generates only the glyph SVGs that don't exist yet (idempotent top-up).
import { existsSync } from "node:fs";
import { generateText, save, sleep } from "./lib.mjs";
import { GLYPHS } from "./manifest.mjs";

function clean(raw) {
  const s = raw.replace(/```(?:svg|xml|html)?/gi, "").replace(/```/g, "").trim();
  const a = s.indexOf("<svg");
  const b = s.lastIndexOf("</svg>");
  if (a === -1 || b === -1) throw new Error("no svg");
  return s.slice(a, b + 6);
}

const todo = GLYPHS.filter(([n]) => !existsSync(`scripts/icons/out/glyphs/${n}.svg`));
console.log(`generating ${todo.length} missing glyphs`);

let i = 0;
async function worker() {
  while (i < todo.length) {
    const [name, desc] = todo[i++];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const prompt = `Generate ONE SVG icon of ${desc}.
STRICT requirements:
- viewBox="0 0 24 24", no width/height attributes.
- fill="none", stroke="currentColor", stroke-width="2", stroke-linecap="round", stroke-linejoin="round".
- Playful, friendly, slightly rounded geometry but legible at 16px. Cohesive single family.
- Output ONLY the raw <svg>...</svg> markup. No markdown, no explanation.`;
        const svg = clean(await generateText(prompt));
        save(`scripts/icons/out/glyphs/${name}.svg`, Buffer.from(svg, "utf8"));
        console.log("  ok", name);
        break;
      } catch (e) {
        if (attempt === 2) console.log("  FAIL", name, e.message);
        else await sleep(1200 * (attempt + 1));
      }
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log("done");
