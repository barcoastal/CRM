import { prisma } from "@/lib/prisma";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogArgs {
  source: string;
  message: string;
  payload?: Record<string, unknown>;
  userId?: string | null;
}

async function write(level: LogLevel, args: LogArgs) {
  // Mirror to console for Railway log stream
  const line = `[${level}] ${args.source}: ${args.message}`;
  if (level === "ERROR") console.error(line, args.payload ?? "");
  else if (level === "WARN") console.warn(line, args.payload ?? "");
  else console.log(line, args.payload ?? "");

  try {
    await prisma.applicationLog.create({
      data: {
        level,
        source: args.source,
        message: args.message,
        ...(args.payload ? { payload: args.payload as object } : {}),
        ...(args.userId ? { userId: args.userId } : {}),
      },
    });
  } catch {
    // Never let logging crash the app. Console already has the line.
  }
}

export const logDebug = (args: LogArgs) => write("DEBUG", args);
export const logInfo = (args: LogArgs) => write("INFO", args);
export const logWarn = (args: LogArgs) => write("WARN", args);
export const logError = (args: LogArgs) => write("ERROR", args);
