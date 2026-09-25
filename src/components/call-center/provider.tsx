"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import type { DialInput, Overview, VoiceCall } from "./types";
import { CallAlerts } from "./call-alerts";
import { PhonePanel } from "./phone-panel";
import "./styles.css";

interface PhoneContext {
  data: Overview | null;
  error: string;
  setError: (error: string) => void;
  connected: boolean;
  connecting: boolean;
  busy: boolean;
  incoming: boolean;
  automatic: boolean;
  joinOutbound: () => Promise<void>;
  leaveOutbound: () => Promise<void>;
  muted: boolean;
  open: boolean;
  active: VoiceCall | null;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  offline: () => Promise<void>;
  command: (body: Record<string, unknown>) => Promise<{
    token?: string;
    call?: VoiceCall;
    ok?: boolean;
    standbyKey?: string;
  }>;
  dial: (input: DialInput) => Promise<void>;
  monitor: (id: string, mode: string) => Promise<void>;
  accept: () => void;
  reject: () => void;
  mute: () => void;
  digits: (value: string) => void;
  hangup: () => Promise<void>;
}
export const PhoneContext = createContext<PhoneContext | null>(null);
export const useOptionalPhone = () => useContext(PhoneContext);
export function usePhone() {
  const context = useOptionalPhone();
  if (!context) throw new Error("Phone provider is missing");
  return context;
}
export function CallCenterProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState("");
  const [connected, setConnected] = useState(false),
    [connecting, setConnecting] = useState(false),
    [busy, setBusy] = useState(false);
  const [incoming, setIncoming] = useState(false),
    [automatic, setAutomatic] = useState(false),
    [muted, setMuted] = useState(false),
    [open, setOpen] = useState(false);
  const device = useRef<Device | null>(null),
    leg = useRef<Call | null>(null),
    unlock = useRef<(() => void) | null>(null),
    dialing = useRef(false);
  const seatKey = useRef<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const active =
    data?.calls.find(
      (c) =>
        c.id === data.me?.activeCallId &&
        (c.agentId === data.userId ||
          c.participants.some(
            (person) => person.userId === data?.userId && !person.endedAt,
          )),
    ) || null;
  const command = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/call-center", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(json.error || "The call center request failed.");
    return json;
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/call-center", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok)
      throw new Error(json.error || "Unable to load call center.");
    setData(json);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(
      () => {
        void refresh().catch((e) => setError(e.message));
      },
      automatic ? 1000 : 5000,
    );
    return () => clearInterval(timer);
  }, [refresh, automatic]);
  // Marking open authorizes this one approved call; match the actual SDK call SID before auto-answering.
  useEffect(() => {
    if (
      !incoming ||
      !active ||
      active.transferTargetId !== data?.userId ||
      !active.transferReadyAt ||
      active.salesStage !== "TRANSFER_PENDING"
    )
      return;
    const sid = leg.current?.parameters.CallSid;
    if (
      sid &&
      active.participants.some(
        (person) =>
          person.userId === data?.userId &&
          person.role === "TRANSFER" &&
          person.callSid === sid &&
          !person.endedAt,
      )
    )
      leg.current?.accept();
  }, [active, data?.userId, incoming]);
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {
      void command({ action: "heartbeat" }).catch((e) => setError(e.message));
    }, 15000);
    return () => clearInterval(timer);
  }, [connected, command]);
  useEffect(
    () => () => {
      device.current?.destroy();
      unlock.current?.();
    },
    [],
  );
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (leg.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);
  function track(call: Call) {
    leg.current = call;
    setMuted(false);
    call.on("disconnect", () => {
      if (leg.current === call) {
        leg.current = null;
        setIncoming(false);
        setMuted(false);
        const key = seatKey.current;
        seatKey.current = null;
        setAutomatic(false);
        if (key)
          void command({ action: "seat-lost", key }).catch((e) =>
            setError(e.message),
          );
      }
      void refresh().catch((e) => setError(e.message));
    });
    call.on("cancel", () => {
      if (leg.current === call) {
        leg.current = null;
        setIncoming(false);
      }
      void refresh().catch((e) => setError(e.message));
    });
    call.on("reject", () => {
      if (leg.current === call) {
        leg.current = null;
        setIncoming(false);
      }
    });
    call.on("error", (e) => {
      setError(e.message);
      void refresh().catch(() => {});
    });
    call.on("accept", () => {
      setIncoming(false);
      void refresh().catch(() => {});
    });
  }
  async function connect() {
    if (connected || connecting) return;
    const reconnecting = !!device.current;
    setConnecting(true);
    setError("");
    setOpen(true);
    try {
      if (!enabled)
        throw new Error(
          "An administrator must enable the Twilio call center first.",
        );
      if (device.current) {
        const access = await command({ action: "token" });
        if (!access.token) throw new Error("Missing phone access token");
        device.current.updateToken(access.token);
        await device.current.register();
        await command({ action: "heartbeat", status: "PAUSED" });
        setConnected(true);
        await refresh();
        return;
      }
      if (!navigator.locks)
        throw new Error(
          "Use a current Chrome or Edge browser for the CRM phone.",
        );
      await new Promise<void>((resolve, reject) => {
        void navigator.locks
          .request("crm-browser-phone", { ifAvailable: true }, async (lock) => {
            if (!lock) {
              reject(
                new Error("The CRM phone is already connected in another tab."),
              );
              return;
            }
            await new Promise<void>((release) => {
              unlock.current = release;
              resolve();
            });
          })
          .catch(reject);
      });
      const token = await command({ action: "token" });
      if (!token.token) throw new Error("Missing phone access token");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const { Device } = await import("@twilio/voice-sdk");
      const phone = new Device(token.token, {
        closeProtection: true,
        tokenRefreshMs: 60000,
      });
      device.current = phone;
      phone.on("tokenWillExpire", () => {
        void command({ action: "token" })
          .then((t) => {
            if (t.token) phone.updateToken(t.token);
          })
          .catch((e) => setError(e.message));
      });
      phone.on("error", (e) => setError(e.message));
      phone.on("unregistered", () => {
        setConnected(false);
        void command({ action: "heartbeat", status: "OFFLINE" }).catch(
          () => {},
        );
      });
      phone.on("incoming", (call) => {
        if (leg.current) {
          call.reject();
          return;
        }
        track(call);
        setIncoming(true);
        setOpen(true);
        void refresh().catch(() => {});
      });
      await phone.register();
      if (!dataRef.current?.me?.activeCallId)
        await command({ action: "leave-outbound" });
      await command({ action: "heartbeat", status: "PAUSED" });
      setConnected(true);
      await refresh();
    } catch (e) {
      if (!reconnecting) {
        device.current?.destroy();
        device.current = null;
        unlock.current?.();
        unlock.current = null;
      }
      setError(e instanceof Error ? e.message : "Unable to connect phone");
    } finally {
      setConnecting(false);
    }
  }
  async function offline() {
    if (seatKey.current && !dataRef.current?.me?.activeCallId)
      await leaveOutbound();
    if (leg.current || dataRef.current?.me?.activeCallId)
      throw new Error("Finish the call and save its outcome first.");
    await command({ action: "heartbeat", status: "OFFLINE" });
    device.current?.destroy();
    device.current = null;
    unlock.current?.();
    unlock.current = null;
    setConnected(false);
    await refresh();
  }
  async function joinOutbound() {
    if (
      !device.current ||
      !connected ||
      leg.current ||
      dialing.current ||
      dataRef.current?.me?.activeCallId
    )
      throw new Error("Connect your phone and finish the current call first.");
    dialing.current = true;
    setBusy(true);
    try {
      const result = await command({ action: "join-outbound" });
      if (!result.standbyKey)
        throw new Error("Could not open automatic dialing");
      seatKey.current = result.standbyKey;
      track(
        await device.current.connect({
          params: { OutboundSeat: result.standbyKey },
        }),
      );
      setAutomatic(true);
      setOpen(true);
      await refresh();
    } catch (e) {
      if (seatKey.current)
        await command({ action: "leave-outbound", key: seatKey.current }).catch(
          () => {},
        );
      seatKey.current = null;
      throw e;
    } finally {
      dialing.current = false;
      setBusy(false);
    }
  }
  async function leaveOutbound() {
    await command({
      action: "leave-outbound",
      key: seatKey.current || undefined,
    });
    seatKey.current = null;
    setAutomatic(false);
    leg.current?.disconnect();
    await refresh();
  }
  async function start(
    input: DialInput | { id: string; mode: string },
    monitor: boolean,
  ) {
    if (!device.current || !connected) {
      setOpen(true);
      throw new Error("Connect your phone before placing a call.");
    }
    if (dialing.current || leg.current || dataRef.current?.me?.activeCallId)
      throw new Error("Finish your current call first.");
    dialing.current = true;
    setBusy(true);
    setError("");
    setOpen(true);
    let id: string | undefined;
    try {
      const response = await command({
        action: monitor ? "monitor" : "dial",
        ...input,
      });
      if (!response.call) throw new Error("Call was not created");
      id = response.call.id;
      await refresh();
      track(await device.current.connect({ params: { VoiceCallId: id! } }));
    } catch (e) {
      if (id)
        await command({ action: monitor ? "leave" : "hangup", id }).catch(
          () => {},
        );
      throw e;
    } finally {
      dialing.current = false;
      setBusy(false);
      await refresh().catch(() => {});
    }
  }
  async function hangup() {
    if (active && active.agentId === data?.userId)
      await command({ action: "hangup", id: active.id });
    else if (active) await command({ action: "leave", id: active.id });
    if (!seatKey.current) leg.current?.disconnect();
    await refresh();
  }
  return (
    <PhoneContext.Provider
      value={{
        data,
        error,
        setError,
        connected,
        connecting,
        busy,
        incoming,
        automatic,
        joinOutbound,
        leaveOutbound,
        muted,
        open,
        active,
        setOpen,
        refresh,
        command,
        connect,
        offline,
        dial: (input) => start(input, false),
        monitor: (id, mode) => start({ id, mode }, true),
        accept: () => leg.current?.accept(),
        reject: () => {
          leg.current?.reject();
          setIncoming(false);
        },
        mute: () => {
          const value = !muted;
          leg.current?.mute(value);
          setMuted(value);
        },
        digits: (value) => leg.current?.sendDigits(value),
        hangup,
      }}
    >
      {children}
      <CallAlerts />
      <PhonePanel />
    </PhoneContext.Provider>
  );
}
