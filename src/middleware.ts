import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { previewBlocksRequest } from "@/lib/user-preview-policy";

export async function middleware(request: NextRequest) {
  if (previewBlocksRequest(request.method, request.nextUrl.pathname)) {
    const session = await getToken({
      req: request, secret: process.env.NEXTAUTH_SECRET,
      secureCookie: request.cookies.has("__Secure-authjs.session-token") || request.cookies.has("__Secure-authjs.session-token.0"),
    });
    if (session?.viewAs) {
      return NextResponse.json({ error: "View as user is read-only. Return to admin to make changes." }, { status: 403 });
    }
  }
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token.0") ??
    request.cookies.get("__Secure-authjs.session-token.0");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/google-chat/:path*", "/api/:path*", "/dashboards/:path*", "/my-settings/:path*", "/dashboard/:path*", "/leads/:path*", "/accounts/:path*", "/contacts/:path*", "/opportunities/:path*", "/clients/:path*", "/creditors/:path*", "/cases/:path*", "/tasks/:path*", "/events/:path*", "/program-plans/:path*", "/drafts/:path*", "/offers/:path*", "/settlements/:path*", "/fees/:path*", "/emails/:path*", "/sms/:path*", "/email-templates/:path*", "/integrations/:path*", "/dialer/:path*", "/call-center/:path*", "/ai-dialer/:path*", "/campaigns/:path*", "/marketing/:path*", "/sign-docs/:path*", "/envelopes/:path*", "/templates/:path*", "/calls/:path*", "/calculator/:path*", "/reports/:path*", "/settings/:path*"],
};
