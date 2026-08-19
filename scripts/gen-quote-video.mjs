// Builds the quote email's video poster: the YouTube thumbnail with a play
// button + caption baked in, hosted so email clients render it as a clickable
// image linking to the video. Run: node scripts/gen-quote-video.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/email");
fs.mkdirSync(OUT, { recursive: true });

const src = "/tmp/yt-max.jpg";
const W = 1200;
const H = 675;

const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.62"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <!-- play button -->
  <circle cx="${W / 2}" cy="${H / 2}" r="62" fill="#ffffff" opacity="0.96"/>
  <path d="M ${W / 2 - 22} ${H / 2 - 32} L ${W / 2 + 34} ${H / 2} L ${W / 2 - 22} ${H / 2 + 32} Z" fill="#0B5CAB"/>
</svg>`;

const base = await sharp(src).resize(W, H, { fit: "cover" }).toBuffer();
const out = await sharp(base)
  .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
  .jpeg({ quality: 82 })
  .toBuffer();
fs.writeFileSync(path.join(OUT, "quote-video.jpg"), out);
console.log("wrote quote-video.jpg", out.length, "bytes");
