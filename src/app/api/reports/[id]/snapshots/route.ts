import { NextRequest } from "next/server";
import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { prisma } from "@/lib/prisma";
import { canReadSnapshot, summaryCsv, type SavedSnapshot } from "@/lib/reports/snapshots";
import { reportCsv } from "@/lib/reports/csv";
import { Prisma } from "@/generated/prisma/client";
export async function GET(req: NextRequest, ctx: {params:Promise<{id:string}>}) {
  const gate = await analyticsApiAccess("Reports.Export"); if ("response" in gate) return gate.response;
  const { id } = await ctx.params;
  const report = await prisma.report.findFirst({where:{id,AND:[definitionScope(gate.access)]},select:{id:true}});
  if (!report) return Response.json({error:"Report not found"},{status:404});
  const deliveryId = req.nextUrl.searchParams.get("deliveryId");
  const where = { subscription:{reportId:id,userId:gate.access.userId}, snapshot:{not:Prisma.DbNull} };
  if (!deliveryId) return Response.json({items:await prisma.reportDelivery.findMany({where,orderBy:{createdAt:"desc"},take:30,select:{id:true,createdAt:true,status:true}})});
  const delivery = await prisma.reportDelivery.findFirst({where:{...where,id:deliveryId}});
  if (!delivery?.snapshot) return Response.json({error:"Snapshot not found"},{status:404});
  const snapshot = delivery.snapshot as unknown as SavedSnapshot;
  if (!await canReadSnapshot(snapshot,gate.access.userId)) return Response.json({error:"Record access or matching records changed. Open the live report for current results."},{status:403});
  const details = req.nextUrl.searchParams.get("format") === "details";
  return new Response("\uFEFF"+(details?reportCsv(snapshot.result):summaryCsv(snapshot.result)),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="report-${details?"details":"summary"}-${delivery.createdAt.toISOString().slice(0,10)}.csv"`,"Cache-Control":"no-store"}});
}
