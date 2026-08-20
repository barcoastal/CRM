import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // SF_SYNC=1 (set only by the mini's SF sync scripts) tightens pool timeouts
  // so a dropped connection to the Railway DB proxy fails fast and the pool
  // reconnects, instead of hanging forever mid-backfill. keepAlive helps detect
  // dead sockets and is safe for the live app too.
  const syncMode = process.env.SF_SYNC === "1";
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    keepAlive: true,
    ...(syncMode
      ? {
          connectionTimeoutMillis: 30_000,
          idleTimeoutMillis: 30_000,
          query_timeout: 120_000,
          statement_timeout: 120_000,
          max: 5,
        }
      : {}),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
