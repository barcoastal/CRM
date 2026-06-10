/**
 * Object Manager DMMF reader.
 *
 * Reads the Prisma runtime data model on demand and projects each model down
 * to a simple, serializable shape that the Object Manager UI + APIs use to
 * present the schema. This is request-time only. We do NOT precompute at
 * build, because the generated client lives in the same repo and the data
 * model is already in memory once the client is instantiated.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type FieldMeta = {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string; // "String" | "Int" | "DateTime" | "$ModelName" | "$EnumName"
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isId: boolean;
  isReadOnly: boolean;
  isUpdatedAt: boolean;
  hasDefaultValue: boolean;
  default: string | null;
  relationName: string | null;
  documentation: string | null;
};

export type ObjectMeta = {
  name: string;
  label: string; // pluralized for display
  documentation: string | null;
  fields: FieldMeta[];
};

type RuntimeField = {
  kind: "scalar" | "object" | "enum" | "unsupported";
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isId: boolean;
  isReadOnly: boolean;
  isUpdatedAt?: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  relationName?: string;
  documentation?: string;
};

type RuntimeModel = {
  fields: RuntimeField[];
  documentation?: string;
};

function pluralize(name: string): string {
  if (/(s|x|z|sh|ch)$/i.test(name)) return name + "es";
  if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + "ies";
  return name + "s";
}

function serializeDefault(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object" && value !== null && "name" in (value as Record<string, unknown>)) {
    const v = value as { name?: string; args?: unknown };
    const n = typeof v.name === "string" ? v.name : "";
    if (Array.isArray(v.args) && v.args.length) return `${n}(${v.args.map((a) => JSON.stringify(a)).join(", ")})`;
    return n ? `${n}()` : null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function projectField(f: RuntimeField): FieldMeta {
  return {
    name: f.name,
    kind: f.kind,
    type: f.type,
    isRequired: !!f.isRequired,
    isList: !!f.isList,
    isUnique: !!f.isUnique,
    isId: !!f.isId,
    isReadOnly: !!f.isReadOnly,
    isUpdatedAt: !!f.isUpdatedAt,
    hasDefaultValue: !!f.hasDefaultValue,
    default: serializeDefault(f.default),
    relationName: f.relationName ?? null,
    documentation: f.documentation ?? null,
  };
}

function getRuntimeModels(): Record<string, RuntimeModel> {
  const client = prisma as unknown as { _runtimeDataModel?: { models: Record<string, RuntimeModel> } };
  const models = client._runtimeDataModel?.models;
  if (!models) {
    throw new Error("Prisma runtime data model unavailable. Did the client initialize?");
  }
  return models;
}

/**
 * List every model in the schema, sorted alphabetically. Cached per-request
 * via React.cache().
 */
export const listObjects = cache((): ObjectMeta[] => {
  const models = getRuntimeModels();
  const out: ObjectMeta[] = [];
  for (const [name, m] of Object.entries(models)) {
    out.push({
      name,
      label: pluralize(name),
      documentation: m.documentation ?? null,
      fields: m.fields.map(projectField),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
});

/**
 * Get a single model by name. Returns null if not found.
 */
export const getObject = cache((name: string): ObjectMeta | null => {
  const models = getRuntimeModels();
  const m = models[name];
  if (!m) return null;
  return {
    name,
    label: pluralize(name),
    documentation: m.documentation ?? null,
    fields: m.fields.map(projectField),
  };
});

/**
 * Lightweight summary for the index page, avoids shipping every field down
 * the wire when the caller only wants counts.
 */
export const summarizeObjects = cache((): { name: string; label: string; fieldCount: number }[] => {
  return listObjects().map((o) => ({
    name: o.name,
    label: o.label,
    fieldCount: o.fields.length,
  }));
});
