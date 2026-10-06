"use client";

import { useEffect, useState } from "react";
import { Five9Client } from "@/app/(dashboard)/dialer/five9-client";

const SDK_URL = "https://cdn.prod.us.five9.net/stable/crm-sdk-lib/five9.crm.sdk.js";
const TOOLKIT_URL = "https://app-atl.five9.com/clients/integrations/adt.main.html";

type CallData = {
  interactionId?: string;
  agent?: string;
  number?: string;
  ani?: string;
  dnis?: string;
  callType?: string;
};
type ContactField = { name?: string; value?: string | number };
type InteractionApi = {
  subscribe: (handlers: Record<string, (params: { callData?: CallData }) => void>) => void;
  getCrm: (params: { interactionId: string }) => Promise<ContactField[]>;
};
declare global {
  interface Window {
    Five9?: { CrmSdk?: { interactionApi: () => InteractionApi } };
    coastalFive9PilotSubscribed?: boolean;
    coastalFive9PilotListener?: (event: "start" | "finish", call: CallData, phone?: string) => void;
  }
}

function cleanPhone(value?: string | number): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

function callPhone(call: CallData): string | null {
  // On outbound calls ANI is our caller ID; `number` is the dialed contact.
  return cleanPhone(call.number) ??
    (call.callType === "INBOUND" ? cleanPhone(call.ani) : null);
}

function subscribeToFive9() {
  if (window.coastalFive9PilotSubscribed) return;
  const api = window.Five9?.CrmSdk?.interactionApi();
  if (!api) throw new Error("Five9 CRM SDK did not initialize");
  const started = ({ callData }: { callData?: CallData }) => {
    if (!callData) return;
    const phone = callPhone(callData);
    window.coastalFive9PilotListener?.("start", callData, phone ?? undefined);
    if (phone || !callData.interactionId) return;
    void api.getCrm({ interactionId: callData.interactionId }).then(fields => {
      const primary = fields.find(field => field.name?.toLowerCase() === "number1");
      const found = cleanPhone(primary?.value);
      if (found) window.coastalFive9PilotListener?.("start", callData, found);
    }).catch(() => { /* Manual phone search remains available. */ });
  };
  api.subscribe({
    callStarted: started,
    callAccepted: started,
    callFinished: ({ callData }) => {
      if (callData) window.coastalFive9PilotListener?.("finish", callData);
    },
  });
  window.coastalFive9PilotSubscribed = true;
}

export function Five9ToolkitPilot({ userId, expectedFive9Login }: {
  userId: string;
  expectedFive9Login: string;
}) {
  const [sdkState, setSdkState] = useState<"loading" | "ready" | "error">("loading");
  const [call, setCall] = useState<{ id: string; phone: string | null } | null>(null);
  const [message, setMessage] = useState("Waiting for a Five9 call");

  useEffect(() => {
    window.coastalFive9PilotListener = (event, data, phone) => {
      if (expectedFive9Login && data.agent &&
          data.agent.toLowerCase() !== expectedFive9Login.toLowerCase()) {
        setMessage("The Five9 login does not match this CRM account.");
        return;
      }
      if (event === "finish") {
        setCall(current => current?.id === data.interactionId ? null : current);
        setMessage("Call finished. Waiting for the next call");
        return;
      }
      const id = data.interactionId ?? data.number ?? "current";
      setCall(current => ({ id, phone: phone ?? (current?.id === id ? current.phone : null) }));
      setMessage(phone ? "CRM lead lookup started" : "Call detected. Search by phone if no number is available.");
    };

    const ready = () => {
      try { subscribeToFive9(); setSdkState("ready"); }
      catch { setSdkState("error"); }
    };
    if (window.Five9?.CrmSdk) ready();
    else {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = ready;
      script.onerror = () => setSdkState("error");
      document.head.appendChild(script);
    }
    return () => { window.coastalFive9PilotListener = undefined; };
  }, [expectedFive9Login]);

  return <main style={{ minHeight: "100vh", background: "#f3f5f8", color: "#181818" }}>
    <header style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #d8dde6" }}>
      <strong>Coastal CRM · Five9 pilot</strong>
      <span style={{ marginLeft: 16, color: "#64748b", fontSize: 13 }}>{message}</span>
    </header>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) minmax(500px, 1fr)", gap: 12, padding: 12 }}>
      <section aria-label="Five9 call controls" style={{ minHeight: "calc(100vh - 80px)", background: "#fff", border: "1px solid #d8dde6", borderRadius: 8 }}>
        {sdkState === "ready" ? <iframe
          src={TOOLKIT_URL}
          title="Five9 Agent Desktop Toolkit"
          allow="microphone; autoplay; clipboard-read; clipboard-write"
          style={{ width: "100%", height: "calc(100vh - 82px)", minHeight: 650, border: 0, borderRadius: 8 }}
        /> : <p style={{ padding: 16 }}>{sdkState === "error" ? "Five9 SDK failed to load. Refresh this page." : "Loading Five9…"}</p>}
      </section>
      <section aria-label="CRM lead workspace">
        <Five9Client key={call?.id ?? "waiting"} five9Domain={null} defaultStation={null}
          frameOnly initialPhone={call?.phone ?? null} userId={userId} />
      </section>
    </div>
  </main>;
}
