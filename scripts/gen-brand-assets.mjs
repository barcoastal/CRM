// Generates Coastal CRM assets from the company's original two-tone chevron.
// Run: node scripts/gen-brand-assets.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(".");
const BRAND = path.join(ROOT, "public/brand");
const APP = path.join(ROOT, "src/app");

const BLUE = "#3052FF";
const SKY = "#7FB2FF";
const INK = "#0D121C";

const original = fs.readFileSync(path.join(BRAND, "chevron.svg"), "utf8");
const paths = original.match(/<path\b[^>]*\/>/g)?.join("");
if (!paths) throw new Error("Coastal chevron paths are missing");
const whitePaths = paths.replaceAll(BLUE, "#ffffff").replaceAll(SKY, "#c8dcff");
const centeredMark = inner => `<g transform="translate(134 106) scale(1.45)">${inner}</g>`;

const box = (inner, bg = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${bg !== "none" ? `<rect width="512" height="512" fill="${bg}"/>` : ""}${inner}</svg>`;

const roundedIcon = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BLUE}"/>${inner}</svg>`;

// --- SVG sources ---
const markSvg = box(centeredMark(paths));
const markWhiteSvg = box(centeredMark(whitePaths));
const iconSvg = roundedIcon(centeredMark(whitePaths));

function wordmarkSvg(textA, textB, bg) {
  const markBand = `<g transform="translate(12 10) scale(0.4)">${textA === "#ffffff" ? whitePaths : paths}</g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="104" viewBox="0 0 512 104">` +
    (bg ? `<rect width="512" height="104" fill="${bg}"/>` : "") +
    markBand +
    `<text x="102" y="68" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="50" font-weight="700" letter-spacing="-1.5">` +
    `<tspan fill="${textA}">Coastal</tspan><tspan dx="10" fill="${textB}">CRM</tspan></text></svg>`
  );
}

// --- minimal PNG-in-ICO encoder ---
function buildIco(entries /* [{size, png}] */) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const datas = [];
  entries.forEach((e, i) => {
    const b = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 0); // width
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 1); // height
    dir.writeUInt8(0, b + 2); // palette
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // planes
    dir.writeUInt16LE(32, b + 6); // bit count
    dir.writeUInt32LE(e.png.length, b + 8); // size
    dir.writeUInt32LE(offset, b + 12); // offset
    offset += e.png.length;
    datas.push(e.png);
  });
  return Buffer.concat([header, dir, ...datas]);
}

async function png(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function main() {
  // SVG sources
  fs.writeFileSync(path.join(BRAND, "mark.svg"), markSvg);
  fs.writeFileSync(path.join(BRAND, "mark-white.svg"), markWhiteSvg);
  fs.writeFileSync(path.join(BRAND, "coastal-crm.svg"), wordmarkSvg(INK, BLUE, null));
  fs.writeFileSync(path.join(BRAND, "wordmark-white.svg"), wordmarkSvg("#ffffff", SKY, null));

  // PWA icons
  fs.writeFileSync(path.join(BRAND, "icon-192.png"), await png(iconSvg, 192));
  fs.writeFileSync(path.join(BRAND, "icon-512.png"), await png(iconSvg, 512));

  // App Router icons
  fs.writeFileSync(path.join(APP, "icon.png"), await png(iconSvg, 512));
  fs.writeFileSync(path.join(APP, "apple-icon.png"), await png(iconSvg, 180));

  // Multi-size favicon, using the same recognizable Coastal mark.
  const ico = buildIco([
    { size: 48, png: await png(iconSvg, 48) },
    { size: 32, png: await png(iconSvg, 32) },
    { size: 16, png: await png(iconSvg, 16) },
  ]);
  fs.writeFileSync(path.join(APP, "favicon.ico"), ico);

  console.log("brand assets generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
