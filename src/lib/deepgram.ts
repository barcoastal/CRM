/**
 * Deepgram pre-recorded transcription. Audio is captured in the CRM dialer tab
 * and uploaded on hang-up; we send the bytes to Deepgram and store the result.
 *
 * Env: DEEPGRAM_API_KEY (per-project key, set in Railway).
 */

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

export function deepgramConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}

export interface DeepgramResult {
  transcript: string;
  summary: string | null;
  confidence: number | null;
  raw: unknown;
}

/** Transcribe an audio buffer (webm/opus from the browser MediaRecorder). */
export async function transcribeAudio(audio: ArrayBuffer, contentType: string): Promise<DeepgramResult> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY not set");

  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
    diarize: "true", // label speakers (agent vs customer)
    utterances: "true",
    summarize: "v2",
  });

  const res = await fetch(`${DEEPGRAM_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": contentType || "audio/webm",
    },
    body: audio,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}: ${t.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    results?: {
      channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }>;
      summary?: { short?: string; result?: string };
    };
  };
  const alt = json?.results?.channels?.[0]?.alternatives?.[0];
  return {
    transcript: alt?.transcript ?? "",
    summary: json?.results?.summary?.short ?? json?.results?.summary?.result ?? null,
    confidence: typeof alt?.confidence === "number" ? alt.confidence : null,
    raw: json,
  };
}
