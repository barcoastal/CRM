// Generates hosted trust badge PNGs for the quote email (Trustpilot + BBB).
// Email clients strip SVG, so these render as <img>. Clean brand-style
// recreations sized for retina. Run: node scripts/gen-trust-badges.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/email");
fs.mkdirSync(OUT, { recursive: true });

const TP_GREEN = "#00B67A";
const INK = "#191919";
const BBB_BLUE = "#00539B";

const STAR = "M2560 0l606 1841 1954 0-1580 1136 604 1841-1584-1140-1584 1140 604-1841-1580-1136 1954 0z";

// One green Trustpilot star tile (rounded square + white star).
function tpTile(x, size = 62) {
  const p = size * 0.16;
  const s = (size - p * 2) / 5120;
  return (
    `<rect x="${x}" y="0" width="${size}" height="${size}" rx="8" fill="${TP_GREEN}"/>` +
    `<path transform="translate(${x + p},${p}) scale(${s})" fill="#fff" d="${STAR}"/>`
  );
}

// Trustpilot: green stars row + wordmark + review line, on a soft card.
const TP_W = 680, TP_H = 210;
const trustpilot = `<svg xmlns="http://www.w3.org/2000/svg" width="${TP_W}" height="${TP_H}" viewBox="0 0 ${TP_W} ${TP_H}">
  <rect width="${TP_W}" height="${TP_H}" rx="18" fill="#ffffff"/>
  <g transform="translate(40,26)">
    <path transform="scale(0.0075)" fill="${TP_GREEN}" d="${STAR}"/>
    <text x="52" y="34" font-family="Helvetica Neue, Arial, sans-serif" font-size="40" font-weight="800" fill="${INK}">Trustpilot</text>
  </g>
  <g transform="translate(40,84)">
    ${tpTile(0)}${tpTile(70)}${tpTile(140)}${tpTile(210)}${tpTile(280)}
  </g>
  <text x="42" y="188" font-family="Helvetica Neue, Arial, sans-serif" font-size="24" fill="#4a4a4a"><tspan font-weight="800" fill="${INK}">Excellent</tspan> &#183; 400+ verified reviews</text>
</svg>`;

// BBB Accredited Business A+ seal (clean recreation with inset ring + check).
const BBB_W = 520, BBB_H = 210;
const bbb = `<svg xmlns="http://www.w3.org/2000/svg" width="${BBB_W}" height="${BBB_H}" viewBox="0 0 ${BBB_W} ${BBB_H}">
  <rect width="${BBB_W}" height="${BBB_H}" rx="20" fill="${BBB_BLUE}"/>
  <rect x="10" y="10" width="${BBB_W - 20}" height="${BBB_H - 20}" rx="14" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
  <!-- verified check chip -->
  <circle cx="${BBB_W - 44}" cy="44" r="18" fill="#ffffff"/>
  <path d="M ${BBB_W - 53} 44 l 6 7 l 13 -14" fill="none" stroke="${BBB_BLUE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="40" y="104" font-family="Helvetica Neue, Arial, sans-serif" font-size="70" font-weight="800" fill="#ffffff" letter-spacing="2">BBB</text>
  <text x="42" y="146" font-family="Helvetica Neue, Arial, sans-serif" font-size="19" font-weight="700" fill="#cfe0f4" letter-spacing="1.5">ACCREDITED BUSINESS</text>
  <line x1="330" y1="120" x2="330" y2="182" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>
  <text x="356" y="128" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="700" fill="#cfe0f4" letter-spacing="1">RATING</text>
  <text x="350" y="182" font-family="Helvetica Neue, Arial, sans-serif" font-size="60" font-weight="800" fill="#ffffff">A+</text>
</svg>`;

async function png(svg, name, w) {
  const buf = await sharp(Buffer.from(svg)).resize({ width: w }).png().toBuffer();
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("wrote", name, buf.length, "bytes");
}

await png(trustpilot, "trustpilot-badge.png", TP_W * 2);
await png(bbb, "bbb-badge.png", BBB_W * 2);
console.log("done");
