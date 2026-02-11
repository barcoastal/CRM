"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutGrid, TableProperties } from "lucide-react";

export function LeadViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "table";

  const toggle = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        variant={currentView === "table" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => toggle("table")}
        className="h-7 gap-1.5 px-2.5"
      >
        <TableProperties className="size-3.5" />
        Table
      </Button>
      <Button
        variant={currentView === "pipeline" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => toggle("pipeline")}
        className="h-7 gap-1.5 px-2.5"
      >
        <LayoutGrid className="size-3.5" />
        Pipeline
      </Button>
    </div>
  );
}
