"use client";

/**
 * Five9 WebRTC softphone status badge.
 *
 * Honest scope: building a full WebRTC softphone against Five9's media
 * gateway is 1-2 weeks of work and requires:
 *   - SIP.js or similar (~80kb)
 *   - WebRTC peer connection setup
 *   - SIP REGISTER + INVITE/ACK/BYE handshake against Five9's SBC
 *   - Working microphone permission flow
 *   - DTMF in-band tones
 *   - Echo cancellation tuning
 *
 * Five9 also restricts who can use SOFTPHONE stationType — it may require an
 * additional Web Toolkit license tier on top of the AgentREST permission.
 *
 * For MVP we surface SOFTPHONE as an option in the credentials form. When
 * the user picks it, this badge explains the state. Actual WebRTC pairing
 * will land in a follow-up PD.2b task once Five9 perms are verified.
 */
export function SoftphoneStatus({ stationType }: { stationType: string | null }) {
  if (stationType !== "SOFTPHONE") return null;

  return (
    <div style={{
      background: "#fef0e8",
      border: "1px solid #fe9339",
      borderRadius: 4,
      padding: 10,
      marginTop: 8,
      fontSize: 12,
      color: "#3e3e3c",
    }}>
      <div style={{ fontWeight: 700, color: "#fe9339", marginBottom: 4 }}>
        Softphone mode — WebRTC bridge pending
      </div>
      <div>
        Call control works (dial / hold / hangup / disposition). Audio will route
        through your Five9 Agent Desktop tab until the in-browser WebRTC softphone
        ships. Track: PD.2b.
      </div>
    </div>
  );
}
