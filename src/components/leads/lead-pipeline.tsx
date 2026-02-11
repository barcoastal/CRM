"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge, formatCurrency } from "@/components/leads/lead-table";

const PIPELINE_COLUMNS = [
  { status: "NEW", label: "New", color: "bg-blue-500" },
  { status: "CONTACTED", label: "Contacted", color: "bg-purple-500" },
  { status: "QUALIFIED", label: "Qualified", color: "bg-green-500" },
  { status: "CALLBACK", label: "Callback", color: "bg-yellow-500" },
  { status: "ENROLLED", label: "Enrolled", color: "bg-emerald-500" },
] as const;

interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  totalDebtEst: number | null;
  score: number | null;
  status: string;
}

interface LeadPipelineProps {
  leads: Lead[];
}

function PipelineCard({ lead }: { lead: Lead }) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md py-3"
      onClick={() => router.push(`/leads/${lead.id}`)}
    >
      <CardContent className="px-3 py-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{lead.businessName}</p>
          <ScoreBadge score={lead.score} />
        </div>
        <p className="text-xs text-muted-foreground">{lead.contactName}</p>
        {lead.totalDebtEst !== null && (
          <p className="text-xs font-medium text-muted-foreground">
            {formatCurrency(lead.totalDebtEst)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadPipeline({ leads }: LeadPipelineProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((column) => {
        const columnLeads = leads.filter((l) => l.status === column.status);
        return (
          <div
            key={column.status}
            className="flex-shrink-0 w-[280px]"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={`size-2.5 rounded-full ${column.color}`} />
              <h3 className="text-sm font-semibold">{column.label}</h3>
              <Badge variant="secondary" className="text-xs ml-auto">
                {columnLeads.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[200px] rounded-lg bg-muted/30 p-2">
              {columnLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No leads
                </p>
              ) : (
                columnLeads.map((lead) => (
                  <PipelineCard key={lead.id} lead={lead} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
