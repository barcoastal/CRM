import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { googleAuthorizationUrl } from "@/lib/google-calendar/client";

export async function GET() {
  const auth = await requireAuthOrRespond("Integration.Manage");
  if ("response" in auth) return auth.response;
  return NextResponse.redirect(googleAuthorizationUrl(auth.session.userId));
}
