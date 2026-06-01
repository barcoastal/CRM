import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*", "/accounts/:path*", "/contacts/:path*", "/opportunities/:path*", "/clients/:path*", "/creditors/:path*", "/dialer/:path*", "/campaigns/:path*", "/calls/:path*", "/calculator/:path*", "/reports/:path*", "/settings/:path*"],
};
