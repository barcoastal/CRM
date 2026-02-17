import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    const output = execSync(
      "npx prisma db push --accept-data-loss 2>&1",
      {
        env: process.env,
        timeout: 30000,
      }
    ).toString();

    return NextResponse.json({ status: "ok", output });
  } catch (err: unknown) {
    const error = err as { message?: string; stdout?: Buffer; stderr?: Buffer };
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        stdout: error.stdout?.toString(),
        stderr: error.stderr?.toString(),
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
      },
      { status: 500 }
    );
  }
}
