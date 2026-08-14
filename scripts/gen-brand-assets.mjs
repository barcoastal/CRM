// Generates all Coastal CRM brand assets from a single wave-mark source.
// Run: node scripts/gen-brand-assets.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(".");
const BRAND = path.join(ROOT, "public/brand");
const APP = path.join(ROOT, "src/app");

const BLUE = "#1B96FF";
const DEEP = "#0B5CAB";
const SKY = "#4FC3F7";
const INK = "#0D121C";

// Azure Sky cloud (option B, picked 2026-08-14): puffy cloud built from
// circle lobes + rounded base, airy azure gradient with a sunlit highlight.
const GRAD = `<linearGradient id="az" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="${SKY}"/><stop offset="0.6" stop-color="${BLUE}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient>`;
const BADGE_GRAD = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient>`;

function cloud(fill) {
  return (
    `<g fill="${fill}">` +
    `<circle cx="172" cy="300" r="74"/>` +
    `<circle cx="256" cy="248" r="96"/>` +
    `<circle cx="348" cy="296" r="76"/>` +
    `<rect x="130" y="296" width="270" height="80" rx="40"/>` +
    `</g>`
  );
}

const HIGHLIGHT = `<g fill="#B3E5FC" opacity="0.7"><circle cx="234" cy="220" r="56"/><circle cx="170" cy="280" r="34"/></g>`;

const box = (inner, bg = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${bg !== "none" ? `<rect width="512" height="512" fill="${bg}"/>` : ""}${inner}</svg>`;

const roundedIcon = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>${BADGE_GRAD}</defs><rect width="512" height="512" rx="112" fill="url(#bg)"/>${inner}</svg>`;

// --- SVG sources ---
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>${GRAD}</defs>${cloud("url(#az)")}${HIGHLIGHT}</svg>`;
const markWhiteSvg = box(cloud("#ffffff"));
const icon3Svg = roundedIcon(cloud("#ffffff"));
const icon2Svg = roundedIcon(cloud("#ffffff"));

function wordmarkSvg(textA, textB, bg) {
  const markBand = `<defs>${GRAD}</defs><g transform="translate(14,2) scale(0.195)">${cloud(bg === null && textA === "#ffffff" ? "#ffffff" : "url(#az)")}</g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="104" viewBox="0 0 512 104">` +
    (bg ? `<rect width="512" height="104" fill="${bg}"/>` : "") +
    markBand +
    `<text x="150" y="68" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="50" font-weight="800" letter-spacing="-1.5">` +
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
  fs.writeFileSync(path.join(BRAND, "icon-192.png"), await png(icon3Svg, 192));
  fs.writeFileSync(path.join(BRAND, "icon-512.png"), await png(icon3Svg, 512));

  // App Router icons
  fs.writeFileSync(path.join(APP, "icon.png"), await png(icon3Svg, 512));
  fs.writeFileSync(path.join(APP, "apple-icon.png"), await png(icon3Svg, 180));

  // favicon.ico: 48 + 32 = 3-line, 16 = 2-line bold
  const ico = buildIco([
    { size: 48, png: await png(icon3Svg, 48) },
    { size: 32, png: await png(icon3Svg, 32) },
    { size: 16, png: await png(icon2Svg, 16) },
  ]);
  fs.writeFileSync(path.join(APP, "favicon.ico"), ico);

  console.log("brand assets generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
