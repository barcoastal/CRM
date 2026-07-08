"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Records the agent's call audio in the browser (mic + shared tab audio mixed)
 * and uploads it to /api/dialer/transcribe on hang-up, where Deepgram turns it
 * into a transcript. The agent enables it once per session (a gesture is needed
 * to grant mic + tab-audio permission); after that it auto-records each call.
 */

interface ActiveCall {
  active?: boolean;
  phone?: string;
  customer?: string;
  callType?: string;
  leadId?: string | null;
  onCallSince?: number;
}

interface Transcript {
  id: string;
  transcript?: string | null;
  summary?: string | null;
  durationSec?: number | null;
  createdAt: string;
}

function pickMime(): string {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const m of opts) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

function dir(callType?: string): string {
  if (callType === "INBOUND") return "INBOUND";
  if (callType === "AGENT" || callType === "MANUAL") return "MANUAL";
  return "OUTBOUND";
}

export function CallTranscriber() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [last, setLast] = useState<Transcript | null>(null);
  const [micOnly, setMicOnly] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const mixedRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recCallRef = useRef<{ since: number; meta: ActiveCall; startedAt: number } | null>(null);

  async function enable() {
    setStatus("Requesting microphone and tab audio…");
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      // getDisplayMedia needs video:true to prompt; we keep only its audio.
      let display: MediaStream | null = null;
      try {
        display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        display.getVideoTracks().forEach((t) => t.stop());
      } catch {
        display = null;
      }
      displayStreamRef.current = display;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(mic).connect(dest);
      const hasTabAudio = !!display && display.getAudioTracks().length > 0;
      if (hasTabAudio && display) ctx.createMediaStreamSource(display).connect(dest);
      mixedRef.current = dest.stream;

      setMicOnly(!hasTabAudio);
      setEnabled(true);
      setStatus(
        hasTabAudio
          ? "Transcription on. Each call is recorded and transcribed when it ends."
          : "Transcription on (mic only - no tab audio was shared, so the customer side will be missing)."
      );
    } catch (e) {
      setStatus("Permission denied or unavailable: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function startRecording(meta: ActiveCall) {
    const stream = mixedRef.current;
    if (!stream) return;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const info = recCallRef.current;
      const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
      recCallRef.current = null;
      void upload(blob, info?.meta ?? meta, info ? (Date.now() - info.startedAt) / 1000 : 0);
    };
    recorderRef.current = rec;
    recCallRef.current = { since: meta.onCallSince ?? Date.now(), meta, startedAt: Date.now() };
    rec.start(2000); // periodic chunks so long calls don't buffer in one blob
    setRecording(true);
    setStatus("Recording call…");
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      setStatus("Transcribing…");
      rec.stop();
    }
    recorderRef.current = null;
    setRecording(false);
  }

  async function upload(blob: Blob, meta: ActiveCall, durationSec: number) {
    if (blob.size < 2000) {
      setStatus("Call too short to transcribe.");
      return;
    }
    const qs = new URLSearchParams();
    if (meta.leadId) qs.set("leadId", meta.leadId);
    if (meta.phone) qs.set("phone", meta.phone);
    if (meta.customer) qs.set("customer", meta.customer);
    qs.set("direction", dir(meta.callType));
    qs.set("durationSec", String(Math.round(durationSec)));
    try {
      const res = await fetch(`/api/dialer/transcribe?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (res.status === 503) {
        setStatus("Set DEEPGRAM_API_KEY in Railway to enable transcription.");
        return;
      }
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setStatus("Transcription failed: " + (b?.error ?? res.status));
        return;
      }
      const t = (await res.json()) as Transcript;
      setLast(t);
      setStatus("Transcript ready.");
    } catch (e) {
      setStatus("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Detect call start/end and drive the recorder.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/dialer/active-call");
        if (!res.ok || !alive) return;
        const data = (await res.json()) as ActiveCall;
        const onCall = !!data.active && !!data.onCallSince;
        const rec = recorderRef.current;
        if (onCall && !rec) {
          startRecording(data);
        } else if (onCall && rec && recCallRef.current && data.onCallSince !== recCallRef.current.since) {
          stopRecording(); // a new call started; flush the previous, next tick records the new one
        } else if (!onCall && rec) {
          stopRecording();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#444444", margin: 0 }}>Call Transcript</h2>
        {enabled && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: recording ? "#c23934" : "#2e844a", fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: recording ? "#c23934" : "#2e844a", display: "inline-block" }} />
            {recording ? "Recording" : "Ready"}
          </span>
        )}
      </div>

      {!enabled && (
        <div>
          <button
            type="button"
            onClick={enable}
            style={{ background: "#0176d3", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Enable live transcription
          </button>
          <div style={{ fontSize: 11, color: "#747474", marginTop: 8 }}>
            You will be asked to share this tab with audio (for the customer side) and your microphone (for your side). One time per session.
          </div>
        </div>
      )}

      {status && <div style={{ fontSize: 12, color: "#444444", marginTop: enabled ? 0 : 8 }}>{status}</div>}
      {micOnly && enabled && (
        <div style={{ fontSize: 11, color: "#b06700", marginTop: 4 }}>
          Tip: re-enable and choose &quot;This Tab&quot; with &quot;Share tab audio&quot; checked to capture the customer too.
        </div>
      )}

      {last && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ecebea" }}>
          {last.summary && (
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>Summary: </span>
              {last.summary}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#444444", whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto", lineHeight: 1.5 }}>
            {last.transcript || "(no speech detected)"}
          </div>
        </div>
      )}
    </article>
  );
}
