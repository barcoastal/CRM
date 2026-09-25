import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import twilio from "twilio";
import {
  identity,
  userFromIdentity,
  phoneNumber,
  nextCallStatus,
  canSupervise,
} from "@/lib/call-center/model";
import {
  configuration,
  conferenceXml,
  signedPayload,
  tokenFor,
} from "@/lib/call-center/twilio";
const account = `AC${"1".repeat(32)}`;
beforeEach(() => {
  Object.entries({
    CRM_DIALER_MODE: "twilio",
    TWILIO_ACCOUNT_SID: account,
    TWILIO_AUTH_TOKEN: "test-secret",
    TWILIO_API_KEY: `SK${"2".repeat(32)}`,
    TWILIO_API_SECRET: "test-api-secret",
    TWILIO_TWIML_APP_SID: `AP${"3".repeat(32)}`,
    TWILIO_OUTBOUND_NUMBER: "+12125551234",
    CALL_CENTER_PUBLIC_URL: "https://crm.example.test",
    CALL_CENTER_RECORD_CALLS: "false",
  }).forEach(([k, v]) => vi.stubEnv(k, v));
});
afterEach(() => vi.unstubAllEnvs());
describe("calling boundaries", () => {
  it.each(["212 555 1234", "(212) 555-1234", "+1 (212) 555-1234"])(
    "normalizes supported numbers: %s",
    (raw) => expect(phoneNumber(raw)).toBe("+12125551234"),
  );
  it.each([
    "911",
    "+442071234567",
    "client:admin",
    "2125551234;ext=9",
    "0000000000",
  ])("rejects unsupported destinations: %s", (raw) =>
    expect(() => phoneNumber(raw)).toThrow(),
  );
  it("uses a reversible safe browser identity without accepting arbitrary clients", () => {
    expect(userFromIdentity(`client:${identity("agent-one@example")}`)).toBe(
      "agent-one@example",
    );
    expect(userFromIdentity("client:admin")).toBeNull();
    expect(userFromIdentity("client:crm_f")).toBeNull();
  });
  it("requires an explicit supervisor grant, not a manager title", () => {
    expect(canSupervise("MANAGER", ["Call.Log"])).toBe(false);
    expect(canSupervise("MANAGER", ["CallCenter.Supervise"])).toBe(true);
  });
  it("never regresses terminal or connected call states", () => {
    expect(nextCallStatus("COMPLETED", "ringing")).toBe("COMPLETED");
    expect(nextCallStatus("IN_PROGRESS", "ringing")).toBe("IN_PROGRESS");
    expect(nextCallStatus("RINGING", "in-progress")).toBe("IN_PROGRESS");
    expect(nextCallStatus("RINGING", "no-answer")).toBe("NO_ANSWER");
  });
});
describe("Twilio authorization", () => {
  function request(
    params: Record<string, string>,
    url = "https://crm.example.test/api/call-center/webhook/conference?id=c1",
    signature?: string,
  ) {
    return new Request(
      "http://internal:3000/api/call-center/webhook/conference?id=c1",
      {
        method: "POST",
        body: new URLSearchParams(params),
        headers: {
          "x-twilio-signature":
            signature ||
            twilio.getExpectedTwilioSignature("test-secret", url, params),
        },
      },
    );
  }
  it("validates the canonical public URL through a reverse proxy", async () => {
    const p = { AccountSid: account, CallSid: "CA123" };
    await expect(signedPayload(request(p))).resolves.toEqual(p);
  });
  it("rejects unsigned requests and signatures for different URLs or accounts", async () => {
    await expect(
      signedPayload(request({ AccountSid: account }, undefined, "invalid")),
    ).rejects.toThrow();
    await expect(
      signedPayload(
        request(
          { AccountSid: account },
          "https://evil.test/api/call-center/webhook/conference?id=c1",
        ),
      ),
    ).rejects.toThrow();
    await expect(
      signedPayload(request({ AccountSid: "ACother" })),
    ).rejects.toThrow();
  });
  it("does not issue a token until the explicit switch is enabled", () => {
    vi.stubEnv("CRM_DIALER_MODE", "five9");
    expect(() => tokenFor("u1")).toThrow();
  });
  it("issues a short lived identity-bound token for the configured application", () => {
    const payload = JSON.parse(
      Buffer.from(tokenFor("u1").split(".")[1], "base64url").toString(),
    );
    expect(payload.grants.identity).toBe(identity("u1"));
    expect(payload.grants.voice.outgoing.application_sid).toBe(
      process.env.TWILIO_TWIML_APP_SID,
    );
    expect(payload.grants.voice.incoming.allow).toBe(true);
    expect(payload.exp - payload.iat).toBe(3600);
  });
  it("rejects unsafe public origins", () => {
    vi.stubEnv(
      "CALL_CENTER_PUBLIC_URL",
      "https://user:password@example.test/path",
    );
    expect(configuration().ready).toBe(false);
  });
  it("keeps a listening supervisor muted and whispers scoped to the agent", () => {
    expect(conferenceXml("c1", "MONITOR", "LISTEN")).toContain('muted="true"');
    expect(conferenceXml("c1", "MONITOR", "WHISPER", "CAagent")).toContain(
      'coach="CAagent"',
    );
    expect(conferenceXml("c1", "AGENT")).toContain(
      'endConferenceOnExit="false"',
    );
    expect(conferenceXml("c1", "CUSTOMER")).toContain(
      'endConferenceOnExit="true"',
    );
    expect(conferenceXml("c1", "AGENT")).toContain('record="do-not-record"');
  });
});
