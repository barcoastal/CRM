/**
 * Contract template storage. Categorized .docx templates on the volume — one
 * active template per category. No DB migration; latest upload per category wins.
 */
import fs from "fs/promises";
import path from "path";

export type ContractCategory =
  | "COASTAL"
  | "PROCESSOR_SAS"
  | "PROCESSOR_RAM"
  | "LEGAL_CITADEL"
  | "LEGAL_VICTORY";

export const CATEGORIES: { key: ContractCategory; label: string }[] = [
  { key: "COASTAL", label: "Coastal Master Agreement (always)" },
  { key: "PROCESSOR_SAS", label: "SAS Processor Agreement" },
  { key: "PROCESSOR_RAM", label: "RAM Processor Agreement" },
  { key: "LEGAL_CITADEL", label: "Citadel Legal Plan" },
  { key: "LEGAL_VICTORY", label: "Victory Legal Plan" },
];

function templatesDir(): string {
  return process.env.NODE_ENV === "production"
    ? "/data/contract-templates"
    : path.join(process.cwd(), ".data", "contract-templates");
}

function fileFor(category: ContractCategory): string {
  return path.join(templatesDir(), `${category}.docx`);
}
function metaFor(category: ContractCategory): string {
  return path.join(templatesDir(), `${category}.json`);
}

export async function saveTemplate(category: ContractCategory, buffer: Buffer, originalName: string): Promise<void> {
  await fs.mkdir(templatesDir(), { recursive: true });
  await fs.writeFile(fileFor(category), buffer);
  await fs.writeFile(metaFor(category), JSON.stringify({ originalName, uploadedAt: new Date().toISOString() }));
}

export async function readTemplate(category: ContractCategory): Promise<Buffer | null> {
  try {
    return await fs.readFile(fileFor(category));
  } catch {
    return null;
  }
}

export async function listTemplates(): Promise<{ category: ContractCategory; label: string; originalName: string | null; uploadedAt: string | null }[]> {
  return Promise.all(
    CATEGORIES.map(async ({ key, label }) => {
      let originalName: string | null = null;
      let uploadedAt: string | null = null;
      try {
        const meta = JSON.parse(await fs.readFile(metaFor(key), "utf8"));
        originalName = meta.originalName ?? null;
        uploadedAt = meta.uploadedAt ?? null;
      } catch {
        // not uploaded yet
      }
      return { category: key, label, originalName, uploadedAt };
    }),
  );
}
