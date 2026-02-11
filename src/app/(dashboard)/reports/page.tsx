import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Briefcase, DollarSign, TrendingDown, AlertTriangle } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  GRADUATED: "bg-blue-100 text-blue-800",
  DROPPED: "bg-red-100 text-red-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
};

export default async function ReportsPage() {
  const [
    clients,
    settledDebts,
    allDebts,
    missedPayments,
  ] = await Promise.all([
    prisma.client.findMany({
      include: {
        lead: { select: { businessName: true, contactName: true } },
        assignedNegotiator: { select: { name: true } },
      },
    }),
    prisma.debt.findMany({
      where: { status: "SETTLED" },
      select: { settledAmount: true, enrolledBalance: true, savingsPercent: true },
    }),
    prisma.debt.findMany({
      select: { enrolledBalance: true, status: true },
    }),
    prisma.payment.count({ where: { status: "MISSED" } }),
  ]);

  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
  const totalSettledAmount = settledDebts.reduce(
    (sum, d) => sum + (d.settledAmount ?? 0),
    0
  );
  const totalEnrolledInSettled = settledDebts.reduce(
    (sum, d) => sum + d.enrolledBalance,
    0
  );
  const avgSavingsPercent =
    settledDebts.length > 0
      ? settledDebts.reduce((sum, d) => sum + (d.savingsPercent ?? 0), 0) / settledDebts.length
      : 0;
  const totalEnrolledDebt = allDebts.reduce(
    (sum, d) => sum + d.enrolledBalance,
    0
  );
  const atRiskClients = clients.filter((c) => c.status === "DROPPED" || c.status === "ON_HOLD").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Settlement metrics and client program overview.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Clients
            </CardTitle>
            <Briefcase className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClients}</div>
            <p className="text-xs text-muted-foreground">
              {clients.length} total enrolled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Settled
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalSettledAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(totalEnrolledInSettled)} enrolled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Savings %
            </CardTitle>
            <TrendingDown className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgSavingsPercent > 0 ? `${avgSavingsPercent.toFixed(1)}%` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {settledDebts.length} debt{settledDebts.length !== 1 ? "s" : ""} settled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              At-Risk Clients
            </CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{atRiskClients}</div>
            <p className="text-xs text-muted-foreground">
              {missedPayments} missed payment{missedPayments !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Settlement Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Debt Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Total Enrolled Debt", value: formatCurrency(totalEnrolledDebt) },
                { label: "Total Settled", value: formatCurrency(totalSettledAmount) },
                { label: "Total Savings", value: formatCurrency(totalEnrolledInSettled - totalSettledAmount) },
                { label: "Debts Settled", value: `${settledDebts.length} of ${allDebts.length}` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Client List */}
        <Card>
          <CardHeader>
            <CardTitle>Client Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="text-right">Settled</TableHead>
                    <TableHead>Negotiator</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.lead.businessName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${STATUS_COLORS[client.status] || ""}`}
                        >
                          {client.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(client.totalEnrolledDebt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(client.totalSettled)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.assignedNegotiator?.name || "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No clients enrolled yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
