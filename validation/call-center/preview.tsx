import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { PhoneContext } from "../../src/components/call-center/provider";
import {
  OpenerScreen,
  CloserScreen,
  LiveFloorScreen,
  CallCenterOperationsScreen,
} from "../../src/components/call-center/workspace";
import { SldsShell } from "../../src/components/slds/shell";
import { DockedComposerProvider } from "../../src/components/emails/docked-composer-context";
import { CallAlerts } from "../../src/components/call-center/call-alerts";
import { debtTotal } from "../../src/lib/call-center/qualification";
import { PhonePanel } from "../../src/components/call-center/phone-panel";
import type {
  Overview,
  VoiceCall,
} from "../../src/components/call-center/types";
const now = new Date(),
  earlier = (seconds: number) =>
    new Date(now.getTime() - seconds * 1000).toISOString();
const calls: VoiceCall[] = [
  {
    id: "v1",
    agentId: "me",
    leadId: "l1",
    direction: "OUTBOUND",
    status: "IN_PROGRESS",
    phoneNumber: "+12125550141",
    fromNumber: "+12125550100",
    held: false,
    disposition: null,
    notes: null,
    recordingSid: null,
    createdAt: earlier(241),
    answeredAt: earlier(220),
    endedAt: null,
    workflow: "WEB",
    qualifiedDebt: 175000,
    qualifiedDebts: [
      { key: "d1", id: "d1", creditorName: "OnDeck", amount: 80000 },
      { key: "d2", id: "d2", creditorName: "Bluevine", amount: 60000 },
      { key: "d3", id: "d3", creditorName: "Funding Circle", amount: 35000 },
    ],
    qualifiedAt: earlier(60),
    openerId: "me",
    qualificationNotes:
      "Business owner confirmed $175,000 across three lenders. Daily payments are affecting cash flow. Interested in reviewing settlement options today.",
    salesStage: "QUALIFIED",
    participants: [],
    call: {
      lead: {
        id: "l1",
        contactName: "Michael Johnson",
        businessName: "Summit Construction",
        totalDebtEst: 175000,
        numberOfLenders: 3,
        source: "Google Ads",
        brand: "Coastal Debt",
        sfId: "00Q5f00000DemoLead",
        debts: [
          { id: "d1", creditorName: "OnDeck", amount: 80000 },
          { id: "d2", creditorName: "Bluevine", amount: 60000 },
          { id: "d3", creditorName: "Funding Circle", amount: 35000 },
        ],
      },
    },
  },
  {
    id: "v2",
    agentId: "a2",
    leadId: "l2",
    direction: "INBOUND",
    status: "IN_PROGRESS",
    phoneNumber: "+13105550142",
    fromNumber: "+12125550100",
    held: true,
    disposition: null,
    notes: null,
    recordingSid: null,
    createdAt: earlier(130),
    answeredAt: earlier(100),
    endedAt: null,
    participants: [],
    call: {
      lead: {
        id: "l2",
        contactName: "Sarah Williams",
        businessName: "Coastal Retail Group",
      },
    },
    queue: { name: "Client support" },
  },
  {
    id: "v3",
    agentId: "a3",
    leadId: null,
    direction: "OUTBOUND",
    status: "RINGING",
    phoneNumber: "+16175550143",
    fromNumber: "+12125550100",
    held: false,
    disposition: null,
    notes: null,
    recordingSid: null,
    createdAt: earlier(14),
    answeredAt: null,
    endedAt: null,
    participants: [],
  },
];
for (let i = 0; i < 12; i++)
  calls.push({
    ...calls[0],
    id: `done${i}`,
    agentId: "a2",
    status: "COMPLETED",
    endedAt: earlier(300 + i * 60),
    disposition: "INTERESTED",
    createdAt: earlier(550 + i * 60),
  });
