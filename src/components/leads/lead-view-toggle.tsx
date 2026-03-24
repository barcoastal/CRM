"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
    <div
      className="flex overflow-hidden rounded-[4px]"
      style={{ background: "#eaedff" }}
    >
      {(
        [
          { key: "table", label: "Table", Icon: TableProperties },
          { key: "pipeline", label: "Pipeline", Icon: LayoutGrid },
        ] as const
      ).map(({ key, label, Icon }) => {
        const isActive = currentView === key;
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-0 cursor-pointer transition-all"
            style={{
              background: isActive ? "#ffffff" : "transparent",
              color: isActive ? "#3052FF" : "#444656",
              fontWeight: isActive ? 600 : 500,
              boxShadow: isActive ? "0 1px 4px rgba(19,27,46,0.08)" : "none",
              fontFamily: "inherit",
            }}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
