import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  const where: Record<string, unknown> = { isActive: true };

  const role = searchParams.get("role");
  if (role) {
    where.role = role;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}
