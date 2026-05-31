import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

// One-shot seed endpoint. Hit:
//   curl -X POST https://crm-production-613a.up.railway.app/api/debug/seed \
//        -H "x-seed-token: $SEED_TOKEN"
// Requires SEED_TOKEN env var to be set on Railway.

export async function POST(req: NextRequest) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "SEED_TOKEN not configured on server" }, { status: 503 });
  }
  const provided = req.headers.get("x-seed-token");
  if (provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const output = execSync("npx tsx prisma/seed.ts 2>&1", {
      env: process.env,
      timeout: 60000,
    }).toString();
    return NextResponse.json({ status: "ok", output });
  } catch (err: unknown) {
    const error = err as { message?: string; stdout?: Buffer; stderr?: Buffer };
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        stdout: error.stdout?.toString(),
        stderr: error.stderr?.toString(),
      },
      { status: 500 }
    );
  }
}
