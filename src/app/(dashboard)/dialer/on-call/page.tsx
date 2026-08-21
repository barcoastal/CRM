"use client";

import { ClosersOnCallBoard } from "@/components/dialer/closers-on-call-board";

export default function ClosersOnCallPage() {
  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Closers On Call</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Every agent on a live call and the debt size of the client they are talking with (tier badged for assigned closers). Updates every 5s.
        </p>
      </header>
      <ClosersOnCallBoard />
    </div>
  );
}
