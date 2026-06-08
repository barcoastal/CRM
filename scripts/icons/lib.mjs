// Shared helpers for the icon generation pipeline.
// Reads GEMINI_API_KEY from .env.local (no dotenv dependency).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(ROOT, f), "utf8");
      const m = txt.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  throw new Error("GEMINI_API_KEY not found in env or .env.local");
}

export const KEY = loadKey();
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Generate an image from a text prompt (+ optional style-anchor PNG buffer).
// Returns a Buffer of PNG bytes.
export async function generateImage(prompt, { model = "gemini-2.5-flash-image", anchor = null } = {}) {
  const parts = [{ text: prompt }];
  if (anchor) parts.push({ inlineData: { mimeType: "image/png", data: anchor.toString("base64") } });
  const res = await fetch(`${BASE}/${model}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });
  if (!res.ok) throw new Error(`image ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const cand = json.candidates?.[0];
  const img = cand?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!img) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(img, "base64");
}

// Generate text (used for SVG glyph code). Returns the raw text.
export async function generateText(prompt, { model = "gemini-2.5-flash" } = {}) {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`text ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

export function save(relPath, buf) {
  const full = resolve(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, buf);
  return full;
}

export function readPng(relPath) {
  return readFileSync(resolve(ROOT, relPath));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
