import type { PrismaClient } from "@/generated/prisma/client";

export interface TriggerCtx {
  prisma: PrismaClient | Omit<PrismaClient, "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;
  userId: string | null;
  /** Set of "<entity>:<id>" pairs we've already processed in this request — prevents recursion */
  skip: Set<string>;
}

export interface BeforeArgs<TWrite> {
  next: TWrite;
  prev?: never;
  ctx: TriggerCtx;
}

export interface BeforeUpdateArgs<TRow, TWrite> {
  next: TWrite;
  prev: TRow;
  ctx: TriggerCtx;
}

export interface AfterArgs<TRow> {
  row: TRow;
  prev?: never;
  ctx: TriggerCtx;
}

export interface AfterUpdateArgs<TRow> {
  row: TRow;
  prev: TRow;
  ctx: TriggerCtx;
}

export interface Trigger<TRow, TWrite = Partial<TRow>> {
  beforeInsert?: (args: BeforeArgs<TWrite>) => Promise<void> | void;
  beforeUpdate?: (args: BeforeUpdateArgs<TRow, TWrite>) => Promise<void> | void;
  afterInsert?: (args: AfterArgs<TRow>) => Promise<void> | void;
  afterUpdate?: (args: AfterUpdateArgs<TRow>) => Promise<void> | void;
  afterDelete?: (args: AfterArgs<TRow>) => Promise<void> | void;
}
