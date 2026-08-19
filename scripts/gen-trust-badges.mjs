// Generates hosted trust badge PNGs for the quote email (Trustpilot + BBB).
// Email clients strip SVG, so these render as <img>. Recognizable brand-style
// recreations. Run: node scripts/gen-trust-badges.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/email");
fs.mkdirSync(OUT, { recursive: true });

const TP_GREEN = "#00B67A";
const INK = "#191919";
const BBB_BLUE = "#0B5CAB";

// One green Trustpilot star tile.
function tpStar(x) {
  return (
    `<rect x="${x}" y="20" width="52" height="52" rx="6" fill="${TP_GREEN}"/>` +
    `<path transform="translate(${x + 6},26) scale(0.0078)" fill="#fff" d="M2560 0l606 1841 1954 0-1580 1136 604 1841-1584-1140-1584 1140 604-1841-1580-1136 1954 0z"/>`
  );
}

// Trustpilot badge: "Trustpilot" wordmark + 5 star tiles + rating line.
const trustpilot = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="150" viewBox="0 0 620 150">
  <rect width="620" height="150" fill="#ffffff"/>
  <g transform="translate(20,8)">
    <path transform="translate(0,0) scale(0.006)" fill="${TP_GREEN}" d="M2560 0l606 1841 1954 0-1580 1136 604 1841-1584-1140-1584 1140 604-1841-1580-1136 1954 0z"/>
    <text x="44" y="30" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="700" fill="${INK}">Trustpilot</text>
  </g>
  <g transform="translate(20,55)">
    ${tpStar(0)}${tpStar(58)}${tpStar(116)}${tpStar(174)}${tpStar(232)}
  </g>
  <text x="20" y="140" font-family="Helvetica Neue, Arial, sans-serif" font-size="20" fill="#4a4a4a">Rated <tspan font-weight="700" fill="${INK}">Excellent</tspan> &#183; 400+ verified reviews</text>
</svg>`;

// BBB Accredited Business A+ seal (clean recreation).
const bbb = `<svg xmlns="http://www.w3.org/2000/svg" width="470" height="150" viewBox="0 0 470 150">
  <rect width="470" height="150" rx="14" fill="${BBB_BLUE}"/>
  <text x="28" y="70" font-family="Helvetica Neue, Arial, sans-serif" font-size="52" font-weight="800" fill="#ffffff" letter-spacing="1">BBB</text>
  <text x="28" y="102" font-family="Helvetica Neue, Arial, sans-serif" font-size="18" font-weight="700" fill="#cfe0f4" letter-spacing="2">ACCREDITED BUSINESS</text>
  <line x1="300" y1="26" x2="300" y2="124" stroke="#3f77b0" stroke-width="2"/>
  <text x="330" y="62" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" font-weight="700" fill="#cfe0f4">RATING</text>
  <text x="322" y="118" font-family="Helvetica Neue, Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff">A+</text>
</svg>`;

async function png(svg, name, scale = 2) {
  const buf = await sharp(Buffer.from(svg)).resize({ width: Math.round((svg.match(/width="(\d+)"/)[1]) * scale) }).png().toBuffer();
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("wrote", name, buf.length, "bytes");
}

await png(trustpilot, "trustpilot-badge.png");
await png(bbb, "bbb-badge.png");
console.log("done");
