"use client";

import { useState } from "react";
import { Five9Client } from "@/app/(dashboard)/dialer/five9-client";
import { Five9ToolkitBridge } from "@/components/dialer/five9-toolkit-bridge";

export function Five9ToolkitPilot({ userId, expectedFive9Login }: {
  userId: string;
  expectedFive9Login: string;
}) {
  const [call, setCall] = useState<{ id: string; phone: string | null } | null>(null);

  return <main style={{ minHeight: "100vh", background: "#f3f5f8", color: "#181818" }}>
    <header style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #d8dde6" }}>
      <strong>Coastal CRM · Five9 pilot</strong>
    </header>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) minmax(500px, 1fr)", gap: 12, padding: 12 }}>
      <section aria-label="Five9 call controls">
        <Five9ToolkitBridge expectedFive9Login={expectedFive9Login}
          onCallStarted={(id, phone) => setCall(current => ({ id, phone: phone ?? (current?.id === id ? current.phone : null) }))}
          onCallFinished={id => setCall(current => current?.id === id ? null : current)} />
      </section>
      <section aria-label="CRM lead workspace">
        <Five9Client key={call?.id ?? "waiting"} five9Domain={null} defaultStation={null}
          frameOnly initialPhone={call?.phone ?? null} userId={userId} />
      </section>
    </div>
  </main>;
}
