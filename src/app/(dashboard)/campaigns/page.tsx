import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export default async function CampaignsPage() {
  await auth();

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          contacts: true,
          agents: true,
        },
      },
      contacts: {
        select: {
          status: true,
        },
      },
    },
  });

  const campaignsWithStats = campaigns.map((campaign) => {
    const dialed = campaign.contacts.filter(
      (c) => c.status !== "PENDING"
    ).length;
    const connected = campaign.contacts.filter(
      (c) => c.status === "COMPLETED"
    ).length;
    const enrolled = campaign.contacts.filter(
      (c) => c.status === "COMPLETED"
    ).length;
    const connectedPercent =
      dialed > 0 ? Math.round((connected / dialed) * 100) : 0;

    return {
      ...campaign,
      dialed,
      connected,
      enrolled,
      connectedPercent,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Manage your dialing campaigns and track progress.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="size-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dialer Mode</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead className="text-right">Dialed</TableHead>
              <TableHead className="text-right">Connected %</TableHead>
              <TableHead className="text-right">Enrolled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaignsWithStats.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No campaigns yet. Create your first campaign to get started.
                </TableCell>
              </TableRow>
            ) : (
              campaignsWithStats.map((campaign) => (
                <TableRow key={campaign.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_COLORS[campaign.status] || ""}
                      variant="secondary"
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{campaign.dialerMode}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign._count.contacts}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.dialed}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.connectedPercent}%
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.enrolled}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
