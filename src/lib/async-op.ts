import { prisma } from "@/lib/prisma";

export type AsyncOpStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export async function createAsyncOp(type: string, payload?: Record<string, unknown>) {
  return prisma.asyncOperation.create({
    data: { type, status: "PENDING", ...(payload ? { payload: payload as object } : {}) },
  });
}

export async function startAsyncOp(id: string) {
  return prisma.asyncOperation.update({
    where: { id },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function completeAsyncOp(id: string, result?: Record<string, unknown>) {
  return prisma.asyncOperation.update({
    where: { id },
    data: { status: "COMPLETED", ...(result ? { result: result as object } : {}), finishedAt: new Date() },
  });
}

export async function failAsyncOp(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return prisma.asyncOperation.update({
    where: { id },
    data: { status: "FAILED", error: message, finishedAt: new Date() },
  });
}

/**
 * Wrap a workload in async-op tracking. Records start, success result, or failure with error.
 * Returns the workload's value.
 */
export async function runAsAsyncOp<T>(
  type: string,
  payload: Record<string, unknown> | undefined,
  workload: (opId: string) => Promise<T>,
): Promise<T> {
  const op = await createAsyncOp(type, payload);
  await startAsyncOp(op.id);
  try {
    const result = await workload(op.id);
    await completeAsyncOp(op.id, typeof result === "object" && result !== null ? (result as Record<string, unknown>) : undefined);
    return result;
  } catch (e) {
    await failAsyncOp(op.id, e);
    throw e;
  }
}