const data: Overview = {
  userId: "me",
  supervisor: true,
  sales: {
    role: "OPENER",
    access: {
      opener: true,
      closer: false,
      floor: false,
      operations: false,
      home: "/call-center/opener",
    },
    config: { tier1Max: 100000, tier2Max: 250000 },
    roster: [
      {
        id: "me",
        name: "Alex Morgan",
        role: "OPENER",
        tier: null,
        state: "ON_CALL",
        fresh: true,
        open: false,
        callId: "v1",
      },
      {
        id: "a1",
        name: "Daniel Carter",
        role: "OPENER",
        tier: null,
        state: "READY",
        fresh: true,
        open: false,
        callId: null,
      },
      {
        id: "a2",
        name: "Emma Wilson",
        role: "CLOSER",
        tier: 2,
        state: "ON_CALL",
        fresh: true,
        open: true,
        callId: "v2",
      },
      {
        id: "a3",
        name: "James Miller",
        role: "OPENER",
        tier: null,
        state: "ON_CALL",
        fresh: true,
        open: false,
        callId: "v3",
      },
      {
        id: "a4",
        name: "Olivia Davis",
        role: "CLOSER",
        tier: 2,
        state: "OPEN",
        fresh: true,
        open: true,
        callId: null,
      },
      {
        id: "a5",
        name: "Noah Brown",
        role: "CLOSER",
        tier: 1,
        state: "OPEN",
        fresh: true,
        open: true,
        callId: null,
      },
      {
        id: "a6",
        name: "Sophia Chen",
        role: "CLOSER",
        tier: 1,
        state: "CLOSED",
        fresh: true,
        open: false,
        callId: null,
      },
      {
        id: "a7",
        name: "Liam Anderson",
        role: "CLOSER",
        tier: 3,
        state: "OPEN",
        fresh: true,
        open: true,
        callId: null,
      },
      {
        id: "a8",
        name: "Mia Thompson",
        role: "CLOSER",
        tier: 3,
        state: "OFFLINE",
        fresh: false,
        open: false,
        callId: null,
      },
    ],
    handoffs: [
      {
        id: "h1",
        createdAt: earlier(900),
        leadId: "sample1",
        clientName: "Jordan Ellis",
        debt: 135000,
        status: "ASSIGNED",
        closerId: "a2",
        fronterId: "a1",
        fronter: { name: "Daniel Carter" },
        closer: { name: "Emma Wilson" },
      },
      {
        id: "h2",
        createdAt: earlier(1800),
        leadId: "sample2",
        clientName: "Taylor Reed",
        debt: 210000,
        status: "CLOSED",
        closerId: "a2",
        fronterId: "me",
        fronter: { name: "Alex Morgan" },
        closer: { name: "Emma Wilson" },
      },
    ],
  },
  outbound: {
    webCounts: { waiting: 2, overdue: 1 },
    canConfigureWeb: true,
    settings: {
      webEnabled: true,
      webMemberIds: ["a1", "a4", "a5"],
      ownerFirst: false,
    },
    webLeads: [
      {
        leadId: "preview-web-1",
        receivedAt: earlier(18),
        deadlineAt: earlier(-42),
        attemptedAt: null,
        status: "WAITING",
        reason: "Waiting for a priority agent",
        lead: { contactName: "Jordan Ellis", businessName: "Ellis Hardware" },
        sla: { seconds: 42, missed: false, attempted: false },
      },
      {
        leadId: "preview-web-2",
        receivedAt: earlier(75),
        deadlineAt: earlier(15),
        attemptedAt: null,
        status: "WAITING",
        reason: "All priority agents are on calls",
        lead: { contactName: "Taylor Reed", businessName: "Reed Landscaping" },
        sla: { seconds: 0, missed: true, attempted: false },
      },
    ],
    coldCampaigns: [
      {
        campaignId: "c1",
        status: "RUNNING",
        maxLines: 10,
        lineScope: "TEAM",
        pauseReason: null,
        campaign: { name: "Cold business leads" },
        attempts: 160,
        answered: 18,
        abandoned: 0,
        inFlight: 10,
      },
    ],
  },
  setup: { enabled: true, ready: true, recording: false },
  me: {
    userId: "me",
    status: "PAUSED",
    activeCallId: null,
    heartbeatAt: earlier(0),
  },
  agents: [
    {
      userId: "me",
      status: "PAUSED",
      activeCallId: null,
      heartbeatAt: earlier(0),
      user: { name: "Alex Morgan" },
    },
    {
      userId: "a1",
      status: "BUSY",
      activeCallId: "v1",
      heartbeatAt: earlier(0),
      user: { name: "Daniel Carter" },
    },
    {
      userId: "a2",
      status: "BUSY",
      activeCallId: "v2",
      heartbeatAt: earlier(0),
      user: { name: "Emma Wilson" },
    },
    {
      userId: "a3",
      status: "BUSY",
      activeCallId: "v3",
      heartbeatAt: earlier(0),
      user: { name: "James Miller" },
    },
    {
      userId: "a4",
      status: "AVAILABLE",
      activeCallId: null,
      heartbeatAt: earlier(0),
      user: { name: "Olivia Davis" },
    },
    {
      userId: "a5",
      status: "AVAILABLE",
      activeCallId: null,
      heartbeatAt: earlier(0),
      user: { name: "Noah Brown" },
    },
  ],
  queues: [
    {
      id: "q1",
      name: "New inquiries",
      phoneNumber: "+1 (212) 555-0100",
      enabled: true,
      greeting: "Thank you for calling Coastal.",
      maxWaitSeconds: 180,
      members: [{ userId: "a1" }, { userId: "a4" }],
      _count: { calls: 2 },
    },
    {
      id: "q2",
      name: "Client support",
      phoneNumber: "+1 (310) 555-0100",
      enabled: true,
      greeting: "Thank you for calling Coastal.",
      maxWaitSeconds: 180,
      members: [{ userId: "a2" }, { userId: "a5" }],
      _count: { calls: 1 },
    },
  ],
  calls,
  campaigns: [
    {
      id: "c1",
      name: "Cold business leads",
      script:
        "Introduce yourself and confirm you are speaking with the business owner.\n\nUnderstand their current obligations, listen to their priorities, and agree on the next step.",
      dialerMode: "POWER",
      _count: { contacts: 128 },
    },
    {
      id: "c2",
      name: "Scheduled callbacks",
      script: null,
      dialerMode: "PREVIEW",
      _count: { contacts: 24 },
    },
  ],
  users: [
    { id: "me", name: "Alex Morgan" },
    { id: "a1", name: "Daniel Carter" },
    { id: "a2", name: "Emma Wilson" },
    { id: "a3", name: "James Miller" },
    { id: "a4", name: "Olivia Davis" },
    { id: "a5", name: "Noah Brown" },
  ],
};
calls[1] = {
  ...calls[1],
  held: false,
  qualifiedDebt: 142000,
  openerId: "a1",
  qualifiedAt: earlier(90),
  salesStage: "CLOSING",
  qualificationNotes:
    "Owner confirmed $142,000 owed to two lenders. Revenue is steady but daily withdrawals are too high. Ready to discuss an affordable payment plan.",
  call: {
    lead: {
      ...calls[1].call!.lead!,
      totalDebtEst: 142000,
      numberOfLenders: 2,
      source: "LIST",
    },
  },
};
const sampleNames = [
  "Jordan Ellis",
  "Taylor Reed",
  "Chris Bennett",
  "Morgan Hayes",
  "Riley Brooks",
];
const sampleBusinesses = [
  "Ellis Hardware",
  "Reed Landscaping",
  "Bennett Logistics",
  "Hayes Auto Care",
  "Brooks Electric",
];
for (const [i, call] of calls.slice(3).entries()) {
  call.answeredAt = earlier(500 + i * 60);
  call.agentId = "me";
  call.openerId = "me";
  call.workflow = i % 2 ? "COLD" : "WEB";
  call.disposition = [
    "INTERESTED",
    "CALLBACK",
    "NO_ANSWER",
    "NOT_QUALIFIED",
    "INTERESTED",
  ][i % 5];
  call.call = {
    lead: {
      ...call.call!.lead!,
      contactName: sampleNames[i % 5],
      businessName: sampleBusinesses[i % 5],
    },
  };
}
data.sales!.roster.push({
  id: "manager",
  name: "Jamie Parker",
  role: "OPENER",
  tier: null,
  state: "PAUSED",
  fresh: true,
  open: false,
  callId: null,
});
function Preview() {
  const view = window.location.pathname.includes("closer.html")
    ? "closer"
    : window.location.pathname.includes("live-floor.html")
      ? "floor"
      : window.location.pathname.includes("manage.html")
        ? "operations"
        : "opener";
  const manager = view === "floor" || view === "operations";
  const storageKey = "crm-approved-handoff-preview-v1";
  const [sampleCall, setSampleState] = useState<VoiceCall>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "null") || calls[0];
    } catch {
      return calls[0];
    }
  });
  function setSampleCall(next: VoiceCall | ((call: VoiceCall) => VoiceCall)) {
    const current =
      JSON.parse(localStorage.getItem(storageKey) || "null") || sampleCall;
    const value = typeof next === "function" ? next(current) : next;
    localStorage.setItem(storageKey, JSON.stringify(value));
    setSampleState(value);
  }
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue)
        setSampleState(JSON.parse(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const [closerOpen, setCloserOpen] = useState(false);
  const roleCloser = view === "closer";
  const selfId = manager ? "manager" : roleCloser ? "a4" : "me";
  const ownCall =
    sampleCall.agentId === selfId ||
    sampleCall.participants.some(
      (person) => person.userId === selfId && !person.endedAt,
    )
      ? sampleCall
      : null;
  const reserved =
    sampleCall.transferTargetId === selfId &&
    sampleCall.salesStage === "CLOSER_READY";
  const shown: Overview = {
    ...data,
    supervisor: manager,
    userId: selfId,
    me: {
      ...data.me!,
      userId: selfId,
      status: reserved ? "RESERVED" : ownCall ? "BUSY" : "PAUSED",
      activeCallId: ownCall?.id || (reserved ? sampleCall.id : null),
      closerOpen: roleCloser && (closerOpen || reserved || !!ownCall),
    },
    calls: [sampleCall, ...calls.slice(1)],
    sales: {
      ...data.sales!,
      role: roleCloser ? "CLOSER" : "OPENER",
      access: {
        opener: !roleCloser,
        closer: roleCloser,
        floor: manager,
        operations: manager,
        home: manager
          ? "/call-center/live-floor"
          : roleCloser
            ? "/call-center/closer"
            : "/call-center/opener",
      },
      roster: data.sales!.roster.map((person) => {
        if (person.id === "me")
          return {
            ...person,
            state: sampleCall.agentId === "me" ? "ON_CALL" : "READY",
            callId: sampleCall.agentId === "me" ? sampleCall.id : null,
          };
        if (person.id === "a4") {
          const onCall =
            sampleCall.agentId === "a4" ||
            sampleCall.participants.some(
              (item) => item.userId === "a4" && !item.endedAt,
            );
          const ready =
            sampleCall.transferTargetId === "a4" &&
            sampleCall.salesStage === "CLOSER_READY";
          return {
            ...person,
            state: onCall
              ? "ON_CALL"
              : ready
                ? "RESERVED"
                : closerOpen
                  ? "OPEN"
                  : "CLOSED",
            open: closerOpen || ready || onCall,
            callId: onCall || ready ? sampleCall.id : null,
          };
        }
        return person;
      }),
    },
  };

  const [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  const preview = async () => {
    setError(
      "Interface preview only. No calls are placed and no CRM records are changed.",
    );
  };
  return (
    <>
      <div
        style={{
          padding: "9px 24px",
          background: "#fff7e8",
          fontFamily: "Arial",
          fontSize: 11,
          color: "#8b6e32",
        }}
      >
        DESIGN PREVIEW · Shared sample workflow across opener, manager & closer
        · No live calls
        <button
          style={{
            marginLeft: 20,
            border: 0,
            background: "none",
            textDecoration: "underline",
            cursor: "pointer",
          }}
          onClick={() => {
            setSampleCall(calls[0]);
            window.location.reload();
          }}
        >
          Reset sample
        </button>
      </div>
      <PhoneContext.Provider
        value={{
          data: shown,
          error,
          setError,
          connected: true,
          connecting: false,
          busy: false,
          incoming: false,
          automatic: !roleCloser && !manager,
          joinOutbound: preview,
          leaveOutbound: preview,
          muted: false,
          open,
          active: ownCall,
          setOpen,
          refresh: async () => {},
          connect: preview,
          offline: preview,
          command: async (body) => {
            if (body.action === "closer-open") setCloserOpen(!!body.open);
            else if (body.action === "qualify")
              setSampleCall((call) => {
                const rows = (
                  body.debts as NonNullable<VoiceCall["qualifiedDebts"]>
                ).map((row) => ({ ...row, id: row.id || row.key }));
                const total = debtTotal(rows);
                return {
                  ...call,
                  qualifiedAt: new Date().toISOString(),
                  qualifiedDebt: total,
                  qualifiedDebts: rows,
                  qualificationNotes: String(body.notes),
                  salesStage: "QUALIFIED",
                  call: {
                    lead: {
                      ...call.call!.lead!,
                      totalDebtEst: total,
                      numberOfLenders: rows.length,
                      debts: rows,
                    },
                  },
                };
              });
            else if (body.action === "request-transfer")
              setSampleCall((call) => ({
                ...call,
                salesStage: "PENDING_APPROVAL",
                transferRequestKey: crypto.randomUUID(),
                transferRequestedAt: new Date().toISOString(),
                transferManagerId: null,
                transferReviewedAt: null,
                transferTargetId: null,
                transferReadyAt: null,
                transferReason: null,
              }));
            else if (body.action === "review-transfer")
              setSampleCall((call) => ({
                ...call,
                salesStage: body.approve
                  ? "PENDING_CLOSER"
                  : "TRANSFER_REJECTED",
                transferManagerId: "manager",
                transferReviewedAt: new Date().toISOString(),
                transferTargetId: body.approve ? String(body.target) : null,
                transferReason: String(body.reason || ""),
              }));
            else if (body.action === "closer-ready")
              setSampleCall((call) => ({
                ...call,
                salesStage: "CLOSER_READY",
                transferReadyAt: new Date().toISOString(),
              }));
            else if (body.action === "qualified-transfer")
              setSampleCall((call) => ({
                ...call,
                held: false,
                salesStage: "TRANSFER_PENDING",
                participants: [
                  {
                    id: "demo-transfer",
                    userId: call.transferTargetId!,
                    role: "TRANSFER",
                    mode: null,
                    callSid: null,
                    joinedAt: new Date().toISOString(),
                    endedAt: null,
                  },
                ],
              }));
            else if (
              ["cancel-transfer", "cancel-transfer-request"].includes(
                String(body.action),
              )
            )
              setSampleCall((call) => ({
                ...call,
                held: false,
                salesStage: "QUALIFIED",
                transferRequestKey: null,
                transferRequestedAt: null,
                transferManagerId: null,
                transferReviewedAt: null,
                transferTargetId: null,
                transferReadyAt: null,
                transferReason: null,
                participants: [],
              }));
            else if (body.action === "complete-transfer")
              setSampleCall((call) => ({
                ...call,
                salesStage: "CLOSING",
                agentId: call.transferTargetId!,
                participants: call.participants.map((person) => ({
                  ...person,
                  role: "AGENT",
                })),
              }));
            else await preview();
            return {};
          },
          dial: preview,
          monitor: preview,
          accept: () => {},
          reject: () => {},
          mute: () => {},
          digits: () => {},
          hangup: preview,
        }}
      >
        <DockedComposerProvider>
          <SldsShell
            userName={
              manager
                ? "Jamie Parker"
                : roleCloser
                  ? "Olivia Davis"
                  : "Alex Morgan"
            }
          >
            {view === "opener" ? (
              <OpenerScreen />
            ) : view === "closer" ? (
              <CloserScreen />
            ) : view === "floor" ? (
              <LiveFloorScreen />
            ) : (
              <CallCenterOperationsScreen />
            )}
          </SldsShell>
        </DockedComposerProvider>
        <CallAlerts />
        <PhonePanel />
      </PhoneContext.Provider>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
