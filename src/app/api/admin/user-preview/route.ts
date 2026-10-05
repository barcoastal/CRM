import { NextRequest, NextResponse } from "next/server";
import { auth, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  // updateSession skips Auth.js CSRF validation; require same-origin JSON.
  const origin = request.headers.get("origin");
  const appOrigin = new URL(request.url).origin;
  if (origin !== appOrigin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action === "stop") {
    const updated = await updateSession({ viewAsUserId: null } as Parameters<typeof updateSession>[0]);
    if (!updated || updated.impersonation) {
      return NextResponse.json({ error: "Could not return to your account. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ href: "/settings/users" });
  }
  if (session.impersonation || session.user.role !== "ADMIN" || session.user.mustResetPassword) {
    return NextResponse.json({ error: "Only an administrator can view as another user" }, { status: 403 });
  }
  if (body?.action !== "start" || typeof body.userId !== "string" || body.userId.length > 128) {
    return NextResponse.json({ error: "Choose a user to preview" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, isActive: true } });
  if (!target?.isActive || target.id === session.user.id) {
    return NextResponse.json({ error: "Choose another active user" }, { status: 400 });
  }
  const updated = await updateSession({ viewAsUserId: target.id } as Parameters<typeof updateSession>[0]);
  if (updated?.user.id !== target.id || !updated.impersonation) {
    return NextResponse.json({ error: "Could not start the user preview. Please try again." }, { status: 500 });
  }
  const homes = [["Dashboards.View", "/dashboard"], ["Call.Log", "/call-center"], ["Lead.View", "/leads"], ["Account.View", "/accounts"], ["Opportunity.View", "/opportunities"], ["Task.View", "/tasks"]];
  const href = homes.find(([permission]) => hasPermission(updated.user.permissions, permission))?.[1] ?? "/my-settings/personal-information";
  return NextResponse.json({ href });
}
