import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/calendar/team-members
 *
 * Returns the current user plus their direct reports. Used by the calendar
 * toolbar to populate the "My Team" quick-select. If the user is not a
 * manager (no reports), only `self` is returned and `reports` is empty.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selfId = session.user.id;

  const [self, reports] = await Promise.all([
    prisma.user.findUnique({
      where: { id: selfId },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findMany({
      where: { managerId: selfId, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!self) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    self: { id: self.id, name: self.name, email: self.email },
    reports: reports.map((r) => ({ id: r.id, name: r.name, email: r.email })),
  });
}
