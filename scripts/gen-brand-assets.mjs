// Generates all Coastal CRM brand assets from a single wave-mark source.
// Run: node scripts/gen-brand-assets.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(".");
const BRAND = path.join(ROOT, "public/brand");
const APP = path.join(ROOT, "src/app");

const BLUE = "#3052FF";
const MID = "#5C8DFF";
const LIGHT = "#7FB2FF";
const INK = "#0D121C";

// smooth single-period wave (up then down), x0..x1 centered at yC, amplitude A
function wave(x0, x1, yC, A) {
  const mid = (x0 + x1) / 2;
  const a = x0 + (mid - x0) * 0.55;
  const b = mid - (mid - x0) * 0.55;
  const c = mid + (x1 - mid) * 0.55;
  const d = x1 - (x1 - mid) * 0.55;
  return `M ${x0} ${yC} C ${a} ${yC - A} ${b} ${yC - A} ${mid} ${yC} C ${c} ${yC + A} ${d} ${yC + A} ${x1} ${yC}`;
}

// 3-line ripple mark in a 512 box (primary). colors top->bottom.
function ripples3(c1, c2, c3, sw = 40) {
  return (
    `<path d="${wave(96, 416, 190, 38)}" stroke="${c1}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` +
    `<path d="${wave(96, 416, 256, 38)}" stroke="${c2}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` +
    `<path d="${wave(96, 416, 322, 38)}" stroke="${c3}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`
  );
}

// 2-line bold variant (only for the 16px favicon)
function ripples2(c1, c2, sw = 60) {
  return (
    `<path d="${wave(96, 416, 212, 44)}" stroke="${c1}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>` +
    `<path d="${wave(96, 416, 312, 44)}" stroke="${c2}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`
  );
}

const box = (inner, bg = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${bg !== "none" ? `<rect width="512" height="512" fill="${bg}"/>` : ""}${inner}</svg>`;

const roundedIcon = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BLUE}"/>${inner}</svg>`;

// --- SVG sources ---
const markSvg = box(ripples3(LIGHT, MID, BLUE)); // on transparent
const markWhiteSvg = box(ripples3("#BFD4FF", "#E2ECFF", "#ffffff")); // for dark bg
const icon3Svg = roundedIcon(ripples3("#BFD4FF", "#E2ECFF", "#ffffff"));
const icon2Svg = roundedIcon(ripples2("#CFE0FF", "#ffffff"));

function wordmarkSvg(textA, textB, bg) {
  const scale = 96 / 230;
  const markBand = `<g transform="translate(8,4) scale(${scale.toFixed(4)})"><g transform="translate(-70,-140)">${ripples3(LIGHT, MID, BLUE, 44)}</g></g>`;
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
  fs.writeFileSync(path.join(BRAND, "wordmark-white.svg"), wordmarkSvg("#ffffff", LIGHT, null));

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
