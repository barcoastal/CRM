"use client";

import { useEffect, useRef, useState } from "react";

const SDK_URL = "https://cdn.prod.us.five9.net/stable/crm-sdk-lib/five9.crm.sdk.js";
const TOOLKIT_URL = "https://app-atl.five9.com/clients/integrations/adt.main.html";

type CallData = {
  interactionId?: string;
  agent?: string;
  number?: string;
  ani?: string;
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
  // ANI is the caller ID on outbound calls; `number` is the dialed contact.
  return cleanPhone(call.number) ?? (call.callType === "INBOUND" ? cleanPhone(call.ani) : null);
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
    }).catch(() => { /* The phone search remains available. */ });
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

export function Five9ToolkitBridge({ expectedFive9Login, onCallStarted, onCallFinished }: {
  expectedFive9Login: string;
  onCallStarted: (callId: string, phone: string | null) => void;
  onCallFinished: (callId: string) => void;
}) {
  const [sdkState, setSdkState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Waiting for a Five9 call");
  const handlers = useRef({ onCallStarted, onCallFinished });
  useEffect(() => { handlers.current = { onCallStarted, onCallFinished }; }, [onCallStarted, onCallFinished]);

  useEffect(() => {
    const listener: NonNullable<Window["coastalFive9PilotListener"]> = (event, data, phone) => {
      if (expectedFive9Login && data.agent &&
          data.agent.toLowerCase() !== expectedFive9Login.toLowerCase()) {
        setMessage("The Five9 login does not match this CRM account.");
        return;
      }
      const callId = data.interactionId ?? data.number ?? "current";
      if (event === "finish") {
        handlers.current.onCallFinished(callId);
        setMessage("Call finished. Waiting for the next call");
      } else {
        handlers.current.onCallStarted(callId, phone ?? null);
        setMessage(phone ? "Looking up the CRM lead" : "Call detected. Search by phone if no number is available.");
      }
    };
    window.coastalFive9PilotListener = listener;

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
    return () => {
      if (window.coastalFive9PilotListener === listener) window.coastalFive9PilotListener = undefined;
    };
  }, [expectedFive9Login]);

  return <div style={{ height: "calc(100vh - 170px)", minHeight: 600, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 }}>
    <div role="status" style={{ padding: "8px 12px", color: "#64748b", fontSize: 12, borderBottom: "1px solid #d8dde6" }}>{message}</div>
    {sdkState === "ready" ? <iframe
      src={TOOLKIT_URL}
      title="Five9 Agent Desktop Toolkit"
      allow="microphone; autoplay; clipboard-read; clipboard-write"
      style={{ width: "100%", height: "calc(100% - 35px)", border: 0 }}
    /> : <p style={{ padding: 16 }}>{sdkState === "error" ? "Five9 could not load. Refresh this page." : "Loading Five9…"}</p>}
  </div>;
}
