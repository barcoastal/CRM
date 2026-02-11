import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const agentId = searchParams.get("agentId");
  const disposition = searchParams.get("disposition");
  const campaignId = searchParams.get("campaignId");
  const direction = searchParams.get("direction");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");

  const userRole = session.user.role;
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";

  // Build where clause
  const where: Record<string, unknown> = {};

  // Non-managers only see their own calls
  if (!isManagerOrAdmin) {
    where.agentId = session.user.id;
  } else if (agentId) {
    where.agentId = agentId;
  }

  if (disposition) {
    where.disposition = disposition;
  }

  if (campaignId) {
    where.campaignId = campaignId;
  }

  if (direction) {
    where.direction = direction;
  }

  if (dateFrom || dateTo) {
    where.startedAt = {};
    if (dateFrom) {
      (where.startedAt as Record<string, unknown>).gte = new Date(dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.startedAt as Record<string, unknown>).lte = end;
    }
  }

  if (search) {
    where.lead = {
      businessName: { contains: search },
    };
  }

  try {
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          lead: {
            select: { id: true, businessName: true, contactName: true, phone: true },
          },
          agent: { select: { id: true, name: true } },
          feedback: { select: { overallScore: true } },
        },
      }),
      prisma.call.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      calls,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("Calls list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
