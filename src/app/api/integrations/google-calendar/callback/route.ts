import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { exchangeGoogleCode, saveGoogleConnection, verifyGoogleOAuthState } from "@/lib/google-calendar/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuthOrRespond("Integration.Manage");
  if ("response" in auth) return auth.response;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const verified = state ? verifyGoogleOAuthState(state) : null;
  if (!code || !verified || verified.userId !== auth.session.userId) {
    return NextResponse.json({ error: "Invalid or expired Google OAuth response" }, { status: 400 });
  }
  try {
    const tokens = await exchangeGoogleCode(code);
    await saveGoogleConnection({ ...tokens, userId: auth.session.userId });
    return NextResponse.redirect(new URL("/integrations?google=connected", request.url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google connection failed" }, { status: 502 });
  }
}
